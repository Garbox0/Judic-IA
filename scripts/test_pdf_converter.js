const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// TARGET: Constitución Nacional (InfoLeg)
const TEST_URL = "https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/638/texact.htm";
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'legislation', 'ley-defensa-consumidor.pdf');

(async () => {
    console.log('🚀 Starting PDF Printer Probe...');
    console.log(`🌍 Target: ${TEST_URL}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Optimized viewport for reading
    await page.setViewport({ width: 1200, height: 1600 });

    console.log('⏳ Navigating...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle0', timeout: 60000 });

    console.log('🧹 Cleaning up InfoLeg clutter...');
    // InfoLeg cleanup magic: Remove headers, sidebars, and make it look like a document
    await page.evaluate(() => {
        // InfoLeg specific cleanup
        const elementsToRemove = [
            'table[background="im/fondo.jpg"]', // Old background tables
            'img', // Often useless logos in header
            '.noprint',
            '#encabezado',
            '#pie'
        ];

        elementsToRemove.forEach(selector => {
            document.querySelectorAll(selector).forEach(e => e.remove());
        });

        // Typography standardization
        document.body.style.fontFamily = "'Roboto', 'Helvetica', 'Arial', sans-serif";
        document.body.style.fontSize = "12pt";
        document.body.style.lineHeight = "1.5";
        document.body.style.color = "#000";
        document.body.style.background = "#fff";
        document.body.style.margin = "0";
        document.body.style.padding = "20px";

        // Center the main content if it's in a table (typical InfoLeg)
        const tables = document.querySelectorAll('table');
        tables.forEach(t => {
            t.style.width = "100%";
            t.style.maxWidth = "none";
        });
    });

    console.log('🖨️  Printing to PDF...');
    await page.pdf({
        path: OUTPUT_FILE,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20mm',
            bottom: '20mm',
            left: '20mm',
            right: '20mm'
        }
    });

    await browser.close();
    console.log(`✅ Success! Generated: ${OUTPUT_FILE}`);
    console.log(`📊 Size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
})();
