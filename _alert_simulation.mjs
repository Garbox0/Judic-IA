/**
 * TEST: Simulación de Alerta Judicial para "OSDE"
 */
import { searchByParte } from './lib/captchaSolver.js';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function testAlertSystem() {
    console.log(`=== SIMULANDO ALERTA PARA: OSDE ===`);
    try {
        const result = await searchByParte({
            jurisdiccion: '1',
            nombre: 'OSDE'
        });

        console.log(`\n[Cron] Se encontraron ${result.results?.length || 0} expedientes.`);
        if (result.results?.length > 0) {
            result.results.slice(0, 10).forEach((r, i) => {
                console.log(`${i + 1}. ${r.expediente.padEnd(12)} | ${r.caratula.substring(0, 60)}`);
            });
        }
    } catch (e) { console.error('ERROR:', e.message); }
}
testAlertSystem();
