import { NextResponse } from 'next/server';
import https from 'https';

// 🛡️ ALLOWED DOMAINS for PDF proxy (prevents SSRF)
// Only judicial/government domains that legitimately need SSL bypass
const ALLOWED_DOMAINS = [
    '.gov.ar',
    '.gob.ar',
    '.judiciary.gov.ar',
    'archivos.judic-ia.com',
];

function isAllowedUrl(url) {
    try {
        const parsed = new URL(url);
        // Block internal/private IPs
        const hostname = parsed.hostname.toLowerCase();
        if (hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('172.') ||
            hostname === '0.0.0.0' ||
            hostname === '169.254.169.254' || // AWS metadata
            hostname.endsWith('.internal') ||
            hostname.endsWith('.local')) {
            return false;
        }
        // Only allow HTTPS
        if (parsed.protocol !== 'https:') return false;
        // Check against allowed domain suffixes
        return ALLOWED_DOMAINS.some(d => hostname.endsWith(d));
    } catch {
        return false;
    }
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }

    // 🛡️ SSRF Protection: Only allow whitelisted domains
    if (!isAllowedUrl(targetUrl)) {
        console.warn(`🚫 Proxy blocked non-whitelisted URL: ${targetUrl}`);
        return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
    }

    try {
        // SSL bypass only for whitelisted government sites
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/pdf,application/octet-stream,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });

        if (!response.ok) {
            console.error(`Proxy Failed: ${response.status} ${response.statusText}`);
            return NextResponse.json({ error: 'Failed' }, { status: response.status });
        }

        const blob = await response.blob();
        const contentType = response.headers.get('content-type') || 'application/pdf';

        return new NextResponse(blob, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': 'inline',
                'Cache-Control': 'public, max-age=3600',
                'X-Frame-Options': 'SAMEORIGIN',
            },
        });

    } catch (error) {
        console.error("Proxy Error:", error);
        return NextResponse.json({ error: 'Error fetching PDF' }, { status: 500 });
    } finally {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
    }
}
