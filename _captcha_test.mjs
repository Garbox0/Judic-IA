/**
 * Test E2E del Scraper PJN usando Gemini 2.5 Vision
 */
import { searchByExpediente } from './lib/captchaSolver.js';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function runTest() {
    console.log('=== INICIANDO TEST E2E (Gemini 2.5 Vision) ===');
    const start = Date.now();

    try {
        // Probamos una búsqueda por nombre para obtener una lista
        const result = await searchByParte({
            jurisdiccion: '1', // Civil
            nombre: 'GALLO'
        });

        const duration = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`\n=== RESULTADO (Tiempo: ${duration}s) ===`);

        if (result.error) {
            console.error('Error del scraper:', result.error);
        } else {
            console.log(`Expedientes encontrados: ${result.results?.length || 0}`);
            if (result.results?.length > 0) {
                console.log('Primer resultado:', JSON.stringify(result.results[0], null, 2));
            } else {
                console.log('No hubo resultados (pero el captcha pasó).');
            }
        }
    } catch (e) {
        console.error('FALLO FATAL:', e.message);
    }
}

runTest();
