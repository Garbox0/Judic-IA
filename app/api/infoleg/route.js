import { NextResponse } from 'next/server';

const CAPTURE_URL = process.env.CAPTURE_SERVICE_URL || 'https://archivos.judic-ia.com';
const CAPTURE_KEY = process.env.CAPTURE_API_KEY || 'judicia-capture-2026';

export async function GET(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    if (!q) return NextResponse.json({ error: 'q requerido' }, { status: 400 });

    try {
        const res = await fetch(`${CAPTURE_URL}/infoleg?q=${encodeURIComponent(q)}`, {
            headers: { 'x-api-key': CAPTURE_KEY },
            next: { revalidate: 3600 },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Capture service respondió ${res.status}`);
        return NextResponse.json(data);
    } catch (err) {
        console.error('[InfoLeg API]', err.message);
        return NextResponse.json({ error: err.message }, { status: 502 });
    }
}
