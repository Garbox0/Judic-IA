import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCW_URL = 'https://scw.pjn.gov.ar/scw/home.seam';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * PJN SCW Search — Hybrid Captcha Approach
 * 
 * The user solves the captcha in the frontend (embedded PJN widget).
 * This API receives the captcha token + search params, fetches a fresh
 * ViewState from SCW, and submits the search form server-side.
 */

// ── helpers ──

/** Fetch the SCW home page and extract the ViewState + cookies */
async function getViewState() {
    const res = await fetch(SCW_URL, {
        headers: { 'User-Agent': UA },
        redirect: 'follow',
    });

    if (!res.ok) throw new Error(`SCW home returned ${res.status}`);

    const html = await res.text();

    // Extract javax.faces.ViewState
    const vsMatch = html.match(/name="javax\.faces\.ViewState"\s+value="([^"]+)"/);
    if (!vsMatch) throw new Error('Could not extract ViewState from SCW page');

    // Collect Set-Cookie headers for session
    const cookies = res.headers.getSetCookie?.() || [];
    const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');

    return { viewState: vsMatch[1], cookies: cookieStr };
}

/** Build x-www-form-urlencoded body for SCW search */
function buildSearchBody(params) {
    const { searchType, viewState, captchaToken, jurisdiction, numero, anio, nombre } = params;

    const body = new URLSearchParams();
    body.set('formPublica', 'formPublica');
    body.set('javax.faces.ViewState', viewState);
    body.set('captcha-response', captchaToken);

    if (searchType === 'expediente') {
        body.set('formPublica:expedienteTab-value', 'porExpediente');
        body.set('formPublica:camaraNumAni', jurisdiction || '');
        body.set('formPublica:numero', numero || '');
        body.set('formPublica:anio', anio || '');
        body.set('formPublica:buscarPorNumeroButton', 'Consultar');
    } else {
        // por parte
        body.set('formPublica:expedienteTab-value', 'porParte');
        body.set('formPublica:camaraParte', jurisdiction || '');
        body.set('formPublica:nombre', nombre || '');
        body.set('formPublica:buscarPorNombreButton', 'Consultar');
    }

    return body.toString();
}

/** Parse the results HTML table from SCW response */
function parseResults(html) {
    const results = [];

    // Check for error messages
    const errorMatch = html.match(/class="error[^"]*"[^>]*>([\s\S]*?)<\//);
    if (errorMatch) {
        return { results: [], error: errorMatch[1].replace(/<[^>]+>/g, '').trim() };
    }

    // Check for "no results" message 
    if (html.includes('No se encontraron resultados') || html.includes('sin resultados')) {
        return { results: [], error: null, message: 'No se encontraron expedientes con esos parámetros.' };
    }

    // Parse result rows — SCW uses a rich:dataTable
    const rowRegex = /<tr[^>]*class="(?:rich-table-row|rf-dt-r)[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
        const row = match[1];
        const cells = [];
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let cellMatch;

        while ((cellMatch = cellRegex.exec(row)) !== null) {
            cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
        }

        if (cells.length >= 3) {
            // Extract link if available
            const linkMatch = row.match(/href="([^"]+)"/i);

            results.push({
                expediente: cells[0] || '',
                caratula: cells[1] || '',
                jurisdiccion: cells[2] || '',
                dependencia: cells[3] || '',
                situacion: cells[4] || '',
                link: linkMatch ? `https://scw.pjn.gov.ar${linkMatch[1]}` : null,
            });
        }
    }

    return { results, error: null };
}

// ── API handler ──

export async function POST(request) {
    try {
        // Auth check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
        }

        const body = await request.json();
        const { searchType, captchaToken, jurisdiction, numero, anio, nombre } = body;

        if (!captchaToken) {
            return NextResponse.json({ error: 'Falta el token del captcha. Resolvé el captcha primero.' }, { status: 400 });
        }

        if (searchType === 'expediente' && (!numero || !anio)) {
            return NextResponse.json({ error: 'Completá número y año del expediente.' }, { status: 400 });
        }

        if (searchType === 'parte' && !nombre) {
            return NextResponse.json({ error: 'Completá el nombre de la parte.' }, { status: 400 });
        }

        // 1. Get fresh ViewState + session cookies from SCW 
        console.log('[PJN Search] Getting ViewState...');
        const { viewState, cookies } = await getViewState();

        // 2. Build and submit the search form
        console.log('[PJN Search] Submitting search form...');
        const formBody = buildSearchBody({
            searchType,
            viewState,
            captchaToken,
            jurisdiction,
            numero,
            anio,
            nombre,
        });

        const searchRes = await fetch(SCW_URL, {
            method: 'POST',
            headers: {
                'User-Agent': UA,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': SCW_URL,
                'Origin': 'https://scw.pjn.gov.ar',
                'Cookie': cookies,
            },
            body: formBody,
            redirect: 'follow',
        });

        if (!searchRes.ok) {
            console.error(`[PJN Search] SCW returned ${searchRes.status}`);
            return NextResponse.json({ error: `Error del servidor PJN (${searchRes.status})` }, { status: 502 });
        }

        const resultHtml = await searchRes.text();

        // 3. Parse results
        const parsed = parseResults(resultHtml);

        console.log(`[PJN Search] Found ${parsed.results.length} results for user ${user.id}`);

        return NextResponse.json({
            results: parsed.results,
            total: parsed.results.length,
            error: parsed.error || null,
            message: parsed.message || null,
            searchType,
            query: searchType === 'expediente' ? `${numero}/${anio}` : nombre,
        });

    } catch (err) {
        console.error('[PJN Search] Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}
