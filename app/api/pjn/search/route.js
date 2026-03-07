import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolvePjnParteType } from '@/lib/pjnParteRules';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * PJN SCW Search - Puppeteer full-browser approach
 */
export async function POST(request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Sesion invalida' }, { status: 401 });
        }

        const body = await request.json();
        const { searchType, jurisdiction, jurisdictionName, numero, anio, nombre, parteTipo, maxPages, sessionId } = body;

        if (searchType === 'expediente' && (!numero || !anio)) {
            return NextResponse.json({ error: 'Completa numero y anio del expediente.' }, { status: 400 });
        }
        if (searchType === 'parte' && !nombre) {
            return NextResponse.json({ error: 'Completa el nombre de la parte.' }, { status: 400 });
        }

        const effectiveParteTipo = searchType === 'parte'
            ? resolvePjnParteType({ jurisdictionId: jurisdiction, requestedType: parteTipo })
            : null;

        const startMs = Date.now();
        console.log(
            `[PJN Search] Starting Puppeteer search - type: ${searchType}, user: ${user.id}, jur: ${jurisdiction || '-'}, experimental session: ${sessionId ? 'YES' : 'NO'}`
        );

        const normalizedMaxPages = Math.max(
            1,
            Math.min(Number(maxPages) || (searchType === 'parte' ? 20 : 6), 80)
        );

        const scraperTargetUrl = process.env.SCRAPER_URL || 'http://judicia-scraper.local:3100/pjn/search';
        const scraperToken = process.env.SCRAPER_SECRET || 'Cthulhu_Scraper_2025_Secret!';

        const resScraper = await fetch(scraperTargetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-scraper-token': scraperToken
            },
            body: JSON.stringify({
                tab: searchType === 'expediente' ? 'porExpediente' : 'porParte',
                jurisdiccion: jurisdiction,
                jurisdictionName,
                numero: searchType === 'expediente' ? numero : undefined,
                anio: searchType === 'expediente' ? anio : undefined,
                nombre: searchType === 'parte' ? nombre : undefined,
                parteTipo: effectiveParteTipo,
                maxPages: normalizedMaxPages,
                sessionId
            })
        });

        if (!resScraper.ok) {
            const errData = await resScraper.json().catch(() => ({}));
            throw new Error(errData.error || `La Raspberry Pi (scraper) devolvió error ${resScraper.status}`);
        }

        const result = await resScraper.json();

        const duration = Date.now() - startMs;
        console.log(
            `[PJN Search] Done in ${duration}ms - ${(result.results?.length ?? 0)} results, session_cached: ${result.sessionId ? 'YES' : 'NO'}`
        );

        if (result.error) {
            if (result.error.toLowerCase().includes('captcha')) {
                return NextResponse.json({
                    error: 'El captcha fue rechazado. El sistema reintentara automaticamente.',
                    retryable: true
                }, { status: 422 });
            }
            return NextResponse.json({ error: result.error }, { status: 502 });
        }

        return NextResponse.json({
            results: result.results ?? [],
            headers: result.headers ?? [],
            total: result.results?.length ?? 0,
            noResults: result.noResults ?? null,
            pagination: result.pagination ?? null,
            sessionId: result.sessionId ?? null, // IMPORTANTE: Devolvemos el token al cliente
            searchType,
            query: searchType === 'expediente' ? `${numero}/${anio}` : nombre,
            effective_parte_tipo: effectiveParteTipo,
            duration_ms: duration
        });
    } catch (err) {
        console.error('[PJN Search] Error:', err.message);

        if (err.message === 'CAPTCHA_FRAME_NOT_FOUND') {
            return NextResponse.json({ error: 'No se pudo cargar el captcha del PJN. Reintenta en unos segundos.' }, { status: 503 });
        }
        if (err.message === 'CAPTCHA_SOLVE_FAILED') {
            return NextResponse.json({ error: 'No se pudo resolver el captcha automaticamente. Reintenta.', retryable: true }, { status: 503 });
        }

        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}
