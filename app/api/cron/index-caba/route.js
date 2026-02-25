import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { load } from 'cheerio';

// ─── Config ────────────────────────────────────────────────────────
const TSJ_BASE = 'http://jurisprudencia.tsjbaires.gob.ar/jurisprudencia';
const TSJ_SEARCH = `${TSJ_BASE}/resultadoBusqueda.asp`;
const TSJ_FALLO_PDF = `${TSJ_BASE}/verDocumento.asp?idDoc=`;  // probable pattern
const MAX_PAGES_PER_RUN = 40;
const BATCH_UPSERT_SIZE = 50;
const FETCH_TIMEOUT_MS = 30000;  // TSJ CABA usa servidor viejo, necesita más tiempo
const PAGE_DELAY_MS = 600;   // TSJ es un servidor viejo, seamos corteses
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Secretarías habilitadas (todas)
const SECRETARIAS_FIELDS = {
    chkSAO: 'on',   // Asuntos Originarios y Relaciones de Consumo
    chkSACAYT: 'on',   // Contencioso, Administrativo y Tributario
    chkSAC: 'on',   // Asuntos Penales
    chkSACyC: 'on',   // Asuntos Civiles y Comerciales
    chkSAL: 'on',   // Asuntos Laborales
    chkSAG: 'on',   // Asuntos Generales
    chkTSN: 'on',   // Tribunal de Superintendencia del Notariado
};

// Secretaría → fuero normalizado
const SECRETARIA_TO_FUERO = {
    SAOyRC: 'otro',
    SACyT: 'contencioso_admin',
    SACyAT: 'contencioso_admin',
    SACAYT: 'contencioso_admin',
    SACyC: 'civil_comercial',
    SAL: 'laboral',
    SAG: 'otro',
    SAPPJCyF: 'penal',
    TSN: 'otro',
};

// ─── Términos rotativos ──────────────────────────────────────────
const ROTATING_QUERIES = [
    'despido', 'alimentos', 'daños', 'nulidad', 'amparo',
    'contrato', 'recurso', 'inconstitucionalidad', 'locacion',
    'usucapion', 'laboral', 'penal', 'administrativo', 'cautelar', 'apelacion',
];

// ─── Helpers ─────────────────────────────────────────────────────
function cleanText(v) {
    return String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Fetch (simple — sin cookies necesarias en TSJ) ──────────────
async function postSearch(query, page = 1, cantReg = 100) {
    const body = new URLSearchParams({
        hdnPaginaOrigen: 'busqueda.asp',
        textoLibreTodas: query,
        textoLibreFrase: '',
        textoLibreAlgunas: '',
        textoLibreExcluyendo: '',   // campo correcto para "sin las palabras"
        expCaratula: '',
        expNro: '',
        expFechaResDesde: '',      // nombres reales del formulario
        expFechaResHasta: '',
        termino_elegido: '',
        IDtermino_elegido: '',
        sModoOpe: 'post',
        limpiarBusq: '',
        ordenInicial: '',
        ordenResCampo: '',
        ordenResTipo: '',
        rebusq: '',
        rebusqIdTermino: '',
        rebusqDescTermino: '',
        pag: String(page),
        cantRegPagina: String(cantReg),
        ...SECRETARIAS_FIELDS,
    });

    const res = await fetch(TSJ_SEARCH, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml',
            'Referer': `${TSJ_BASE}/`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: body.toString(),
        redirect: 'follow',
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`TSJ_HTTP_${res.status}`);
    // TSJ usa ISO-8859-1, decodificamos correctamente
    const buf = await res.arrayBuffer();
    const dec = new TextDecoder('iso-8859-1');
    return dec.decode(buf);
}

// ─── Parse results page ──────────────────────────────────────────
function parseResultsPage(html) {
    const $ = load(html, { decodeEntities: true });
    const cases = [];

    // Total: "Se encontraron 297 resultados..."
    const totalText = $('body').text();
    const totalMatch = totalText.match(/Se encontraron\s+([\d.]+)\s+resultados/i);
    const total = totalMatch ? parseInt(totalMatch[1].replace(/\./g, '')) : null;

    // Número de página actual / total de páginas
    const pagMatch = totalText.match(/P[áa]gina\s+(\d+)\/(\d+)/i);
    const currentPage = pagMatch ? parseInt(pagMatch[1]) : 1;
    const totalPages = pagMatch ? parseInt(pagMatch[2]) : 1;
    const hasMore = currentPage < totalPages;

    // Filas de resultados: tabla principal con columnas Nro.Exp, Carátula, Secretaría, Fecha, Documento
    $('table tr').each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length < 5) return;

        const nroExp = cleanText($(tds[0]).text());
        const caratula = cleanText($(tds[1]).text());
        const secretaria = cleanText($(tds[2]).text());
        const fechaRaw = cleanText($(tds[3]).text());

        // Skip header rows or empty
        if (!nroExp || isNaN(parseInt(nroExp))) return;

        // Link al PDF (ícono en col 4)
        let pdfUrl = null;
        $(tds[4]).find('a').each((_, a) => {
            const href = $(a).attr('href') || '';
            const onclick = $(a).attr('onclick') || '';
            if (href.includes('.pdf') || href.includes('verDoc') || href.includes('idDoc')) {
                pdfUrl = href.startsWith('http') ? href : `${TSJ_BASE}/${href.replace(/^\//, '')}`;
            } else if (onclick.includes('idDoc') || onclick.includes('verDoc')) {
                const m = onclick.match(/idDoc=(\d+)/i) || onclick.match(/verDocumento[^(]*\((\d+)/i);
                if (m) pdfUrl = `${TSJ_FALLO_PDF}${m[1]}`;
            }
        });

        // Tesauro (materia temática)
        // La fila siguiente suele contener "Tesauro asociados: ..."
        const nextRow = $(tr).next('tr');
        const tesauro = nextRow.text().includes('Tesauro')
            ? cleanText(nextRow.text().replace('Tesauro asociados', '').replace('Tesauro:', ''))
            : null;

        // Normalizar fecha  dd/m/yyyy → YYYY-MM-DD
        let fechaISO = null;
        const fm = fechaRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (fm) fechaISO = `${fm[3]}-${fm[2].padStart(2, '0')}-${fm[1].padStart(2, '0')}`;

        const fuero = SECRETARIA_TO_FUERO[secretaria.toUpperCase().replace(/[^A-Z]/g, '')] || 'otro';

        cases.push({
            id: `tsj-caba-${nroExp}`,
            autos: caratula || `Expediente ${nroExp}`,
            tribunal: 'Tribunal Superior de Justicia de la CABA',
            instancia: 'tsj',
            fuero,
            fecha: fechaISO,
            url: pdfUrl || `${TSJ_BASE}/resultadoBusqueda.asp`,
            source: 'tsj_caba',
            province: 'CABA',
            jurisdiction: secretaria || null,
            stats_raw: tesauro || null,
        });
    });

    return { cases, total, hasMore, currentPage, totalPages };
}

// ─── Upsert batch ────────────────────────────────────────────────
async function upsertBatch(supabase, rows) {
    const { error } = await supabase
        .from('jurisprudencia_ba')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
    if (error) throw new Error(`SUPABASE_UPSERT: ${error.message}`);
    return rows.length;
}

// ─── Route handler ───────────────────────────────────────────────
export async function GET(request) {
    // Auth check
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    const cronHeader = request.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET && cronHeader !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const maxPages = parseInt(url.searchParams.get('pages') || '') || MAX_PAGES_PER_RUN;
    const pageDelay = parseInt(url.searchParams.get('delay') || '') || PAGE_DELAY_MS;
    const forcedQ = url.searchParams.get('q');

    const dayOfYear = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const queryTerm = forcedQ || ROTATING_QUERIES[dayOfYear % ROTATING_QUERIES.length];

    let scannedPages = 0;
    let docsUpserted = 0;
    let totalAvailable = null;
    const startMs = Date.now();

    try {
        let batch = [];
        let page = 1;

        while (page <= maxPages) {
            console.log(`[CRON index-caba] Fetching page ${page} for "${queryTerm}"`);
            const html = await postSearch(queryTerm, page, 100);
            const parsed = parseResultsPage(html);

            if (totalAvailable === null && parsed.total !== null) {
                totalAvailable = parsed.total;
            }

            if (parsed.cases.length === 0) {
                console.log(`[CRON index-caba] No cases on page ${page} — stopping`);
                break;
            }

            batch.push(...parsed.cases);
            scannedPages++;

            // Upsert in chunks
            while (batch.length >= BATCH_UPSERT_SIZE) {
                const chunk = batch.splice(0, BATCH_UPSERT_SIZE);
                docsUpserted += await upsertBatch(supabase, chunk);
            }

            if (!parsed.hasMore) {
                console.log(`[CRON index-caba] All ${parsed.totalPages} pages done`);
                break;
            }

            page++;
            if (page <= maxPages) await sleep(pageDelay);
        }

        // Flush remaining
        if (batch.length > 0) {
            docsUpserted += await upsertBatch(supabase, batch);
        }

        return NextResponse.json({
            status: 'ok',
            query: queryTerm,
            pages_scanned: scannedPages,
            docs_upserted: docsUpserted,
            total_available: totalAvailable,
            duration_ms: Date.now() - startMs,
        });

    } catch (err) {
        console.error('[CRON index-caba] Error:', err.message);
        return NextResponse.json({
            status: 'error',
            error: err.message,
            query: queryTerm,
            pages_scanned: scannedPages,
            docs_upserted: docsUpserted,
            duration_ms: Date.now() - startMs,
        }, { status: 500 });
    }
}
