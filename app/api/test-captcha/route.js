import { NextResponse } from 'next/server';
import { searchByExpediente } from '@/lib/captchaSolver';

/**
 * Test endpoint: prueba el scraper Puppeteer completo en una búsqueda de ejemplo.
 * GET /api/test-captcha?secret=...&numero=12345&anio=2024&jurisdiccion=1
 */
export async function GET(request) {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const numero = url.searchParams.get('numero') || '12345';
    const anio = url.searchParams.get('anio') || '2024';
    const jurisdiccion = url.searchParams.get('jurisdiccion') || '1';

    const startMs = Date.now();
    console.log(`[test-captcha] Starting test search: ${numero}/${anio} — camara ${jurisdiccion}`);

    try {
        const result = await searchByExpediente({ jurisdiccion, numero, anio });

        return NextResponse.json({
            status: 'ok',
            duration_ms: Date.now() - startMs,
            results: result.results ?? [],
            total: result.results?.length ?? 0,
            headers: result.headers ?? [],
            noResults: result.noResults ?? null,
            error: result.error ?? null,
        });

    } catch (err) {
        return NextResponse.json({
            status: 'error',
            error: err.message,
            duration_ms: Date.now() - startMs,
        }, { status: 500 });
    }
}
