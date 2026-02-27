/**
 * Proxy de documentos PJN SCW
 *
 * GET /api/pjn/doc?token=<sessionToken>&url=<encodedURL>
 *
 * Usa las cookies de la sesión Puppeteer guardadas en el cache
 * para fetchear el documento del portal PJN y proxyarlo al cliente.
 * No requiere un nuevo captcha.
 */
import { NextResponse } from 'next/server';
import { getPjnSession } from '../../../../lib/pjnSessionCache.js';

const ALLOWED_HOST = 'scw.pjn.gov.ar';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const token  = searchParams.get('token');
    const rawUrl = searchParams.get('url');

    if (!token || !rawUrl) {
        return NextResponse.json({ error: 'Faltan parámetros token o url.' }, { status: 400 });
    }

    // Validar que la URL sea del dominio PJN
    let targetUrl;
    try {
        targetUrl = new URL(rawUrl);
        if (targetUrl.hostname !== ALLOWED_HOST) {
            return NextResponse.json({ error: 'URL no permitida.' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'URL inválida.' }, { status: 400 });
    }

    // Recuperar cookies de sesión
    const cookieHeader = getPjnSession(token);
    if (!cookieHeader) {
        return NextResponse.json(
            { error: 'Sesión expirada o inválida. Volvé a cargar el detalle del expediente.' },
            { status: 401 }
        );
    }

    try {
        const pjnRes = await fetch(targetUrl.toString(), {
            headers: {
                'Cookie':          cookieHeader,
                'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0',
                'Referer':         'https://scw.pjn.gov.ar/scw/',
                'Accept':          'application/pdf,text/html,*/*;q=0.8',
                'Accept-Language': 'es-AR,es;q=0.9',
            },
        });

        if (!pjnRes.ok) {
            return NextResponse.json(
                { error: `El portal PJN devolvió ${pjnRes.status}. La sesión puede haber expirado.` },
                { status: 502 }
            );
        }

        const contentType = pjnRes.headers.get('content-type') || 'application/octet-stream';
        const contentDisposition = pjnRes.headers.get('content-disposition') || '';
        const buffer = await pjnRes.arrayBuffer();

        // Proxy transparente — el navegador decide si renderiza o descarga
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type':        contentType,
                'Content-Disposition': contentDisposition || 'inline',
                'Content-Length':      String(buffer.byteLength),
                'Cache-Control':       'private, max-age=600',
            },
        });
    } catch (err) {
        console.error('[PJN Doc Proxy] Error:', err.message);
        return NextResponse.json({ error: err.message || 'Error al obtener el documento.' }, { status: 500 });
    }
}
