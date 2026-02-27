/**
 * TEST: Buscando expedientes "frescos" de Febrero 2026
 */
import { searchByExpediente } from './lib/captchaSolver.js';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function findTodayCases() {
    console.log('=== BUSCANDO EXPEDIENTES DE HOY (25/02/2026) en CNT ===');

    // Probamos números altos del 2026 en la Justicia del Trabajo (Jurisdicción 10)
    // que es la que tiene más volumen diario.
    const probeNumbers = [500, 1000, 2000];

    for (const num of probeNumbers) {
        console.log(`\nProbandio con número: ${num}/2026...`);
        try {
            const result = await searchByExpediente({
                jurisdiccion: '10',
                numero: num,
                anio: '2026'
            });

            if (result.results?.length > 0) {
                console.log(`¡ENCONTRADO!`);
                result.results.slice(0, 2).forEach(r => {
                    console.log(`- ${r.expediente} | ${r.caratula} | ${r.dependencia}`);
                });
            } else {
                console.log(`El número ${num} todavía no fue asignado o no es público.`);
            }
        } catch (e) {
            console.log(`Error probando ${num}: ${e.message}`);
        }
    }
}

findTodayCases();
