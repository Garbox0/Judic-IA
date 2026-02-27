import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getDepartamentoScbaById } from './lib/scba_jurisdicciones.js';
import { getFueroScbaById } from './lib/scba_fueros.js';

puppeteer.use(StealthPlugin());

const SCBA_MEV_URL = 'https://mev.scba.gov.ar/';

/**
 * Proof of Concept: Scraper de la MEV (SCBA)
 * Este es un esqueleto del módulo que se integrará con el alertEngine.
 */
export async function searchMEV({ deptoId, fueroId, tipoBusqueda, queryValue }) {
    console.log(`[SCBA Scraper] Iniciando búsqueda: Depto ${deptoId}, Fuero ${fueroId}, Buscando: ${queryValue}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const results = {
        success: false,
        data: [],
        message: ''
    };

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36');

        console.log(`[SCBA Scraper] Ingresando a la MEV...`);
        await page.goto(SCBA_MEV_URL, { waitUntil: 'networkidle2' });

        // Simulación: El proceso real requeriría navegar los frames de la MEV, seleccionar los selects
        // correspondientes al depto (e.g. "LP" para La Plata) e interactuar con el formulario de búsqueda real.
        // Dado el alcance de este PoC nocturno, simularemos el tiempo de respuesta del portal.

        await new Promise(r => setTimeout(r, 2000));

        console.log(`[SCBA Scraper] Seleccionando Departamento y Fuero...`);
        // await page.select('select[name="DeptoRegistrado"]', deptoId);

        console.log(`[SCBA Scraper] Ingresando búsqueda por ${tipoBusqueda}: ${queryValue}`);
        // await page.type('input[name="buscar"]', queryValue);
        // await page.click('input[type="submit"]');

        await new Promise(r => setTimeout(r, 2000));

        // Simular que encontró expedientes
        results.success = true;
        results.message = 'Simulación completada con éxito';
        results.data = [
            {
                expediente: 'LP-12345-2023',
                caratula: `${queryValue} C/ ESTADO PROVINCIAL S/ DAÑOS Y PERJUICIOS`,
                estado: 'En Letra',
                ultimaActuacion: new Date().toLocaleDateString()
            },
            {
                expediente: 'LP-98765-2022',
                caratula: `BANCO PROVINCIA C/ ${queryValue} S/ COBRO EJECUTIVO`,
                estado: 'Despacho',
                ultimaActuacion: new Date(Date.now() - 86400000).toLocaleDateString()
            }
        ];

        console.log(`[SCBA Scraper] Búsqueda finalizada. Extractados ${results.data.length} expedientes.`);

    } catch (err) {
        console.error('[SCBA Scraper] Error crítico:', err);
        results.message = err.message;
    } finally {
        await browser.close();
    }

    return results;
}

// Bloque de prueba local si se llama directamente con node
if (process.argv[1].endsWith('_scba_poc.mjs')) {
    (async () => {
        const res = await searchMEV({
            deptoId: 'LP', // La Plata
            fueroId: 'CC', // Civil y Comercial
            tipoBusqueda: 'actor_demandado',
            queryValue: 'MERCADO LIBRE SRL'
        });
        console.log('\n--- Resultado Final ---');
        console.log(JSON.stringify(res, null, 2));
    })();
}
