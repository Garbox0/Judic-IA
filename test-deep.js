const { searchByExpediente } = require('./lib/captchaSolver.js');

(async () => {
    try {
        console.log('Iniciando prueba de scraper...');
        const res = await searchByExpediente({
            jurisdiccion: '0', // CSJ
            jurisdictionName: 'CSJN',
            numero: '1',
            anio: '2026'
        });

        console.log('Resultado completo:', JSON.stringify(res, null, 2));

        if (res.results && res.results[0] && res.results[0].detalle) {
            console.log('Actuaciones extraídas:', res.results[0].detalle.actuaciones.length);
        } else {
            console.log('No se encontró detalle o resultados.');
        }
    } catch (e) {
        console.error('Error:', e);
    }
})();
