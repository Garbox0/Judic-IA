/**
 * 🏛️ Judic-IA — KB Capture Service (VPS Microservice)
 * 
 * Standalone Express server that runs on the VPS (Hostinger).
 * Receives URLs, captures them as PDFs using Puppeteer, uploads to MinIO.
 * 
 * Usage:
 *   CAPTURE_API_KEY=secreto MINIO_ACCESS_KEY=xxx MINIO_SECRET_KEY=xxx node capture-service.js
 * 
 * Or with pm2:
 *   pm2 start capture-service.js --name judicia-capture -- --port 3001
 */

const express = require('express');
const puppeteer = require('puppeteer');
const Minio = require('minio');
const crypto = require('crypto');

// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════
const PORT = process.env.CAPTURE_PORT || 3001;
const API_KEY = process.env.CAPTURE_API_KEY || 'judicia-capture-2026';
const BUCKET_NAME = 'knowledge-base';

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
});

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://archivos.judic-ia.com';

// ═══════════════════════════════════════════
// EXPRESS APP
// ═══════════════════════════════════════════
const app = express();
app.use(express.json());

// Auth middleware
app.use((req, res, next) => {
    // Health check is public
    if (req.path === '/health') return next();

    const key = req.headers['x-api-key'];
    if (key !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// ═══════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'judicia-capture', uptime: process.uptime() });
});

// ═══════════════════════════════════════════
// POST /capture
// ═══════════════════════════════════════════
app.post('/capture', async (req, res) => {
    const { url, title } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`📸 Capture request: ${url}`);

    // Generate consistent filename from URL
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const cleanTitle = (title || 'document')
        .replace(/[^a-z0-9áéíóúñü]/gi, '_')
        .replace(/_+/g, '_')
        .toLowerCase()
        .substring(0, 60);
    const objectName = `${cleanTitle}_${hash.substring(0, 8)}.pdf`;

    // 1. Check MinIO cache first
    try {
        const stat = await minioClient.statObject(BUCKET_NAME, objectName);
        if (stat) {
            const publicUrl = `${PUBLIC_BASE_URL}/${BUCKET_NAME}/${objectName}`;
            console.log(`✅ Cache HIT: ${objectName}`);
            return res.json({
                success: true,
                url: publicUrl,
                objectName,
                cached: true
            });
        }
    } catch (e) {
        // Not in cache, proceed to capture
        console.log(`📦 Cache MISS: ${objectName}`);
    }

    let browser = null;
    try {
        // 2. Launch Puppeteer
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1600 });

        // 3. Navigate to the page
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        // 4. Cleanup DOM (remove fluff, standardize styling)
        await page.evaluate(() => {
            const selectorsToRemove = [
                'table[background="im/fondo.jpg"]',
                'img',
                '.noprint',
                '#encabezado',
                '#pie',
                'header',
                'footer',
                'nav',
                '.ads',
                '.cookie-banner',
                'script',
                'noscript',
            ];
            selectorsToRemove.forEach(selector => {
                document.querySelectorAll(selector).forEach(e => e.remove());
            });

            // Standardize styling for clean PDF output
            document.body.style.fontFamily = "'Roboto', 'Helvetica', 'Arial', sans-serif";
            document.body.style.fontSize = "12pt";
            document.body.style.lineHeight = "1.5";
            document.body.style.color = "#000";
            document.body.style.background = "#fff";
            document.body.style.margin = "0";
            document.body.style.padding = "20px";

            // Fix table widths
            document.querySelectorAll('table').forEach(t => {
                t.style.width = "100%";
                t.style.maxWidth = "none";
            });
        });

        // 5. Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
        });

        await browser.close();
        browser = null;

        // 6. Ensure bucket exists
        try {
            const exists = await minioClient.bucketExists(BUCKET_NAME);
            if (!exists) {
                await minioClient.makeBucket(BUCKET_NAME, '');
                // Set public read policy
                const policy = {
                    Version: "2012-10-17",
                    Statement: [{
                        Effect: "Allow",
                        Principal: { AWS: ["*"] },
                        Action: ["s3:GetObject"],
                        Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
                    }]
                };
                await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
                console.log(`🪣 Created bucket: ${BUCKET_NAME}`);
            }
        } catch (bucketErr) {
            console.error('Bucket check/create error:', bucketErr.message);
        }

        // 7. Upload to MinIO
        await minioClient.putObject(
            BUCKET_NAME,
            objectName,
            Buffer.from(pdfBuffer),
            pdfBuffer.length,
            {
                'Content-Type': 'application/pdf',
                'x-amz-meta-original-url': url,
            }
        );

        const publicUrl = `${PUBLIC_BASE_URL}/${BUCKET_NAME}/${objectName}`;
        console.log(`🚀 Captured & uploaded: ${objectName} → ${publicUrl}`);

        return res.json({
            success: true,
            url: publicUrl,
            objectName,
            cached: false,
        });

    } catch (error) {
        console.error('❌ Capture error:', error.message);
        return res.status(500).json({
            error: 'Capture failed',
            details: error.message,
        });
    } finally {
        if (browser) {
            try { await browser.close(); } catch { }
        }
    }
});

// ═══════════════════════════════════════════
// GET /audit — Run KB audit (called from admin panel)
// ═══════════════════════════════════════════
app.get('/audit', async (req, res) => {
    console.log('🔍 Audit request received');
    try {
        const { runAudit } = require('./kb-audit');
        const report = await runAudit();
        res.json({ success: true, report });
    } catch (error) {
        console.error('❌ Audit error:', error.message);
        res.status(500).json({ error: 'Audit failed', details: error.message });
    }
});

// ═══════════════════════════════════════════
// POST /audit/fix-urls — Fix broken PDF URLs in DB
// ═══════════════════════════════════════════
app.post('/audit/fix-urls', async (req, res) => {
    console.log('🔧 Fix broken URLs request received');
    try {
        const { fixBrokenUrls } = require('./kb-audit');
        const result = await fixBrokenUrls();
        res.json({ success: true, result });
    } catch (error) {
        console.error('❌ Fix URLs error:', error.message);
        res.status(500).json({ error: 'Fix failed', details: error.message });
    }
});

// ═══════════════════════════════════════════
// POST /audit/clean-orphans — Delete orphan files from MinIO
// ═══════════════════════════════════════════
app.post('/audit/clean-orphans', async (req, res) => {
    console.log('🧹 Clean orphans request received');
    try {
        const { cleanOrphanFiles } = require('./kb-audit');
        const result = await cleanOrphanFiles();
        res.json({ success: true, result });
    } catch (error) {
        console.error('❌ Clean orphans error:', error.message);
        res.status(500).json({ error: 'Clean failed', details: error.message });
    }
});

// ═══════════════════════════════════════════
// START
// ═══════════════════════════════════════════
app.listen(PORT, () => {
    console.log(`\n🏛️  Judic-IA Capture Service`);
    console.log(`   Port: ${PORT}`);
    console.log(`   MinIO: ${process.env.MINIO_ENDPOINT || '127.0.0.1'}:${process.env.MINIO_PORT || '9000'}`);
    console.log(`   Bucket: ${BUCKET_NAME}`);
    console.log(`   Public URL: ${PUBLIC_BASE_URL}`);
    console.log(`   Ready! 🚀\n`);
});
