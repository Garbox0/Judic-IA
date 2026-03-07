import { NextResponse } from 'next/server';

// Opcional: Proteger ruta con Supabase Auth si se requiere login
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req) {
    try {
        const body = await req.json();
        const { jurisdiccion, numero, anio, sessionId } = body;

        if (!numero || !anio) {
            return NextResponse.json({ error: 'Falta número o año de expediente' }, { status: 400 });
        }

        // --- Verificación opcional de sesión ---
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            {
                cookies: {
                    get(name) { return cookieStore.get(name)?.value; },
                },
            }
        );

        const scraperTargetUrl = process.env.SCRAPER_URL ? process.env.SCRAPER_URL.replace('/search', '/detalle') : 'http://judicia-scraper.local:3100/pjn/detalle';
        const scraperToken = process.env.SCRAPER_SECRET || 'Cthulhu_Scraper_2025_Secret!';

        const resScraper = await fetch(scraperTargetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-scraper-token': scraperToken
            },
            body: JSON.stringify({ jurisdiccion, numero, anio, sessionId })
        });

        if (!resScraper.ok) {
            const errData = await resScraper.json().catch(() => ({}));
            throw new Error(errData.error || `La Raspberry Pi (scraper) devolvió error ${resScraper.status}`);
        }

        const result = await resScraper.json();
        return NextResponse.json({
            ...result,
            sessionId: result.sessionId ?? null
        });

    } catch (error) {
        console.error('[API PJN Detalle] Error:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}
