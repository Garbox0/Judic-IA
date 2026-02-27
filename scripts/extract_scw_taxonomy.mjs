import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync } from 'fs';

puppeteer.use(StealthPlugin());

const SCW_URL = 'https://scw.pjn.gov.ar/scw/home.seam';

async function extractTaxonomy() {
    console.log('[PJN Taxonomy] Lanzando navegador...');
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        );
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9' });
        await page.setViewport({ width: 1280, height: 900 });

        console.log('[PJN Taxonomy] Navegando al Portal SCW...');
        await page.goto(SCW_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        console.log('[PJN Taxonomy] Extrayendo opciones de Jurisdicción...');

        // El SCW suele tener selects. Vamos a buscar todos los select.
        const taxonomy = await page.evaluate(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            const data = {};

            selects.forEach(select => {
                const options = Array.from(select.options).map(opt => ({
                    value: opt.value,
                    text: opt.textContent.trim()
                })).filter(opt => opt.value && opt.text && opt.text !== 'Seleccione...');

                // Intentar deducir qué es el select por su name o id
                const name = select.name || select.id || 'desconocido';
                if (options.length > 0) {
                    data[name] = options;
                }
            });

            return data;
        });

        console.log(`[PJN Taxonomy] Extracción completada. Se encontraron ${Object.keys(taxonomy).length} listas desplegables.`);

        // Guardar resultado puro
        writeFileSync('_pjn_raw_taxonomy.json', JSON.stringify(taxonomy, null, 2));
        console.log('[PJN Taxonomy] Guardado en _pjn_raw_taxonomy.json');

    } catch (err) {
        console.error('[PJN Taxonomy] Error:', err.message);
    } finally {
        await browser.close();
        console.log('[PJN Taxonomy] Navegador cerrado.');
    }
}

extractTaxonomy();
