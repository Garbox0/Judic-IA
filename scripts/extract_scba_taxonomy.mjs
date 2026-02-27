import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync } from 'fs';

puppeteer.use(StealthPlugin());

// Usaremos la MEV (Mesa de Entradas Virtual) de la SCBA que es de acceso público
const SCBA_MEV_URL = 'https://mev.scba.gov.ar/';

async function extractTaxonomySCBA() {
    console.log('[SCBA Taxonomy] Lanzando navegador...');
    const browser = await puppeteer.launch({
        headless: true, // Empezamos headless para ser rápidos
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
        await page.setViewport({ width: 1280, height: 900 });

        console.log('[SCBA Taxonomy] Navegando a la MEV de Provincia de Buenos Aires...');
        await page.goto(SCBA_MEV_URL, { waitUntil: 'networkidle2', timeout: 30000 });

        // Esperamos un momento a que renderice la página principal
        await new Promise(r => setTimeout(r, 2000));

        console.log('[SCBA Taxonomy] Buscando departamentos judiciales...');

        // Extraemos los departamentos de la MEV
        const taxonomy = await page.evaluate(() => {
            // Buscamos selects u opciones en la página principal 
            // La MEV de PBA suele tener un desplegable o lista de departamentos
            const selects = Array.from(document.querySelectorAll('select'));
            const data = {};

            selects.forEach(select => {
                const options = Array.from(select.options).map(opt => ({
                    value: opt.value,
                    text: opt.textContent.trim()
                })).filter(opt => opt.value && opt.text && !opt.text.toLowerCase().includes('seleccione'));

                const name = select.name || select.id || 'desconocido';
                if (options.length > 0) {
                    data[name] = options;
                }
            });

            // Si no hay selects obvios, buscamos enlaces a los departamentos (href que apunte a subdominios o rutas)
            const links = Array.from(document.querySelectorAll('a'))
                .map(a => ({ text: a.textContent.trim(), href: a.href }))
                .filter(a => a.text && a.href && a.text.length > 3 && a.text.length < 50);

            return { selects: data, potential_links: links };
        });

        console.log(`[SCBA Taxonomy] Resultados iniciales:`);
        console.log(`- Selects encontrados: ${Object.keys(taxonomy.selects).length}`);
        console.log(`- Enlaces potenciales: ${taxonomy.potential_links.length}`);

        // Guardar resultado
        writeFileSync('_scba_raw_taxonomy.json', JSON.stringify(taxonomy, null, 2));
        console.log('[SCBA Taxonomy] Guardado en _scba_raw_taxonomy.json');

        // Captura de pantalla para ver qué estamos pisando
        await page.screenshot({ path: '_scba_screen.png', fullPage: true });
        console.log('[SCBA Taxonomy] Captura de pantalla guardada en _scba_screen.png');

    } catch (err) {
        console.error('[SCBA Taxonomy] Error:', err.message);
    } finally {
        await browser.close();
        console.log('[SCBA Taxonomy] Navegador cerrado.');
    }
}

extractTaxonomySCBA();
