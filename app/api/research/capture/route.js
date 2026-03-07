
import { NextResponse } from 'next/server';
import minioClient, { ensureBucket, BUCKET_NAME } from '@/app/lib/minio';
import crypto from 'crypto';
import { verifyAuth } from '@/lib/api-auth';

export async function POST(request) {
    // 🛡️ Auth required (resource-intensive: Puppeteer + MinIO)
    const auth = await verifyAuth(request);
    if (auth.error) return auth.response;

    try {
        const body = await request.json();
        const { url, title } = body;

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        console.log(`📸 Capturing: ${url}`);

        let pdfBuffer;

        // --- DETECT IF URL IS ALREADY A PDF ---
        // If the URL points to a PDF file, download it directly instead of
        // rendering through Puppeteer (which would capture the browser's PDF
        // viewer UI, creating a nested "PDF of a PDF viewer").
        const isPdfUrl = url.toLowerCase().endsWith('.pdf');
        let isDirectPdf = isPdfUrl;

        if (!isPdfUrl) {
            // Check content-type via HEAD request for URLs that don't have .pdf extension
            try {
                const headRes = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(10000) });
                const ct = headRes.headers.get('content-type') || '';
                isDirectPdf = ct.includes('application/pdf');
            } catch {
                // If HEAD fails, assume it's HTML and proceed with Puppeteer
                isDirectPdf = false;
            }
        }

        if (isDirectPdf) {
            // 📥 Direct PDF download — bypass Puppeteer entirely
            console.log(`📥 Direct PDF detected, downloading: ${url}`);
            const pdfRes = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
            if (!pdfRes.ok) {
                throw new Error(`Failed to download PDF: ${pdfRes.status} ${pdfRes.statusText}`);
            }
            const arrayBuf = await pdfRes.arrayBuffer();
            pdfBuffer = Buffer.from(arrayBuf);
        } else {
            // 🖥️ HTML page — delegate Puppeteer rendering to Raspberry Pi Scraper
            console.log(`📡 Delegating capture to Raspberry Pi: ${url}`);
            const scraperTargetUrl = process.env.SCRAPER_URL ? process.env.SCRAPER_URL.replace('/search', '/capture') : 'http://judicia-scraper.local:3100/capture';
            const scraperToken = process.env.SCRAPER_SECRET || 'Cthulhu_Scraper_2025_Secret!';

            const resScraper = await fetch(scraperTargetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-scraper-token': scraperToken
                },
                body: JSON.stringify({ url })
            });

            if (!resScraper.ok) {
                const errText = await resScraper.text().catch(() => '');
                throw new Error(`La Pi devolvió error ${resScraper.status} al capturar el PDF: ${errText}`);
            }

            const arrayBuf = await resScraper.arrayBuffer();
            pdfBuffer = Buffer.from(arrayBuf);
        }

        // Upload to MinIO
        await ensureBucket();

        // Generate a unique filename based on URL hash or title
        const hash = crypto.createHash('md5').update(url).digest('hex');
        const cleanTitle = (title || 'document').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const objectName = `${cleanTitle}_${hash.substring(0, 8)}.pdf`;

        console.log(`🚀 Uploading to MinIO: ${objectName}`);

        await minioClient.putObject(BUCKET_NAME, objectName, Buffer.from(pdfBuffer), pdfBuffer.length, {
            'Content-Type': 'application/pdf',
            'x-amz-meta-original-url': url
        });

        // Return Public URL
        const publicUrl = `https://archivos.judic-ia.com/${BUCKET_NAME}/${objectName}`;

        return NextResponse.json({
            success: true,
            url: publicUrl,
            objectName: objectName
        });

    } catch (error) {
        console.error("Capture Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
