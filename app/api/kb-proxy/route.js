import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * GET /api/kb-proxy?url=<encoded_url>
 * 
 * Proxies Knowledge Base resources. Checks MinIO cache first,
 * then calls VPS capture service for PDF generation.
 * Returns the PDF or redirects to cached version.
 */

const CAPTURE_SERVICE_URL = process.env.CAPTURE_SERVICE_URL || 'https://archivos.judic-ia.com';
const CAPTURE_API_KEY = process.env.CAPTURE_API_KEY || 'judicia-capture-2026';

// Security: only these domains are proxied
const ALLOWED_DOMAINS = [
    'saij.gob.ar', 'servicios.infoleg.gob.ar', 'infoleg.gob.ar',
    'pjn.gov.ar', 'csjn.gov.ar', 'scba.gov.ar', 'juba.scba.gov.ar',
    'justiciacordoba.gob.ar', 'tsjcordoba.gob.ar', 'archivos.judic-ia.com',
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

    // 2. Call VPS capture service
    try {
        console.log(`📸 Requesting capture from VPS: ${targetUrl}`);

        const captureRes = await fetch(`${CAPTURE_SERVICE_URL}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CAPTURE_API_KEY,
            },
            body: JSON.stringify({ url: targetUrl, title }),
            signal: AbortSignal.timeout(90000), // 90s timeout for capture
        });

        if (!captureRes.ok) {
            const err = await captureRes.json().catch(() => ({}));
            console.error('❌ VPS capture failed:', err);
            // Fallback to HTML proxy
            return proxyHtml(targetUrl);
        }

        const result = await captureRes.json();

        if (result.success && result.url) {
            console.log(`🚀 PDF ready: ${result.url} (cached: ${result.cached})`);
            return NextResponse.redirect(result.url, 302);
        }

        // Unexpected response, fallback
        return proxyHtml(targetUrl);

    } catch (error) {
        console.error('❌ Capture service error:', error.message);
        // Fallback: proxy the HTML directly
        return proxyHtml(targetUrl);
    }
}

/**
 * Fallback: proxy the HTML page directly (no PDF conversion).
 * Used when capture service is unavailable.
 */
async function proxyHtml(targetUrl) {
    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-AR,es;q=0.9',
            },
        });

        if (!response.ok) {
            return NextResponse.json({ error: `Upstream: ${response.status}` }, { status: response.status });
        }

        const contentType = response.headers.get('content-type') || 'text/html';

        // Direct PDF — stream it through
        if (contentType.includes('application/pdf')) {
            return new NextResponse(await response.arrayBuffer(), {
                headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'public, max-age=86400' },
            });
        }

        // HTML — inject <base> for relative URLs
        let html = await response.text();
        const baseOrigin = new URL(targetUrl).origin;
        const baseTag = `<base href="${baseOrigin}/">`;

        if (/<head[^>]*>/i.test(html)) {
            html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}`);
        } else {
            html = `${baseTag}\n${html}`;
        }

        return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
        });
    } catch (err) {
        return NextResponse.json({ error: 'Proxy failed', details: err.message }, { status: 500 });
    }
}
