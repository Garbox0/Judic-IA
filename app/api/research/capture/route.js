
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
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

        // 1. Launch Puppeteer
        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1600 });

        // 2. Navigate
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        // 3. Cleanup logic (from test script)
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

            // Standardization
            document.body.style.fontFamily = "'Roboto', 'Helvetica', 'Arial', sans-serif";
            document.body.style.fontSize = "12pt";
            document.body.style.lineHeight = "1.5";
            document.body.style.color = "#000";
            document.body.style.background = "#fff";
            document.body.style.margin = "0";
            document.body.style.padding = "20px";

            // Width fix
            document.querySelectorAll('table').forEach(t => {
                t.style.width = "100%";
                t.style.maxWidth = "none";
            });
        });

        // 4. Generate PDF Buffer
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
        });

        await browser.close();

        // 5. Upload to MinIO
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

        // 6. Return Public URL
        // Using the proxy domain structure we established: https://archivos.judic-ia.com/knowledge-base/...
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
