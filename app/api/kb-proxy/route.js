import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Lazy import puppeteer only when needed (heavy dependency)
let puppeteerModule = null;
async function getPuppeteer() {
    if (!puppeteerModule) {
        puppeteerModule = (await import('puppeteer')).default;
    }
    return puppeteerModule;
}

// Lazy import minio
let minioModule = null;
async function getMinio() {
    if (!minioModule) {
        const mod = await import('@/app/lib/minio');
        minioModule = { client: mod.default, ensureBucket: mod.ensureBucket, BUCKET_NAME: mod.BUCKET_NAME };
    }
    return minioModule;
}

/**
 * GET /api/kb-proxy?url=<encoded_url>
 * 
 * Lazy-capture proxy for Knowledge Base resources.
 * 1. Checks MinIO cache for an existing PDF
 * 2. If not cached, uses Puppeteer to capture the page as PDF
 * 3. Uploads to MinIO for future requests
 * 4. Returns the PDF stream
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Security: Only allow known legal domains
    const ALLOWED_DOMAINS = [
        'saij.gob.ar',
        'servicios.infoleg.gob.ar',
        'infoleg.gob.ar',
        'pjn.gov.ar',
        'csjn.gov.ar',
        'scba.gov.ar',
        'juba.scba.gov.ar',
        'justiciacordoba.gob.ar',
        'tsjcordoba.gob.ar',
        'archivos.judic-ia.com', // Our own CDN
    ];

    try {
        const urlObj = new URL(targetUrl);
        const isAllowed = ALLOWED_DOMAINS.some(d => urlObj.hostname.endsWith(d));

        if (!isAllowed) {
            console.warn(`⛔ KB Proxy blocked unauthorized domain: ${urlObj.hostname}`);
            return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // If it's already our CDN, just redirect
    if (targetUrl.includes('archivos.judic-ia.com')) {
        return NextResponse.redirect(targetUrl, 302);
    }

    // Generate deterministic filename from URL hash (same as capture route)
    const hash = crypto.createHash('md5').update(targetUrl).digest('hex');
    const objectName = `kb_${hash.substring(0, 12)}.pdf`;

    try {
        // 1. Check MinIO cache first
        const { client: minioClient, ensureBucket, BUCKET_NAME } = await getMinio();
        await ensureBucket();

        try {
            const stat = await minioClient.statObject(BUCKET_NAME, objectName);
            if (stat) {
                console.log(`✅ KB Cache HIT: ${objectName}`);
                // Stream from MinIO
                const stream = await minioClient.getObject(BUCKET_NAME, objectName);
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);

                return new NextResponse(buffer, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `inline; filename="${objectName}"`,
                        'Cache-Control': 'public, max-age=86400', // 24h browser cache
                        'X-KB-Cache': 'HIT',
                    },
                });
            }
        } catch (e) {
            // Object doesn't exist in MinIO, proceed to capture
            console.log(`📦 KB Cache MISS: ${objectName}, will capture...`);
        }

        // 2. Not cached → Use Puppeteer to capture
        console.log(`📸 KB Proxy: Capturing ${targetUrl}`);
        const puppeteer = await getPuppeteer();

        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1600 });

        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        // Cleanup: remove nav, ads, images, standardize styles
        await page.evaluate(() => {
            const elementsToRemove = [
                'table[background="im/fondo.jpg"]',
                'img',
                '.noprint',
                '#encabezado',
                '#pie',
                'header',
                'footer',
                'nav',
                '.ads',
                '.cookie-banner'
            ];
            elementsToRemove.forEach(selector => {
                document.querySelectorAll(selector).forEach(e => e.remove());
            });

            // Standardize appearance
            document.body.style.fontFamily = "'Roboto', 'Helvetica', 'Arial', sans-serif";
            document.body.style.fontSize = "12pt";
            document.body.style.lineHeight = "1.5";
            document.body.style.color = "#000";
            document.body.style.background = "#fff";
            document.body.style.margin = "0";
            document.body.style.padding = "20px";

            document.querySelectorAll('table').forEach(t => {
                t.style.width = "100%";
                t.style.maxWidth = "none";
            });
        });

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
        });

        await browser.close();

        // 3. Upload to MinIO for cache
        try {
            await minioClient.putObject(BUCKET_NAME, objectName, Buffer.from(pdfBuffer), pdfBuffer.length, {
                'Content-Type': 'application/pdf',
                'x-amz-meta-original-url': targetUrl
            });
            console.log(`🚀 KB Proxy: Cached as ${objectName}`);
        } catch (uploadErr) {
            console.error('⚠️ MinIO upload failed (serving anyway):', uploadErr.message);
        }

        // 4. Return the PDF
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

        return NextResponse.json({
            error: 'KB Proxy Failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            code: error.code || 'UNKNOWN_ERROR'
        }, { status: 500 });
    }
}
