const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_BASE = path.join(__dirname, '..', 'public', 'legislation');

const targets = [
    // --- NACION (Códigos de Fondo) ---
    { province: 'nacion', name: 'constitucion-nacional', url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/804/norma.htm' },
    { province: 'nacion', name: 'codigo-civil-comercial-nacion', url: 'https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=235975' },
    { province: 'nacion', name: 'codigo-penal-nacion', url: 'http://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/16546/texact.htm' },
    { province: 'nacion', name: 'ley-contrato-trabajo', url: 'http://servicios.infoleg.gob.ar/infolegInternet/anexos/25000-29999/25552/texact.htm' },
    { province: 'nacion', name: 'codigo-mineria', url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/40000-44999/43797/texact.htm' },
    { province: 'nacion', name: 'codigo-aduanero', url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/16536/texact.htm' },
    { province: 'nacion', name: 'codigo-aeronautico', url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/20000-24999/24963/texact.htm' },
    { province: 'nacion', name: 'codigo-alimentario', url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/20000-24999/21841/norma.htm' },
    { province: 'nacion', name: 'codigo-etica-publica', url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/55000-59999/55841/norma.htm' },
    { province: 'nacion', name: 'codigo-electoral-nacional', url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/19442/texact.htm' },

    // --- NACION (Leyes Especiales) ---
    { province: 'nacion', name: 'ley-defensa-consumidor', url: 'http://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/638/texact.htm' },
    { province: 'nacion', name: 'ley-concursos-quiebras', url: 'http://servicios.infoleg.gob.ar/infolegInternet/anexos/25000-29999/25379/texact.htm' },
    { province: 'nacion', name: 'ley-sociedades-comerciales', url: 'http://servicios.infoleg.gob.ar/infolegInternet/anexos/25000-29999/25553/texact.htm' },
    { province: 'nacion', name: 'ley-riesgos-trabajo', url: 'http://servicios.infoleg.gob.ar/infolegInternet/anexos/25000-29999/27971/texact.htm' },
    { province: 'nacion', name: 'ley-procedimiento-administrativo', url: 'http://servicios.infoleg.gob.ar/infolegInternet/anexos/20000-24999/22379/texact.htm' },

    // --- NACION (Códigos de Forma) ---
    { province: 'nacion', name: 'codigo-procesal-civil-comercial-nacion', url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/16547/texact.htm' },
    { province: 'nacion', name: 'codigo-procesal-penal-federal', url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/239340/texact.htm' },
    { province: 'nacion', name: 'codigo-procesal-penal-27063', url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/383/texact.htm' },

    // --- CABA ---
    { province: 'caba', name: 'codigo-contravencional-caba', url: 'https://www.saij.gob.ar/1472-local-ciudad-autonoma-buenos-aires-codigo-contravencional-ciudad-lpx0001472-2004-10-28/123456789-0abc-defg-274-1000xvorpyel' },
    { province: 'caba', name: 'codigo-procedimientos-faltas-caba', url: 'https://www.saij.gob.ar/1217-local-ciudad-autonoma-buenos-aires-ley-procedimientos-faltas-lpx0001217-2003-11-27/123456789-0abc-defg-712-1000xvorpyel' },
    { province: 'caba', name: 'codigo-fiscal-caba', url: 'https://www.saij.gob.ar/541-local-ciudad-autonoma-buenos-aires-codigo-fiscal-lpx0000541-2000-12-28/123456789-0abc-defg-145-0000xvorpyel' },
    { province: 'caba', name: 'codigo-contencioso-admin-tributario-caba', url: 'https://www.saij.gob.ar/189-local-ciudad-autonoma-buenos-aires-codigo-contencioso-administrativo-tributario-lpx0000189-1999-05-13/123456789-0abc-defg-981-0000xvorpyel' },
    { province: 'caba', name: 'codigo-procesal-penal-caba', url: 'https://www.saij.gob.ar/2303-local-ciudad-autonoma-buenos-aires-codigo-procesal-penal-lpx0002303-2007-03-29/123456789-0abc-defg-303-2000xvorpyel' },
    { province: 'caba', name: 'codigo-transito-transporte-caba', url: 'https://www.saij.gob.ar/2148-local-ciudad-autonoma-buenos-aires-codigo-transito-transporte-caba-lpx0002148-2006-11-16/123456789-0abc-defg-841-2000xvorpyel' },

    // --- BUENOS AIRES (PBA) ---
    // Note: PBA norms hosted on normas.gba.gob.ar are usually good HTML but might need specific cleanup
    { province: 'buenos-aires', name: 'constitucion-pba', url: 'https://normas.gba.gob.ar/documentos/0Z0000X0.html' },
    { province: 'buenos-aires', name: 'codigo-rural-pba', url: 'https://normas.gba.gob.ar/ar-b/ley/1983/10081/6698' },
    { province: 'buenos-aires', name: 'codigo-fiscal-pba', url: 'https://normas.gba.gob.ar/ar-b/ley/1986/10397/6417' },
    { province: 'buenos-aires', name: 'codigo-transito-pba', url: 'https://normas.gba.gob.ar/ar-b/ley/2008/13927/2954' },
    { province: 'buenos-aires', name: 'codigo-procesal-penal-pba', url: 'https://normas.gba.gob.ar/ar-b/ley/1997/11922/4917' },
    { province: 'buenos-aires', name: 'codigo-contencioso-admin-pba', url: 'https://normas.gba.gob.ar/ar-b/ley/1997/12008/4818' },
    { province: 'buenos-aires', name: 'codigo-civil-comercial-pba', url: 'https://normas.gba.gob.ar/ar-b/ley/1968/7425/7888' },

    // --- LA PAMPA ---
    { province: 'la-pampa', name: 'codigo-procesal-penal-la-pampa', url: 'https://digesto.tcuentaslp.gob.ar/digesto%20tribunal/Leyes/Ley%202287.html' },

    // --- MENDOZA (SAIJ pages) ---
    { province: 'mendoza', name: 'codigo-procesal-civil-comercial-tributario-mendoza', url: 'https://www.saij.gob.ar/9001-local-mendoza-codigo-procesal-civil-comercial-tributario-provincia-mendoza-lpm0009001-2017-08-30/123456789-0abc-defg-100-9000mvorpyel' },
    { province: 'mendoza', name: 'codigo-procesal-administrativo-mendoza', url: 'https://www.saij.gob.ar/3918-local-mendoza-codigo-procesal-administrativo-lpm0003918-1973-08-07/123456789-0abc-defg-819-3000mvorpyel' },
    { province: 'mendoza', name: 'codigo-procesal-laboral-mendoza', url: 'https://www.saij.gob.ar/9109-local-mendoza-modifica-codigo-procesal-laboral-provincia-mendoza-lpm0009109-2018-10-23/123456789-0abc-defg-901-9000mvorpyel' },

    // --- NEUQUEN (SAIJ pages) ---
    { province: 'neuquen', name: 'codigo-procesal-administrativo-neuquen', url: 'https://www.saij.gob.ar/1305-local-neuquen-codigo-procesal-administrativo-neuquen-lpq0001305-1981-07-10/123456789-0abc-defg-503-1000qvorpyel' },

    // --- RIO NEGRO (HTML pages) ---
    { province: 'rio-negro', name: 'codigo-procesal-civil-comercial-rio-negro', url: 'https://web.legisrn.gov.ar/legislativa/legislacion/documento?id=7576' },
    { province: 'rio-negro', name: 'codigo-faltas-rio-negro', url: 'https://www.argentina.gob.ar/normativa/provincial/ley-532-123456789-0abc-defg-235-0002rvorpyel/actualizacion' },
    { province: 'rio-negro', name: 'codigo-procedimiento-minero-rio-negro', url: 'https://web.legisrn.gov.ar/legislativa/legislacion/documento?id=9088' },
    { province: 'rio-negro', name: 'codigo-aguas-rio-negro', url: 'https://www.argentina.gob.ar/normativa/provincial/ley-2952-123456789-0abc-defg-259-2002rvorpyel/actualizacion' },

    // --- SALTA (diputadosalta pages) ---
    { province: 'salta', name: 'codigo-procesal-penal-6345-salta', url: 'https://www.diputadosalta.gob.ar/digesto_leyes/1159/download_file' },
    { province: 'salta', name: 'codigo-contravencional-salta', url: 'https://www.diputadosalta.gob.ar/digesto_leyes/251/download_file' },
    { province: 'salta', name: 'codigo-procesal-civil-comercial-salta', url: 'https://www.diputadosalta.gob.ar/digesto_leyes/979/download_file' },
    { province: 'salta', name: 'codigo-procedimientos-mineros-salta', url: 'https://www.diputadosalta.gob.ar/digesto_leyes/885/download_file' },
    { province: 'salta', name: 'codigo-procesal-laboral-salta', url: 'https://www.diputadosalta.gob.ar/digesto_leyes/250/download_file' },
    { province: 'salta', name: 'codigo-contencioso-administrativo-salta', url: 'https://www.diputadosalta.gob.ar/digesto_leyes/1216/download_file' },
    // SAIJ/argentina.gob.ar pages for Salta
    { province: 'salta', name: 'codigo-procesal-penal-7690-salta', url: 'https://www.saij.gob.ar/7690-local-salta-codigo-procesal-penal-provincia-salta-lpa0007690-2011-11-01/123456789-0abc-defg-096-7000avorpyel' },
    { province: 'salta', name: 'codigo-fiscal-salta', url: 'https://www.argentina.gob.ar/normativa/provincial/ley-9-123456789-0abc-defg-160-0202avorpyel/actualizacion' },

    // --- SAN LUIS (SAIJ/argentina.gob.ar pages) ---
    { province: 'san-luis', name: 'codigo-tributario-san-luis', url: 'https://www.saij.gob.ar/490-local-san-luis-codigo-tributario-provincia-san-luis-lpd1000490-2005-11-23/123456789-0abc-defg-094-0001dvorpyel' },
    { province: 'san-luis', name: 'codigo-consumidores-san-luis', url: 'https://www.saij.gob.ar/13133-local-buenos-aires-codigo-provincial-implementacion-derechos-consumidores-usuarios-lpb0013133-2003-11-27/123456789-0abc-defg-331-3100bvorpyel' },
    { province: 'san-luis', name: 'codigo-contravencional-san-luis', url: 'https://www.argentina.gob.ar/normativa/provincial/ley-1000-123456789-0abc-defg-000-1000dvorpyel/actualizacion' },
    { province: 'san-luis', name: 'codigo-procedimientos-administrativos-san-luis', url: 'https://www.saij.gob.ar/5540-local-san-luis-ley-procedimientos-administrativos-san-luis-lpd0005540-2004-04-14/123456789-0abc-defg-045-5000dvorpyel' },
    { province: 'san-luis', name: 'codigo-rural-san-luis', url: 'https://www.saij.gob.ar/5553-local-san-luis-codigo-rural-provincia-san-luis-lpd0005553-2004-04-21/123456789-0abc-defg-355-5000dvorpyel' },

    // --- SANTA CRUZ (SAIJ pages) ---
    { province: 'santa-cruz', name: 'codigo-procesal-civil-comercial-1418-santa-cruz', url: 'https://www.saij.gob.ar/legislacion/ley-santa_cruz-1418-codigo_procesal_civil_comercial.htm' },
    { province: 'santa-cruz', name: 'codigo-procesal-penal-santa-cruz', url: 'https://www.saij.gob.ar/2424-local-santa-cruz-codigo-procesal-penal-provincia-santa-cruz-lpz0002424-1995-11-16/123456789-0abc-defg-424-2000zvorpyel' },
    { province: 'santa-cruz', name: 'codigo-faltas-santa-cruz', url: 'https://www.saij.gob.ar/legislacion/ley-santa_cruz-3125-codigo_faltas_provincia_santa.htm' },
    { province: 'santa-cruz', name: 'codigo-fiscal-santa-cruz', url: 'https://www.saij.gob.ar/3934-local-santa-cruz-modificacion-ley-3486-codigo-fiscal-lpz0003934-2025-06-12/123456789-0abc-defg-439-3000zvorpyel' },
    { province: 'santa-cruz', name: 'codigo-procedimientos-mineros-santa-cruz', url: 'https://www.saij.gob.ar/990-local-santa-cruz-codigo-procedimiento-autoridad-minera-primera-instancia-codigo-procedimientos-mineros-santa-cruz-lpz0000990-1975-08-20/123456789-0abc-defg-099-0000zvorpyel' },

    // --- SANTA FE (SAIJ/argentina.gob.ar pages) ---
    { province: 'santa-fe', name: 'codigo-procesal-laboral-13840-santa-fe', url: 'https://www.saij.gob.ar/13840-local-santa-fe-modificacion-al-codigo-procesal-laboral-modificacion-ley-organica-poder-judicial-lps0013840-2018-11-29/123456789-0abc-defg-048-3100svorpyel' },
    { province: 'santa-fe', name: 'codigo-tributario-municipal-santa-fe', url: 'https://www.argentina.gob.ar/normativa/provincial/ley-8173-123456789-0abc-defg-961-0000svorpyel/actualizacion' },

    // --- SANTIAGO DEL ESTERO (HTML pages) ---
    { province: 'santiago-del-estero', name: 'codigo-procesal-penal-6941-santiago', url: 'https://www.jussantiago.gov.ar/jusnueva/Normativa/Ley6941.php' },

    // --- TUCUMAN (argentina.gob.ar pages) ---
    { province: 'tucuman', name: 'codigo-procesal-laboral-tucuman', url: 'https://www.argentina.gob.ar/normativa/provincial/ley-8988-123456789-0abc-defg-889-8000tvorpyel/actualizacion' },
    { province: 'tucuman', name: 'codigo-implementacion-cpp-tucuman', url: 'https://www.argentina.gob.ar/normativa/provincial/ley-9675-123456789-0abc-defg-576-9000tvorpyel/actualizacion' },
    { province: 'tucuman', name: 'codigo-procesal-constitucional-tucuman', url: 'https://www.argentina.gob.ar/normativa/provincial/ley-6944-123456789-0abc-defg-449-6000tvorpyel/actualizacion' },
];

async function cleanPage(page, url) {
    if (url.includes('infoleg.gob.ar')) {
        await page.evaluate(() => {
            document.querySelectorAll('table[background]').forEach(e => e.removeAttribute('background'));
            document.querySelectorAll('img, .noprint, #encabezado, #pie, script, iframe').forEach(e => e.remove());
            document.body.style.fontFamily = "'Roboto', sans-serif";
            document.body.style.padding = "40px";
            // Center content
            const mainTable = document.querySelector('table');
            if (mainTable) mainTable.style.width = "100%";
        });
    } else if (url.includes('saij.gob.ar')) {
        await page.evaluate(() => {
            document.querySelectorAll('header, footer, .sidebar, .no-print, .breadcrumb, #barra-superior, .share-bar').forEach(e => e.remove());
            document.querySelectorAll('.document-container').forEach(e => {
                e.style.margin = "0";
                e.style.width = "100%";
                e.style.maxWidth = "none";
            });
            document.body.style.padding = "40px";
            document.body.style.background = "#fff";
        });
    } else if (url.includes('normas.gba.gob.ar')) {
        await page.evaluate(() => {
            document.querySelectorAll('header, footer, nav, .toolbar, .no-print, .btn-flotante').forEach(e => e.remove());
            document.querySelector('#contenido') ? document.querySelector('#contenido').style.margin = "0" : null;
            document.body.style.padding = "40px";
            document.body.style.background = "#fff";
        });
    } else if (url.includes('tcuentaslp.gob.ar')) {
        // La Pampa Digesto cleanup
        await page.evaluate(() => {
            document.querySelectorAll('header, footer, nav, iframe, script').forEach(e => e.remove());
            document.body.style.fontFamily = "'Roboto', sans-serif";
            document.body.style.padding = "40px";
            document.body.style.background = "#fff";
            document.body.style.color = "#000";
            document.body.style.lineHeight = "1.6";
        });
    }
}

(async () => {
    console.log('🏭 Starting Mass Legislation Factory...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-features=IsolateOrigins,site-per-process']
    });

    for (const item of targets) {
        const dir = path.join(OUTPUT_BASE, item.province);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const outputPath = path.join(dir, `${item.name}.pdf`);

        // Skip if already exists to save time/bandwidth
        if (fs.existsSync(outputPath)) {
            console.log(`⏩ Skipping ${item.name} (already exists)`);
            continue;
        }

        console.log(`⏳ Processing: ${item.name} (${item.province})...`);
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1600 });

        try {
            await page.goto(item.url, { waitUntil: 'networkidle2', timeout: 90000 }); // High timeout for slow gov sites

            await cleanPage(page, item.url);

            await page.pdf({
                path: outputPath,
                format: 'A4',
                printBackground: true,
                margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
                displayHeaderFooter: true,
                headerTemplate: `<div style="font-size:10px; margin-left:20px; color:#ccc;">Judic-IA Digesto - ${item.name.replace(/-/g, ' ').toUpperCase()}</div>`,
                footerTemplate: `<div style="font-size:10px; margin-right:20px; text-align:right; width:100%; color:#ccc;">Página <span class="pageNumber"></span></div>`
            });

            console.log(`✅ Generated: ${item.name}.pdf`);
        } catch (err) {
            console.error(`❌ Failed ${item.name}: ${err.message}`);
        } finally {
            await page.close();
        }
    }

    await browser.close();
    console.log('✨ All operations completed.');
})();
