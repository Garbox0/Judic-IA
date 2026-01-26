const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const LEGISLATION_DIR = path.join(__dirname, '..', 'public', 'legislation');

const filesToDownload = {
    'entre-rios': [
        { url: 'https://www2.jusentrerios.gov.ar/wp-content/uploads/dlm_uploads/2021/08/Codigo-Procesal-Penal-de-Entre-Rios.pdf', name: 'codigo-procesal-penal-entre-rios.pdf' },
        { url: 'https://www2.jusentrerios.gov.ar/wp-content/uploads/dlm_uploads/2021/08/Codigo-Contencioso-Administrativo.-Ley-7061.pdf', name: 'codigo-contencioso-administrativo-entre-rios.pdf' },
        { url: 'https://www2.jusentrerios.gov.ar/wp-content/uploads/dlm_uploads/2021/08/Codigo-Rural-de-Entre-Rios.pdf', name: 'codigo-rural-entre-rios.pdf' },
        { url: 'https://www.ater.gov.ar/ater2/archivos/ATER-C%C3%B3digo%20Fiscal-digital-2022.pdf', name: 'codigo-fiscal-entre-rios.pdf' }
    ],
    'corrientes': [
        { url: 'https://www.dgrcorrientes.gov.ar/rentascorrientes/contenidos/archivos%20pdf/codigo%20fiscal%2030072019.pdf', name: 'codigo-fiscal-corrientes.pdf' },
        { url: 'https://www.dgrcorrientes.gov.ar/rentascorrientes/contenidos/archivos%20pdf/Ley%206249%20_modif%202705.pdf', name: 'ley-tarifaria-corrientes.pdf' },
        { url: 'https://hcdcorrientes.gov.ar/leyes-diputados/Ley1564.pdf', name: 'codigo-fiscal-ley-1564-corrientes.pdf' },
        { url: 'https://hcdcorrientes.gov.ar/digesto/legislacion/codigos/Ley6518.pdf', name: 'codigo-procesal-penal-corrientes.pdf' },
        { url: 'https://boletinoficial.corrientes.gob.ar/assets/articulo_adjuntos/6112/original/ANEXO_BO_13-05-2021_-Ley_6556_Codigo_Procesal_Civil_y_Comercial_.pdf?1621008793', name: 'codigo-procesal-civil-comercial-corrientes.pdf' },
        { url: 'https://hcdcorrientes.gov.ar/leyes-diputados/Ley3066.pdf', name: 'codigo-aguas-ley-3066-corrientes.pdf' },
        { url: 'https://hcdcorrientes.gov.ar/leyes-diputados/Ley191-2001.pdf', name: 'codigo-aguas-dto-191-corrientes.pdf' },
        { url: 'https://hcdcorrientes.gov.ar/digesto/legislacion/textos-actualizados/Ley4106.pdf', name: 'codigo-contencioso-administrativo-corrientes.pdf' },
        { url: 'https://hcdcorrientes.gov.ar/wp-content/uploads/2021/10/Ley5760.pdf', name: 'codigo-derechos-consumidor-corrientes.pdf' },
        { url: 'https://hcdcorrientes.gov.ar/wp-content/uploads/2022/10/Ley5341.pdf', name: 'codigo-procedimiento-laboral-corrientes.pdf' },
        { url: 'https://hcdcorrientes.gov.ar/wp-content/uploads/2022/04/Ley5676.pdf', name: 'codigo-proc-constitucionales-corrientes.pdf' },
        { url: 'https://hcdcorrientes.gov.ar/leyes-diputados/Ley3607.pdf', name: 'codigo-rural-corrientes.pdf' }
    ],
    'catamarca': [
        { url: 'https://juscatamarca.gob.ar/PDF/normativas/CODIGO%20CONTENCIOSO%20ADMINISTRATIVO%20(LEY%202403).pdf', name: 'codigo-contencioso-administrativo-catamarca.pdf' },
        { url: 'https://juscatamarca.gob.ar/PDF/normativas/CODIGO%20DE%20PROCEDIMIENTOS%20ADMINISTRATIVOS%20(LEY%203559).pdf', name: 'codigo-procedimientos-administrativos-catamarca.pdf' },
        { url: 'https://juscatamarca.gob.ar/PDF/normativas/CODIGO%20DE%20PROCEDIMIENTOS%20MINEROS%20(LEY%202233).pdf', name: 'codigo-procedimientos-mineros-catamarca.pdf' },
        { url: 'https://juscatamarca.gob.ar/PDF/normativas/LEY2339.pdf', name: 'codigo-procesal-civil-comercial-ley-2339-catamarca.pdf' },
        { url: 'https://nuevacorte.juscatamarca.gob.ar/PDF/normativas/LEY%205425%20Modificaci%C3%B3n%20del%20C%C3%B3digo%20Procesal%20Penal.pdf', name: 'modificacion-codigo-procesal-penal-catamarca.pdf' },
        { url: 'https://juscatamarca.gob.ar/PDF/normativas/CODIGO%20PROCESAL%20DEL%20TRABAJO.pdf', name: 'codigo-procesal-trabajo-catamarca.pdf' }
    ],
    'chaco': [
        { url: 'https://inecip.org/wp-content/uploads/2016/08/Chaco-C%C3%B3digo-Procesal-Penal.pdf', name: 'codigo-procesal-penal-chaco.pdf' },
        { url: 'https://m-atp.chaco.gob.ar/documentos/legislativos/leyes-provinciales/2444-1979.pdf', name: 'codigo-tributario-chaco.pdf' },
        { url: 'https://mapadelestado.chaco.gob.ar/files/documentacion/L.555.R.pdf', name: 'codigo-aguas-chaco.pdf' }
    ],
    'formosa': [
        { url: 'https://www.jusformosa.gob.ar/fx/biblioteca/legislacion/CodigoCivilComercialFormosa.pdf', name: 'codigo-procesal-civil-comercial-formosa.pdf' },
        { url: 'https://www.jusformosa.gob.ar/fx/biblioteca/legislacion/Codigopenalpag2015-final.pdf', name: 'codigo-procesal-penal-formosa.pdf' },
        { url: 'https://www.jusformosa.gob.ar/fx/biblioteca/legislacion/CodigoFaltas2020.pdf', name: 'codigo-faltas-formosa.pdf' },
        { url: 'https://www.jusformosa.gob.ar/fx/biblioteca/legislacion/CodigoFamilia2011.pdf', name: 'codigo-familia-formosa.pdf' },
        { url: 'https://www.jusformosa.gob.ar/fx/biblioteca/legislacion/CodigoProcedimientoTrabajo2015.pdf', name: 'codigo-procedimiento-trabajo-formosa.pdf' }
    ]
};

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                // Handle redirect
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download ${url}: Status Code ${response.statusCode}`));
            }

            const file = fs.createWriteStream(dest);
            response.pipe(file);

            file.on('finish', () => {
                file.close(() => resolve());
            });

            file.on('error', (err) => {
                fs.unlink(dest, () => reject(err));
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

async function migrate() {
    console.log('🚀 Starting Legislation Migration...');

    for (const [jurisdiction, files] of Object.entries(filesToDownload)) {
        const jurisdictionDir = path.join(LEGISLATION_DIR, jurisdiction);

        if (!fs.existsSync(jurisdictionDir)) {
            console.log(`📁 Creating directory: ${jurisdictionDir}`);
            fs.mkdirSync(jurisdictionDir, { recursive: true });
        }

        for (const file of files) {
            const destPath = path.join(jurisdictionDir, file.name);
            console.log(`⬇️ Downloading ${file.name}...`);

            try {
                await downloadFile(file.url, destPath);
                console.log(`✅ Saved: ${file.name}`);
            } catch (error) {
                console.error(`❌ Error downloading ${file.name}:`, error.message);
            }
        }
    }

    console.log('✨ Migration completed!');
}

migrate();
