import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { load } from 'cheerio';

// ─── Config ────────────────────────────────────────────────────────────────
// CSJN publica TODAS las sentencias federales y nacionales acá — SIN captcha
// La página inicial carga los últimos ~20 fallos del día sin POST ni captcha.
// El form POST con captcha permite filtros históricos/avanzados.
const BASE_URL = 'https://www.csjn.gov.ar/tribunales-federales-nacionales';
const SENTENCIAS_URL = `${BASE_URL}/sentencias.html`;

const BATCH_SIZE = 50;
const FETCH_TO_MS = 30000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Fuero normalizado desde texto del tribunal ────────────────────────────
function normalizeFuero(tribunal) {
    const t = (tribunal || '').toLowerCase();
    if (t.includes('trabajo') || t.includes('laboral')) return 'laboral';
    if (t.includes('criminal') || t.includes('penal') || t.includes('casacion penal') || t.includes('correccional')) return 'penal';
    if (t.includes('civil')) return 'civil_comercial';
    if (t.includes('comercial')) return 'civil_comercial';
    if (t.includes('contencioso') || t.includes('administrativo')) return 'contencioso_admin';
    if (t.includes('seguridad social')) return 'seguridad_social';
    if (t.includes('electoral')) return 'electoral';
    return 'federal';
}

// ─── Instancia normalizada desde texto del tribunal ────────────────────────
function normalizeInstancia(tribunal) {
    const t = (tribunal || '').toLowerCase();
    if (t.includes('corte suprema') || t.includes('csjn')) return 'csjn';
    if (t.includes('casacion')) return 'casacion';
    if (t.includes('camara') || t.includes('cámara')) return 'camara';
    if (t.includes('tribunal oral')) return 'tribunal_oral';
    if (t.includes('juzgado')) return 'juzgado';
    if (t.includes('oficina judicial')) return 'juzgado';
    return 'otro';
}

// ─── Provincia desde texto del tribunal ────────────────────────────────────
function normalizeProvince(tribunal) {
    const t = (tribunal || '').toUpperCase();
    if (t.includes('SAN MARTIN')) return 'Buenos Aires';
    if (t.includes('LA PLATA')) return 'Buenos Aires';
    if (t.includes('MAR DEL PLATA')) return 'Buenos Aires';
    if (t.includes('BAHIA BLANCA') || t.includes('BAHÍA BLANCA')) return 'Buenos Aires';
    if (t.includes('ROSARIO') || t.includes('RAFAELA')) return 'Santa Fe';
    if (t.includes('PARANÁ') || t.includes('PARANA')) return 'Entre Ríos';
    if (t.includes('CORDOBA') || t.includes('CÓRDOBA')) return 'Córdoba';
    if (t.includes('MENDOZA')) return 'Mendoza';
    if (t.includes('TUCUMAN') || t.includes('TUCUMÁN')) return 'Tucumán';
    if (t.includes('RESISTENCIA') || t.includes('CHACO')) return 'Chaco';
    if (t.includes('CORRIENTES')) return 'Corrientes';
    if (t.includes('POSADAS') || t.includes('MISIONES')) return 'Misiones';
    if (t.includes('GENERAL ROCA') || t.includes('NEUQUEN') || t.includes('NEUQUÉN')) return 'Río Negro';
    if (t.includes('SALTA')) return 'Salta';
    if (t.includes('JUJUY')) return 'Jujuy';
    if (t.includes('COMODORO') || t.includes('RAWSON') || t.includes('CHUBUT')) return 'Chubut';
    if (t.includes('USHUAIA') || t.includes('TIERRA DEL FUEGO')) return 'Tierra del Fuego';
    if (t.includes('CAPITAL FEDERAL') || t.includes('CAPITAL')) return 'CABA';
    return 'CABA'; // Default: national courts = CABA
}

// ─── Fetch sentencias page ─────────────────────────────────────────────────
async function fetchSentenciasPage() {
    const res = await fetch(SENTENCIAS_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Referer': `${BASE_URL}/`,
        },
        redirect: 'follow',
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TO_MS),
    });

    if (!res.ok) throw new Error(`CSJN_HTTP_${res.status}`);
    return res.text();
}

// ─── Parse sentencias HTML ─────────────────────────────────────────────────
// PRIMARY path: decode base64 `info=` params from "Ver Fallo" visor links.
// Each link: /visor/?url=<b64-pdf-url>&info=<b64-json>
// info decodes to: {"Tribunal":"...","Expediente N°":"...","Carátula":"...","Fecha de sentencia":"..."}
// This gives us structured data without fragile regex on rendered text.
function parseSentencias(html) {
    const $ = load(html, { decodeEntities: false });
    const cases = [];

    // PRIMARY: visor links with base64 info
    $('a').each((_, a) => {
        const href = $(a).attr('href') || '';
        if (!href.includes('/visor/') || !href.includes('info=')) return;

        try {
            const infoMatch = href.match(/[?&]info=([A-Za-z0-9+/=]+)/);
            if (!infoMatch) return;

            const info = JSON.parse(Buffer.from(infoMatch[1], 'base64').toString('utf-8'));

            const tribunal = (info['Tribunal'] || '').trim();
            const expediente = (info['Expediente N°'] || info['Expediente N'] || '').trim();
            const caratula = (info['Carátula'] || info['Caratula'] || '').trim();
            const fechaRaw = (info['Fecha de sentencia'] || '').trim();

            // DD/MM/YYYY → YYYY-MM-DD
            let fechaISO = null;
            const fm = fechaRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (fm) fechaISO = `${fm[3]}-${fm[2].padStart(2, '0')}-${fm[1].padStart(2, '0')}`;

            // Stable unique ID from expediente
            const id = `pjn-${expediente.replace(/[\s/:°Nº]/g, '-').replace(/-+/g, '-').toLowerCase()}`;

            // Decode PDF URL from url= base64 param
            let pdfUrl = SENTENCIAS_URL;
            const urlMatch = href.match(/[?&]url=([A-Za-z0-9+/=]+)/);
            if (urlMatch) {
                try {
                    const decodedUrl = Buffer.from(urlMatch[1], 'base64').toString('utf-8');
                    if (decodedUrl.startsWith('http')) pdfUrl = decodedUrl.split('?')[0];
                } catch { /* ignore */ }
            }

            cases.push({
                id,
                autos: caratula.substring(0, 500),
                tribunal: tribunal.substring(0, 300),
                instancia: normalizeInstancia(tribunal),
                fuero: normalizeFuero(tribunal),
                fecha: fechaISO,
                url: pdfUrl,
                source: 'pjn_sentencias',
                province: normalizeProvince(tribunal),
                jurisdiction: null,
                stats_raw: expediente ? `Expediente: ${expediente}` : null,
            });
        } catch { /* skip malformed */ }
    });

    // FALLBACK: no visor links → parse body text with regex
    if (cases.length === 0) {
        const bodyText = $('body').text();
        const re = /Tribunal:\s*(.+?)[\r\n]+\s*[-•]*\s*Expediente\s*N[°º]:\s*(.+?)[\r\n]+\s*[-•]*\s*Car[áa]tula:\s*(.+?)[\r\n]+\s*[-•]*\s*Fecha\s*de\s*sentencia:\s*(.+?)[\r\n]/gi;
        let m;
        while ((m = re.exec(bodyText)) !== null) {
            const tribunal = m[1].trim();
            const expediente = m[2].trim();
            const caratula = m[3].trim();
            const fechaRaw = m[4].trim();
            let fechaISO = null;
            const fm = fechaRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (fm) fechaISO = `${fm[3]}-${fm[2].padStart(2, '0')}-${fm[1].padStart(2, '0')}`;

            // Also try to get PDF from nearby Descargar link
            const pdfMatch = bodyText.match(new RegExp(`sentencia-SGU-[a-f0-9-]+\\.pdf`));

            cases.push({
                id: `pjn-${expediente.replace(/[\s/]+/g, '-').toLowerCase()}`,
                autos: caratula.substring(0, 500),
                tribunal: tribunal.substring(0, 300),
                instancia: normalizeInstancia(tribunal),
                fuero: normalizeFuero(tribunal),
                fecha: fechaISO,
                url: pdfMatch ? `${BASE_URL}/d/${pdfMatch[0]}` : SENTENCIAS_URL,
                source: 'pjn_sentencias',
                province: normalizeProvince(tribunal),
                jurisdiction: null,
                stats_raw: `Expediente: ${expediente}`,
            });
        }
    }

    return cases;
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
// Runs daily at 5:30am (vercel.json).
// The CSJN page loads the latest ~20 sentencias without any POST or captcha.
// Call with ?days=N to run multiple fetches (but all will return today's data
// since date filters require POST+captcha — use for forced indexing only).
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

    let docsUpserted = 0;
    const startMs = Date.now();

    try {
        console.log('[CRON index-pjn-sentencias] Fetching today\'s sentencias from CSJN...');
        const html = await fetchSentenciasPage();
        const cases = parseSentencias(html);

        console.log(`[CRON index-pjn-sentencias] Parsed ${cases.length} sentencias`);

        if (cases.length > 0) {
            for (let i = 0; i < cases.length; i += BATCH_SIZE) {
                const chunk = cases.slice(i, i + BATCH_SIZE);
                docsUpserted += await upsertBatch(supabase, chunk);
            }
        }

        return NextResponse.json({
            status: 'ok',
            source: 'pjn_sentencias',
            docs_parsed: cases.length,
            docs_upserted: docsUpserted,
            fueros: [...new Set(cases.map(c => c.fuero))],
            duration_ms: Date.now() - startMs,
        });

    } catch (err) {
        console.error('[CRON index-pjn-sentencias] Error:', err.message);
        return NextResponse.json({
            status: 'error',
            source: 'pjn_sentencias',
            error: err.message,
            docs_upserted: docsUpserted,
            duration_ms: Date.now() - startMs,
        }, { status: 500 });
    }
}
