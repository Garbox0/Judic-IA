/**
 * TEST: Búsqueda por Número Real para validar el Parser Final
 */
import { searchByExpediente } from './lib/captchaSolver.js';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function testFinal() {
    console.log('=== TEST FINAL: Expediente 1111/2024 en Civil y Comercial Fed. ===');
    try {
        const result = await searchByExpediente({
            jurisdiccion: '1',
            numero: '1111',
            anio: '2024'
        });

        console.log(`\nResultados: ${result.results?.length || 0}`);
        if (result.results?.length > 0) {
            console.log('DATA:', JSON.stringify(result.results, null, 2));
        } else {
            console.log('Sin resultados.');
            console.log('Error o Mensaje:', result.error || 'Ninguno');
        }
    } catch (e) { console.error('ERROR:', e.message); }
}
testFinal();
