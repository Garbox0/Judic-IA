import { NextResponse } from 'next/server';
import https from 'https';

// Create an agent that ignores SSL errors (common in gov.ar sites)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }

    try {
        // HACK: Bypass SSL for government sites
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
                // Important to allow iframe
                'X-Frame-Options': 'ALLOW',
                'Access-Control-Allow-Origin': '*'
            },
        });

    } catch (error) {
        console.error("Proxy Error:", error);
        return NextResponse.json({ error: 'Error fetching PDF' }, { status: 500 });
    } finally {
        // Restore SSL security
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
    }
}
