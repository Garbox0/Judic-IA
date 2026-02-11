import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Lazy load MinIO
let minioModule = null;
async function getMinio() {
    if (!minioModule) {
        const mod = await import('@/app/lib/minio');
        // mod.default is the client instance
        minioModule = {
            client: mod.default,
            ensureBucket: mod.ensureBucket,
            BUCKET_NAME: mod.BUCKET_NAME
        };
    }
    return minioModule;
}

/**
 * Robust Browser Launcher
 * Tries mostly safe serverless strategy (chromium + puppeteer-core)
 * Falls back to standard puppeteer (local dev / VPS with Chrome)
 */
async function launchBrowser() {
    let browser = null;

    // 1. Try serverless-friendly approach (if packages exist)
    try {
        const chromium = (await import('@sparticuz/chromium')).default;
        const puppeteerCore = (await import('puppeteer-core')).default;

        // Optimize for speed/lambda
        chromium.setHeadlessMode = true;
        chromium.setGraphicsMode = false;

        browser = await puppeteerCore.launch({
            args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
        console.log('🚀 Launched: puppeteer-core + @sparticuz/chromium');
    } catch (e) {
        // 2. Fallback to standard puppeteer (Dev / VPS)
        console.warn('⚠️ Serverless chrome failed, falling back to standard puppeteer:', e.message);
        try {
            const puppeteer = (await import('puppeteer')).default;
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            console.log('🚀 Launched: standard puppeteer');
        } catch (innerErr) {
            throw new Error(`Failed to launch browser. Serverless: ${e.message}. Standard: ${innerErr.message}`);
        }
    }
    return browser;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Security: Allowlist
    const ALLOWED_DOMAINS = [
        'saij.gob.ar', 'servicios.infoleg.gob.ar', 'infoleg.gob.ar',
        'pjn.gov.ar', 'csjn.gov.ar', 'scba.gov.ar', 'juba.scba.gov.ar',
        'justiciacordoba.gob.ar', 'tsjcordoba.gob.ar', 'archivos.judic-ia.com'
    ];

    try {
        const urlObj = new URL(targetUrl);
        if (!ALLOWED_DOMAINS.some(d => urlObj.hostname.endsWith(d))) {
            return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (targetUrl.includes('archivos.judic-ia.com')) {
        return NextResponse.redirect(targetUrl, 302);
    }

    const hash = crypto.createHash('md5').update(targetUrl).digest('hex');
    const objectName = `kb_${hash.substring(0, 12)}.pdf`;

    try {
        const { client: minioClient, ensureBucket, BUCKET_NAME } = await getMinio();
        await ensureBucket(); // Might fail silently, that's ok

        // 1. Check Cache
        try {
            const stat = await minioClient.statObject(BUCKET_NAME, objectName);
            if (stat) {
                console.log(`✅ KB Cache HIT: ${objectName}`);
                const stream = await minioClient.getObject(BUCKET_NAME, objectName);

                // Convert stream to Buffer for Next.js response compatibility
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                const buffer = Buffer.concat(chunks);

                return new NextResponse(buffer, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `inline; filename="${objectName}"`,
                        'Cache-Control': 'public, max-age=86400',
                        'X-KB-Cache': 'HIT',
                    },
                });
            }
        } catch (e) {
            console.log(`📦 KB Cache MISS: ${objectName}`);
        }

        // 2. Capture
        const browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1600 });

        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 45000 });

        // Cleanup DOM
        await page.evaluate(() => {
            const selectors = ['header', 'footer', 'nav', '.ads', '.cookie-banner', '#encabezado', '#pie', '.noprint'];
            selectors.forEach(s => document.querySelectorAll(s).forEach(e => e.remove()));
            document.body.style.background = "#fff";
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
        });

        await browser.close();

        // 3. Cache Upload
        try {
            await minioClient.putObject(BUCKET_NAME, objectName, Buffer.from(pdfBuffer), pdfBuffer.length, {
                'Content-Type': 'application/pdf',
                'x-amz-meta-original-url': targetUrl
            });
        } catch (e) {
            console.error('⚠️ MinIO upload failed', e.message);
        }

        return new NextResponse(Buffer.from(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${objectName}"`,
                'Cache-Control': 'public, max-age=86400',
                'X-KB-Cache': 'MISS',
            },
        });

    } catch (error) {
        console.error('❌ KB Proxy Error:', error);

        // FATAL ERROR FALLBACK (Try simple fetch as last resort)
        try {
            const res = await fetch(targetUrl);
            if (res.ok && res.headers.get('content-type')?.includes('pdf')) {
                return new NextResponse(await res.arrayBuffer(), {
                    headers: { 'Content-Type': 'application/pdf', 'X-KB-Cache': 'FALLBACK_FETCH' }
                });
            }
        } catch { }

        return NextResponse.json({
            error: 'KB Proxy Failed',
            details: error.message,
            hint: 'To fix 500 on Vercel: npm install puppeteer-core @sparticuz/chromium',
            code: error.code || 'UNKNOWN'
        }, { status: 500 });
    }
}
