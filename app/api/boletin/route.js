import { NextResponse } from 'next/server';

const SECCIONES_VALIDAS = ['primera', 'segunda', 'tercera', 'cuarta'];
const CAPTURE_URL = process.env.CAPTURE_SERVICE_URL || 'https://archivos.judic-ia.com';
const CAPTURE_KEY = process.env.CAPTURE_API_KEY || 'judicia-capture-2026';

export async function GET(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const seccion = SECCIONES_VALIDAS.includes(searchParams.get('seccion')) ? searchParams.get('seccion') : 'primera';
    const q = searchParams.get('q') || '';

    try {
        const params = new URLSearchParams({ seccion });
        if (q) params.set('q', q);

        const res = await fetch(`${CAPTURE_URL}/boletin?${params}`, {
            headers: { 'x-api-key': CAPTURE_KEY },
            next: { revalidate: 1800 },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Capture service respondió ${res.status}`);

        return NextResponse.json(data);
    } catch (err) {
        console.error('[Boletin API]', err.message);
        return NextResponse.json({ error: err.message, items: [], seccion }, { status: 502 });
    }
}
