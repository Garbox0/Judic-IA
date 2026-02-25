import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { load } from 'cheerio';

// ─── Config ────────────────────────────────────────────────────────────────
const BASE = 'https://juristeca.jusbaires.gob.ar';
const SEARCH_URL = `${BASE}/buscador-juristeca/busqueda-avanzada-de-jurisprudencia/`;
const PDF_BASE = `${BASE}/fallos/`;

const MAX_PAGES_PER_RUN = 20;   // 10 resultados/pág → 200 docs máx por run
const BATCH_SIZE = 50;
const DELAY_MS = 800;  // respetuosos con el servidor
const FETCH_TO_MS = 20000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Términos rotativos ────────────────────────────────────────────────────
// Más amplios que TSJ — Cámaras tienen más volumen
const ROTATING_QUERIES = [
    'despido', 'alimentos', 'daños y perjuicios', 'nulidad', 'amparo',
    'contrato', 'locacion', 'recurso', 'medida cautelar', 'ejecucion',
    'laboral', 'contencioso', 'penal', 'consumo', 'obra social',
    'accidente', 'mora', 'rescision', 'multa', 'responsabilidad',
];

// Fuero normalizado desde el texto que devuelve Juristeca
function normalizeFuero(fueroText) {
    const t = (fueroText || '').toLowerCase();
    if (t.includes('laboral') || t.includes('trabajo')) return 'laboral';
    if (t.includes('penal') || t.includes('contravenc')) return 'penal';
    if (t.includes('contencioso') || t.includes('cay')) return 'contencioso_admin';
    if (t.includes('consumo')) return 'consumo';
    if (t.includes('civil') || t.includes('comercial')) return 'civil_comercial';
    return 'otro';
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────
async function fetchPage(query, page = 1) {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('accion', 'fallos');
    url.searchParams.set('Texto[0]', query);
    url.searchParams.set('pagina', String(page));

    const res = await fetch(url.toString(), {
        headers: {
            'Accept': 'text/html,application/xhtml+xml',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': SEARCH_URL,
        },
        redirect: 'follow',
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TO_MS),
    });

    if (!res.ok) throw new Error(`JURISTECA_HTTP_${res.status}`);
    return res.text();
}

// ─── Parser ─────────────────────────────────────────────────────────────────
// DOM confirmado: cada fallo es un div.fallo-individual con este texto:
// "ID Fallo: 61800\n\nFuero: Contencioso...\n\nCámara de Apelaciones\n\n• Partes . Causa Nº 109026-2023-0. Fecha: 23-12-2025. Sala: I\n\nVer Fallo"
function parseResultsPage(html) {
    const $ = load(html);
    const cases = [];

    // Total: "Fallos encontrados (618)"
    const bodyText = $('body').text();
    const totalMatch = bodyText.match(/Fallos encontrados\s*\((\d+)\)/i)
        || bodyText.match(/(\d[\d.]*)\s+(registro|resultado|fallo)/i);
    const total = totalMatch ? parseInt((totalMatch[1] || '0').replace(/\./g, '')) : null;

    // Paginación — links de páginas o "Página X de Y"
    const pagMatch = bodyText.match(/[Pp][áa]gina\s+(\d+)\s+de\s+(\d+)/);
    const pageLinks = $('a').filter((_, a) => /pagina=(\d+)/i.test($(a).attr('href') || ''));
    const maxPageLink = pageLinks.length > 0
        ? Math.max(...pageLinks.map((_, a) => parseInt($(a).attr('href').match(/pagina=(\d+)/i)[1])).get())
        : 1;
    const currentPage = pagMatch ? parseInt(pagMatch[1]) : 1;
    const totalPages = pagMatch ? parseInt(pagMatch[2]) : (pageLinks.length > 0 ? maxPageLink : 1);
    const hasMore = currentPage < totalPages;

    // Selector exacto confirmado
    $('div.fallo-individual').each((_, el) => {
        const $el = $(el);
        const text = $el.text();

        // ID del fallo
        const idMatch = text.match(/ID Fallo:\s*(\d+)/i);
        if (!idMatch) return;
        const id = idMatch[1];

        // PDF link (único link que apunta a /fallos/{id}.pdf)
        const pdfUrl = `${PDF_BASE}${id}.pdf`;

        // Fuero
        const fueroMatch = text.match(/Fuero:\s*([^\n]+)/i);
        const fueroRaw = fueroMatch ? fueroMatch[1].trim() : '';

        // Carátula: está en la línea que empieza con "•"
        const caratulaMatch = text.match(/[•·]\s*([^\n.]+(?:\.[^\n]+)?)\s*\.\s*Causa/);
        const autos = caratulaMatch
            ? caratulaMatch[1].trim().substring(0, 400)
            : `Fallo Juristeca ${id}`;

        // Causa Nº
        const causaMatch = text.match(/Causa\s+N[°º]\s*([^\s.]+)/i);
        const causaNro = causaMatch ? causaMatch[1] : null;

        // Sala
        const salaMatch = text.match(/Sala:\s*([^\n]+)/i);
        const sala = salaMatch ? salaMatch[1].trim().substring(0, 20) : null;

        // Fecha: formato DD-MM-YYYY
        const fechaMatch = text.match(/Fecha:\s*(\d{2})-(\d{2})-(\d{4})/);
        const fechaISO = fechaMatch
            ? `${fechaMatch[3]}-${fechaMatch[2]}-${fechaMatch[1]}`
            : null;

        // Descriptores/tesauro (links de temas, después del Ver Fallo)
        const descriptores = $el.find('a[href*="temas-fallos"]')
            .map((_, a) => $(a).text().trim()).get().join(' – ').substring(0, 500);

        cases.push({
            id: `juristeca-${id}`,
            autos,
            tribunal: `Cámara de Apelaciones CABA${sala ? ` — Sala ${sala}` : ''}`,
            instancia: 'camara',
            fuero: normalizeFuero(fueroRaw),
            fecha: fechaISO,
            url: pdfUrl,
            source: 'juristeca',
            province: 'CABA',
            jurisdiction: fueroRaw.substring(0, 200) || null,
            stats_raw: [causaNro, descriptores].filter(Boolean).join(' | ').substring(0, 500) || null,
        });
    });

    return { cases, total, hasMore, currentPage, totalPages };
}

// ─── Upsert ────────────────────────────────────────────────────────────────
async function upsertBatch(supabase, rows) {
    const { error } = await supabase
        .from('jurisprudencia_ba')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
    if (error) throw new Error(`SUPABASE_UPSERT: ${error.message}`);
    return rows.length;
}

// ─── Main handler ──────────────────────────────────────────────────────────
export async function GET(request) {
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
            console.log(`[CRON index-juristeca] page ${page} — "${queryTerm}"`);
            const html = await fetchPage(queryTerm, page);
            const parsed = parseResultsPage(html);

            if (totalAvailable === null && parsed.total !== null) {
                totalAvailable = parsed.total;
            }

            if (parsed.cases.length === 0) {
                console.log(`[CRON index-juristeca] No results on page ${page}, stopping`);
                break;
            }

            batch.push(...parsed.cases);
            scannedPages++;

            while (batch.length >= BATCH_SIZE) {
                docsUpserted += await upsertBatch(supabase, batch.splice(0, BATCH_SIZE));
            }

            if (!parsed.hasMore) break;
            page++;
            if (page <= maxPages) await sleep(DELAY_MS);
        }

        if (batch.length > 0) {
            docsUpserted += await upsertBatch(supabase, batch);
        }

        return NextResponse.json({
            status: 'ok',
            source: 'juristeca',
            query: queryTerm,
            pages_scanned: scannedPages,
            docs_upserted: docsUpserted,
            total_available: totalAvailable,
            duration_ms: Date.now() - startMs,
        });

    } catch (err) {
        console.error('[CRON index-juristeca] Error:', err.message);
        return NextResponse.json({
            status: 'error',
            source: 'juristeca',
            error: err.message,
            query: queryTerm,
            pages_scanned: scannedPages,
            docs_upserted: docsUpserted,
            duration_ms: Date.now() - startMs,
        }, { status: 500 });
    }
}
