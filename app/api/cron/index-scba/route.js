import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { load } from 'cheerio';

// ─── Config ────────────────────────────────────────────────────────
const SCBA_BASE_URL = 'https://www-2020.scba.gov.ar';
const SCBA_SEARCH_BASE = `${SCBA_BASE_URL}/jurisprudencia/navbar.asp?Busca=Fallos%20Completos&SearchString=`;
const MAX_PAGES_PER_RUN = 40;    // ~400 fallos por ejecución
const BATCH_UPSERT_SIZE = 50;    // Upsert en batches para no saturar Supabase
const FETCH_TIMEOUT_MS = 15000;
const PAGE_DELAY_MS = 500;    // Pausa entre páginas (evita rate-limit de SCBA)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Helpers (identical to manual/route.js) ─────────────────────────
function cleanText(value) {
    return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function normalizeText(value) {
    return cleanText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function toIsoDate(mmddyyyy) {
    const match = cleanText(mmddyyyy).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}
function extractDateIso(statsText) {
    const match = cleanText(statsText).match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    return match ? toIsoDate(match[1]) : null;
}
function inferInstanciaKey(path = '', summary = '') {
    const p = normalizeText(path), s = normalizeText(summary);
    if (p.includes('/scba/')) return 'scba';
    if (p.includes('/camara/')) return 'camara';
    if (s.includes('juzg')) return 'juzgado';
    return 'otra';
}
function inferFueroKey(text = '') {
    const n = normalizeText(text);
    if (!n) return 'otro';
    if (/(familia|alimentos|filiacion|divorcio|tenencia|menor|adopcion)/.test(n)) return 'familia';
    if (/(laboral|trabajo|despido|indemnizacion laboral|accidente de trabajo)/.test(n)) return 'laboral';
    if (/(penal|homicidio|imputado|condena|fiscalia|ministerio publico fiscal)/.test(n)) return 'penal';
    if (/(contencioso|administrativ|licitacion|municipalidad|estado provincial)/.test(n)) return 'contencioso_admin';
    if (/(previsional|jubilacion|pension|anses|haberes)/.test(n)) return 'previsional';
    if (/(comercial|sociedad|quiebra|concurso|cheque|pagare)/.test(n)) return 'civil_comercial';
    if (/(civil|danos|responsabilidad|contrato|hipoteca|sucesion|amparo)/.test(n)) return 'civil_comercial';
    return 'otro';
}
function extractTribunal(summary = '') {
    const text = cleanText(summary);
    const patterns = [
        /(Camara[^.;]{0,170})/i, /(Juzg\.?[^.;]{0,170})/i,
        /(Tribunal[^.;]{0,170})/i, /(Suprema Corte[^.;]{0,180})/i, /(SCBA[^.;]{0,90})/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m?.[1]) return cleanText(m[1]);
    }
    return '';
}

// ─── Parse a single SCBA results page ───────────────────────────────
function parseScbaPage(html) {
    const $ = load(html || '');
    const rows = $('tr.RecordTitle').toArray();
    const cases = [];

    rows.forEach((row, idx) => {
        const rawAutos = cleanText($(row).find('td.RecordTitle').text() || $(row).text());
        const autos = cleanText(rawAutos.replace(/^\d+\.\s*/, '')) || `Fallo ${idx + 1}`;
        const detailsRow = $(row).next('tr');
        if (!detailsRow?.length) return;
        const detailsCells = detailsRow.find('td');
        if (detailsCells.length < 2) return;
        const summaryRaw = cleanText(detailsCells.eq(1).text()).replace(/^Inicio:\s*/i, '');
        const statsRow = detailsRow.next('tr');
        const statsAnchor = statsRow.find('a.RecordStats').first();
        const sourcePath = cleanText(statsAnchor.attr('href') || statsAnchor.text());
        if (!sourcePath) return;
        const statsText = cleanText(statsRow.find('i.RecordStats').text());
        const fecha = extractDateIso(statsText);
        const instanciaKey = inferInstanciaKey(sourcePath, summaryRaw);
        const fueroKey = inferFueroKey(`${autos} ${summaryRaw}`);
        const tribunal = extractTribunal(summaryRaw);
        let sourceUrl = '';
        try { sourceUrl = new URL(sourcePath, SCBA_BASE_URL).toString(); } catch { sourceUrl = sourcePath; }
        const titleForPdf = encodeURIComponent((autos || 'fallo').slice(0, 80));
        const pdfProxyUrl = sourceUrl ? `/api/kb-proxy?url=${encodeURIComponent(sourceUrl)}&title=${titleForPdf}` : null;

        cases.push({
            id: sourcePath,                  // Use source_path as stable PK (dedup-safe)
            autos,
            summary: summaryRaw,
            tribunal,
            instancia: instanciaKey,
            fuero: fueroKey,
            fecha: fecha || null,
            url: sourceUrl,
            pdf_url: pdfProxyUrl,
            source_path: sourcePath,
            stats_raw: statsText,
            source: 'scba_public',
            province: 'Buenos Aires',
            jurisdiction: 'Provincial',
            updated_at: new Date().toISOString()
        });
    });

    // Extract next page URL and parse RankBase for direct construction
    const nextAnchor = $('a').toArray().find(el => {
        const href = $(el).attr('href') || '';
        const text = normalizeText($(el).text() || '');
        return /pg=\d+/i.test(href) && /ximos\s*10/.test(text);
    });
    let nextUrl = null;
    let nextPg = null;
    let rankBase = null;
    if (nextAnchor) {
        const rawHref = $(nextAnchor).attr('href') || '';
        try {
            const resolved = new URL(rawHref, `${SCBA_BASE_URL}/jurisprudencia/`);
            nextUrl = resolved.toString();
            nextPg = parseInt(resolved.searchParams.get('pg') || '0', 10) || null;
            rankBase = resolved.searchParams.get('RankBase') || null;
            console.log('[SCBA] Pagination link found → pg=' + nextPg + ' RankBase=' + rankBase);
        } catch { /* ignore */ }
    } else {
        console.log('[SCBA] No "Próximos 10" link found on this page');
    }

    const totalHeader = $('p').toArray().map(el => cleanText($(el).text()))
        .find(t => /Documentos\s+\d+\s+a\s+\d+\s+de\s+/i.test(t));
    const totalMatch = totalHeader?.match(/Documentos\s+\d+\s+a\s+\d+\s+de\s+([\d.]+)/i);
    const totalAvailable = totalMatch ? Number(totalMatch[1].replace(/\./g, '')) || null : null;

    return { cases, nextUrl, nextPg, rankBase, totalAvailable };
}

// ─── Session-aware fetch (keeps SCBA cookies across pages) ──────────
function createSession() {
    let cookieJar = '';
    return async function fetchPage(url) {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-AR,es;q=0.9',
            'Referer': `${SCBA_BASE_URL}/jurisprudencia/`,
        };
        if (cookieJar) headers['Cookie'] = cookieJar;

        const res = await fetch(url, {
            headers,
            cache: 'no-store',
            redirect: 'follow',
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });

        // Collect session cookies
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
            const newCookies = setCookie.split(/,(?=[^;]+=[^;]+)/).map(c => c.split(';')[0].trim()).join('; ');
            cookieJar = newCookies;
        }

        if (!res.ok) throw new Error(`SCBA_HTTP_${res.status}`);
        return res.text();
    };
}

// ─── Upsert batch to Supabase ────────────────────────────────────────
async function upsertBatch(supabase, rows) {
    const { error } = await supabase
        .from('jurisprudencia_ba')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
    if (error) throw new Error(`SUPABASE_UPSERT: ${error.message}`);
    return rows.length;
}

// ─── Main cron handler ───────────────────────────────────────────────
export async function GET(request) {
    // Verify secret to prevent unauthorized triggers
    const secret = request.headers.get('x-cron-secret') || new URL(request.url).searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const startTime = Date.now();
    let scannedPages = 0;
    let docsUpserted = 0;
    let totalAvailable = null;
    let status = 'ok';
    let errorMessage = null;

    // Use a broad rotating search term to cover diverse content each run
    // Cycle through common legal terms weekly to build a varied index
    const ROTATING_QUERIES = [
        'alimentos', 'despido', 'daños y perjuicios', 'indemnizacion',
        'contrato', 'sucesion', 'sentencia', 'amparo', 'penal', 'laboral',
        'comercial', 'hipoteca', 'familia', 'administrativo', 'previsional'
    ];
    const dayOfYear = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const forcedQuery = new URL(request.url).searchParams.get('q');
    const queryTerm = forcedQuery || ROTATING_QUERIES[dayOfYear % ROTATING_QUERIES.length];

    const maxPages = parseInt(new URL(request.url).searchParams.get('pages') || '') || MAX_PAGES_PER_RUN;
    const pageDelay = parseInt(new URL(request.url).searchParams.get('delay') || '') || PAGE_DELAY_MS;
    const fetchPage = createSession(); // cada término tiene su propia sesión de cookies

    try {
        let currentUrl = `${SCBA_SEARCH_BASE}${encodeURIComponent(queryTerm)}`;
        let batch = [];
        let sessionRankBase = null;  // extracted from first pagination link
        let sessionPg = null;        // current pg number (SCBA's page counter)
        let sessionSearchString = queryTerm;

        while (currentUrl && scannedPages < maxPages) {
            console.log(`[CRON index-scba] Fetching page ${scannedPages + 1}: ${currentUrl}`);
            const html = await fetchPage(currentUrl);
            const parsed = parseScbaPage(html);

            if (typeof parsed.totalAvailable === 'number' && totalAvailable === null) {
                totalAvailable = parsed.totalAvailable;
            }

            batch.push(...parsed.cases);
            scannedPages += 1;

            // Upsert in batches
            while (batch.length >= BATCH_UPSERT_SIZE) {
                const chunk = batch.splice(0, BATCH_UPSERT_SIZE);
                docsUpserted += await upsertBatch(supabase, chunk);
            }

            // ── Determine next URL ──────────────────────────────────────
            if (!sessionRankBase && parsed.rankBase) {
                sessionRankBase = parsed.rankBase;
                sessionPg = parsed.nextPg ?? 2;
                currentUrl = parsed.nextUrl;     // link real para la página 2
            } else if (sessionRankBase && sessionPg) {
                sessionPg++;
                currentUrl = [
                    `${SCBA_BASE_URL}/jurisprudencia/Navbar.asp`,
                    `?Busca=Fallos+Completos`,
                    `&SearchString=${encodeURIComponent(sessionSearchString)}`,
                    `&pg=${sessionPg}`,
                    `&RankBase=${sessionRankBase}`
                ].join('');
            } else {
                currentUrl = parsed.nextUrl;
            }

            // Pausa cortés entre páginas para no saturar SCBA
            if (currentUrl) await sleep(pageDelay);
        }

        // Flush remaining
        if (batch.length > 0) {
            docsUpserted += await upsertBatch(supabase, batch);
        }
    } catch (err) {
        status = 'error';
        errorMessage = err?.message || 'Unknown error';
        console.error('[CRON index-scba] Error:', err);
    }

    const durationMs = Date.now() - startTime;

    // Log the run
    const { error: logError } = await supabase.from('jurisprudencia_index_log').insert({
        pages_scanned: scannedPages,
        docs_upserted: docsUpserted,
        docs_total: totalAvailable,
        status,
        error_message: errorMessage,
        duration_ms: durationMs
    });
    if (logError) console.error('[CRON index-scba] Log failed:', logError.message);

    const result = {
        status,
        pages_scanned: scannedPages,
        docs_upserted: docsUpserted,
        total_available: totalAvailable,
        duration_ms: durationMs,
        ...(errorMessage && { error: errorMessage })
    };

    console.log('[CRON index-scba]', result);
    return NextResponse.json(result, { status: status === 'error' ? 502 : 200 });
}
