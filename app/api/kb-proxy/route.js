import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * GET /api/kb-proxy?url=<encoded_url>&title=<title>
 * 
 * PDF-first KB proxy. Checks MinIO cache first,
 * then calls VPS capture service for PDF generation.
 * Always returns a PDF — no HTML fallback.
 */

const CAPTURE_SERVICE_URL = process.env.CAPTURE_SERVICE_URL || 'https://archivos.judic-ia.com';
const CAPTURE_API_KEY = process.env.CAPTURE_API_KEY || 'judicia-capture-2026';

// Security: only judicial/official domains are proxied (synced with research/route.js)
const ALLOWED_DOMAINS = [
    // Federales / Nacionales
    'csjn.gov.ar', 'pjn.gov.ar', 'cij.gov.ar',
    'saij.gob.ar', 'infojus.gob.ar',
    'mpf.gob.ar', 'mpd.gov.ar',
    'boletinoficial.gob.ar',
    'servicios.infoleg.gob.ar', 'infoleg.gob.ar',
    // Provinciales
    'scba.gov.ar', 'juba.scba.gov.ar', 'mpba.gov.ar',
    'jusbaires.gob.ar', 'tsjbaires.gov.ar', 'mptutelar.gob.ar',
    'justiciacordoba.gob.ar', 'tsjcordoba.gob.ar', 'web.justiciacordoba.gob.ar',
    'justiciasantafe.gov.ar', 'jussantafe.gov.ar',
    'jus.mendoza.gov.ar', 'poderjudicial.mendoza.gov.ar',
    'justucuman.gov.ar', 'poder-judicial.tucuman.gov.ar',
    'jusentrerios.gov.ar', 'justiciadesalta.gov.ar',
    'jusmisiones.gov.ar', 'juscorrientes.gov.ar',
    'justiciachaco.gov.ar', 'juschaco.gov.ar',
    'jussanjuan.gov.ar', 'jusformosa.gov.ar',
    'jusneuquen.gov.ar', 'jusrionegro.gov.ar',
    'juschubut.gov.ar', 'jussantacruz.gov.ar',
    'juslapampa.gob.ar', 'justiciasanluis.gov.ar',
    'juscatamarca.gob.ar', 'justicialarioja.gob.ar',
    'jussantiago.gov.ar', 'justiciajujuy.gov.ar',
    'justierradelfuego.gov.ar',
    // Interno
    'archivos.judic-ia.com',
];

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');
    const title = searchParams.get('title') || '';

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Validate domain
    try {
        const urlObj = new URL(targetUrl);
        if (!ALLOWED_DOMAINS.some(d => urlObj.hostname.endsWith(d))) {
            return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // If it's already our CDN, redirect directly
    if (targetUrl.includes('archivos.judic-ia.com')) {
        return NextResponse.redirect(targetUrl, 302);
    }

    // If the URL is already a direct PDF, proxy it through instead of capturing
    if (targetUrl.toLowerCase().endsWith('.pdf')) {
        try {
            console.log(`📎 Direct PDF proxy: ${targetUrl}`);
            const pdfRes = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/pdf,*/*',
                },
                signal: AbortSignal.timeout(30000),
            });

            if (!pdfRes.ok) {
                return NextResponse.json(
                    { error: `PDF source returned ${pdfRes.status}` },
                    { status: pdfRes.status === 404 ? 404 : 502 }
                );
            }

            const pdfBuffer = await pdfRes.arrayBuffer();
            return new NextResponse(pdfBuffer, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="${title || 'document'}.pdf"`,
                    'Cache-Control': 'public, max-age=86400',
                },
            });
        } catch (err) {
            console.error('❌ Direct PDF proxy failed:', err.message);
            return NextResponse.json(
                { error: 'Could not fetch PDF', details: err.message },
                { status: 502 }
            );
        }
    }

    // Generate the expected object name (same logic as capture service)
    const hash = crypto.createHash('md5').update(targetUrl).digest('hex');
    const cleanTitle = (title || 'document')
        .replace(/[^a-z0-9áéíóúñü]/gi, '_')
        .replace(/_+/g, '_')
        .toLowerCase()
        .substring(0, 60);
    const objectName = `${cleanTitle}_${hash.substring(0, 8)}.pdf`;
    const publicPdfUrl = `https://archivos.judic-ia.com/knowledge-base/${objectName}`;

    // 1. Check if PDF already exists on CDN (fast HEAD request)
    try {
        const headRes = await fetch(publicPdfUrl, { method: 'HEAD' });
        if (headRes.ok) {
            console.log(`✅ KB Cache HIT: ${objectName}`);
            return NextResponse.redirect(publicPdfUrl, 302);
        }
    } catch (e) {
        // CDN check failed, continue to capture
    }

    // 2. Call VPS capture service to generate PDF on-demand
    try {
        console.log(`📸 Requesting capture from VPS: ${targetUrl}`);

        const captureRes = await fetch(`${CAPTURE_SERVICE_URL}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CAPTURE_API_KEY,
            },
            body: JSON.stringify({ url: targetUrl, title }),
            signal: AbortSignal.timeout(90000),
        });

        if (!captureRes.ok) {
            const err = await captureRes.json().catch(() => ({}));
            console.error('❌ VPS capture failed:', err);
            return NextResponse.json(
                { error: 'PDF capture failed', details: err.error || 'Unknown error' },
                { status: 502 }
            );
        }

        const result = await captureRes.json();

        if (result.success && result.url) {
            console.log(`🚀 PDF ready: ${result.url} (cached: ${result.cached})`);
            return NextResponse.redirect(result.url, 302);
        }

        return NextResponse.json(
            { error: 'Capture returned unexpected response' },
            { status: 500 }
        );

    } catch (error) {
        console.error('❌ Capture service error:', error.message);
        return NextResponse.json(
            { error: 'Capture service unavailable', details: error.message },
            { status: 503 }
        );
    }
}
