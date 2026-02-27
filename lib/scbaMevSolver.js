/**
 * SCBA MEV Solver
 * Scraper HTTP para la Mesa de Entradas Virtual de la
 * Suprema Corte de Justicia de la Provincia de Buenos Aires.
 *
 * No usa Puppeteer — requests HTTP directos contra el viejo stack ASP.
 * El servidor mantiene la sesión con ASPSESSIONID cookie.
 */
import https from 'https';
import * as cheerio from 'cheerio';

const MEV_HOST = 'mev.scba.gov.ar';

// ──────────────────────────────────────────────────────────────────────────
// Jurisdicciones disponibles
// ──────────────────────────────────────────────────────────────────────────
export const SCBA_JURISDICCIONES = [
    { id: 'SCJ',  label: 'Suprema Corte SCBA',       tipoDto: 'SCJ', dtoJudElegido: null },
    { id: 'LP',   label: 'La Plata',                  tipoDto: 'CC',  dtoJudElegido: '6'  },
    { id: 'LZ',   label: 'Lomas de Zamora',           tipoDto: 'CC',  dtoJudElegido: '16' },
    { id: 'SI',   label: 'San Isidro',                tipoDto: 'CC',  dtoJudElegido: '24' },
    { id: 'SM',   label: 'San Martín',                tipoDto: 'CC',  dtoJudElegido: '25' },
    { id: 'LM',   label: 'La Matanza',                tipoDto: 'CC',  dtoJudElegido: '14' },
    { id: 'QU',   label: 'Quilmes',                   tipoDto: 'CC',  dtoJudElegido: '23' },
    { id: 'MO',   label: 'Morón',                     tipoDto: 'CC',  dtoJudElegido: '19' },
    { id: 'AL',   label: 'Avellaneda-Lanús',          tipoDto: 'CC',  dtoJudElegido: '80' },
    { id: 'MR',   label: 'Moreno-Gral. Rodríguez',   tipoDto: 'CC',  dtoJudElegido: '52' },
    { id: 'MP',   label: 'Mar del Plata',             tipoDto: 'CC',  dtoJudElegido: '17' },
    { id: 'BB',   label: 'Bahía Blanca',              tipoDto: 'CC',  dtoJudElegido: '11' },
    { id: 'ME',   label: 'Mercedes',                  tipoDto: 'CC',  dtoJudElegido: '18' },
    { id: 'AZ',   label: 'Azul',                      tipoDto: 'CC',  dtoJudElegido: '10' },
    { id: 'DO',   label: 'Dolores',                   tipoDto: 'CC',  dtoJudElegido: '12' },
    { id: 'JU',   label: 'Junín',                     tipoDto: 'CC',  dtoJudElegido: '13' },
    { id: 'NE',   label: 'Necochea',                  tipoDto: 'CC',  dtoJudElegido: '20' },
    { id: 'OL',   label: 'Olavarría',                 tipoDto: 'CC',  dtoJudElegido: '21' },
    { id: 'PE',   label: 'Pergamino',                 tipoDto: 'CC',  dtoJudElegido: '22' },
    { id: 'SN',   label: 'San Nicolás',               tipoDto: 'CC',  dtoJudElegido: '26' },
    { id: 'TA',   label: 'Tandil',                    tipoDto: 'CC',  dtoJudElegido: '27' },
    { id: 'TL',   label: 'Trenque Lauquen',           tipoDto: 'CC',  dtoJudElegido: '28' },
    { id: 'ZC',   label: 'Zárate/Campana',            tipoDto: 'CC',  dtoJudElegido: '29' },
    { id: 'TCP',  label: 'Tribunal de Casación Penal',tipoDto: 'LPC', dtoJudElegido: null },
];

// ──────────────────────────────────────────────────────────────────────────
// HTTP helper
// ──────────────────────────────────────────────────────────────────────────
function mevRequest({ method, path, body, cookie }) {
    return new Promise((resolve, reject) => {
        const bodyStr = body
            ? new URLSearchParams(body).toString()
            : '';

        const options = {
            hostname: MEV_HOST,
            path,
            method,
            headers: {
                'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0',
                'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-AR,es;q=0.9',
                'Referer':         'https://mev.scba.gov.ar/',
                ...(cookie ? { Cookie: cookie } : {}),
                ...(body ? {
                    'Content-Type':   'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(bodyStr),
                } : {}),
            },
        };

        const req = https.request(options, res => {
            const newCookie = (res.headers['set-cookie'] || [])
                .map(c => c.split(';')[0])
                .join('; ');

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                // MEV uses ISO-8859-1 — decode correctly
                const rawBuf = Buffer.concat(chunks);
                const html = rawBuf.toString('latin1');
                resolve({
                    status:   res.statusCode,
                    location: res.headers.location || null,
                    cookie:   newCookie || cookie,
                    html,
                });
            });
        });

        req.on('error', reject);
        if (body) req.write(bodyStr);
        req.end();
    });
}

// ──────────────────────────────────────────────────────────────────────────
// Login
// ──────────────────────────────────────────────────────────────────────────
async function loginMEV() {
    const user = process.env.SCBA_MEV_USER;
    const pass = process.env.SCBA_MEV_PASS;
    if (!user || !pass) {
        throw new Error('SCBA_MEV_USER / SCBA_MEV_PASS no configurados en env');
    }

    const res = await mevRequest({
        method: 'POST',
        path:   '/loguin.asp?familiadepto=',
        body:   { usuario: user, clave: pass, DeptoRegistrado: 'aa' },
        cookie: null,
    });

    if (res.status !== 302 || !res.cookie) {
        throw new Error('MEV login falló — credenciales inválidas o sistema caído');
    }
    return res.cookie;
}

// ──────────────────────────────────────────────────────────────────────────
// Seleccionar jurisdicción
// ──────────────────────────────────────────────────────────────────────────
async function selectJurisdiction(cookie, jur) {
    // Get current state
    await mevRequest({ method: 'GET', path: '/POSLoguin.asp', cookie });

    const body = { TipoDto: jur.tipoDto, Aceptar: 'Aceptar' };
    if (jur.tipoDto === 'CC' && jur.dtoJudElegido) {
        body.DtoJudElegido = jur.dtoJudElegido;
    }

    const res = await mevRequest({
        method: 'POST',
        path:   '/POSLoguin.asp',
        body,
        cookie,
    });

    if (!res.location || !res.location.toLowerCase().includes('busqueda')) {
        throw new Error(`No se pudo seleccionar jurisdicción: ${jur.label}`);
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Obtener lista de organismos para la jurisdicción activa
// ──────────────────────────────────────────────────────────────────────────
async function getOrganismos(cookie) {
    const res = await mevRequest({ method: 'GET', path: '/busqueda.asp', cookie });
    const $ = cheerio.load(res.html, { decodeEntities: false });

    const opts = [];
    $('select option').each((_, el) => {
        const val  = $(el).attr('value')?.trim() || '';
        const text = $(el).text().trim();
        if (val && val !== 'Sin Datos' && text) {
            opts.push({ id: val, label: text });
        }
    });
    return opts;
}

// ──────────────────────────────────────────────────────────────────────────
// Buscar por carátula en un organismo
// ──────────────────────────────────────────────────────────────────────────
async function searchOrganismo(cookie, { organismoId, nombre }) {
    const searchRes = await mevRequest({
        method: 'POST',
        path:   '/Busqueda.asp',
        body: {
            JuzgadoElegido: organismoId,
            radio:          'xCa',
            caratula:       nombre,
            NCausa:         '',
            NInterno:       '',
            TipoCausa:      'Am',   // Activos + Archivados
            Buscar:         'Buscar',
        },
        cookie,
    });

    if (!searchRes.location) return null;

    const location = searchRes.location.startsWith('/')
        ? searchRes.location
        : '/' + searchRes.location;

    const resultRes = await mevRequest({ method: 'GET', path: location, cookie });
    return resultRes.html;
}

// ──────────────────────────────────────────────────────────────────────────
// Parsear resultados de MuestraCausas.asp
// ──────────────────────────────────────────────────────────────────────────
function parseMuestraCausas(html, organismoLabel, jurisdiccionLabel) {
    if (!html) return { results: [], total: 0 };

    const $ = cheerio.load(html, { decodeEntities: false });
    const results = [];

    // Total
    const totalMatch = html.match(/Total Expedientes\s*:\s*(\d+)/i);
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;

    // Results come as alternating TR pairs:
    // Even TR: carátula + link
    // Odd TR: estado, nroExpediente, nroCausa, fecha
    const rows = $('TR');

    rows.each((i, row) => {
        const $row = $(row);
        const link = $row.find('a[href*="procesales.asp"]').first();
        if (!link.length) return;

        const href = link.attr('href') || '';
        const nidMatch = href.match(/nidCausa=(\d+)/);
        const pidMatch = href.match(/pidJuzgado=([^&"]+)/);
        if (!nidMatch) return;

        const nidCausa  = nidMatch[1];
        const pidJuzgado = pidMatch ? pidMatch[1].trim() : '';
        const caratula  = link.text().trim().replace(/\s+/g, ' ');

        // Peek at next sibling TR for details
        const $next = $row.next('TR');
        const tds   = $next.find('TD').toArray().map(td =>
            $(td).text().replace(/\s+/g, ' ').trim()
        );

        const estado        = tds[0] || '';
        const nroExpediente = (tds[1] || '').replace(/\s*-\s*/g, '-').replace(/^-|-$/, '').trim();
        const nroCausa      = (tds[2] || '').replace(/\s*-\s*/g, '-').replace(/^-|-$/, '').trim();
        const fecha         = tds[3] || '';

        results.push({
            caratula,
            estado,
            nroExpediente,
            nroCausa,
            fecha,
            organismo:    organismoLabel,
            jurisdiccion: jurisdiccionLabel,
            link:         `https://mev.scba.gov.ar/procesales.asp?nidCausa=${nidCausa}&pidJuzgado=${encodeURIComponent(pidJuzgado)}`,
            source:       'SCBA MEV',
        });
    });

    return { results, total };
}

// ──────────────────────────────────────────────────────────────────────────
// Función principal exportada
// ──────────────────────────────────────────────────────────────────────────
/**
 * Busca antecedentes en la MEV de SCBA para un nombre/carátula.
 *
 * @param {object} opts
 * @param {string}   opts.nombre        - Nombre a buscar (texto libre)
 * @param {string}   opts.jurisdiccionId - ID de jurisdicción (ej. 'SCJ', 'LP')
 * @param {number}   [opts.maxOrganismos=6] - Máx de organismos a consultar dentro de la jurisdicción
 * @returns {{ results, total, jurisdiccion, organismosBuscados, error? }}
 */
export async function searchMEVByName({ nombre, jurisdiccionId, maxOrganismos = 6 }) {
    const jur = SCBA_JURISDICCIONES.find(j => j.id === jurisdiccionId);
    if (!jur) {
        return { results: [], total: 0, error: `Jurisdicción desconocida: ${jurisdiccionId}` };
    }

    const startMs = Date.now();
    console.log(`[SCBA MEV] Buscando "${nombre}" en ${jur.label}...`);

    try {
        // 1. Login
        const cookie = await loginMEV();

        // 2. Seleccionar jurisdicción
        await selectJurisdiction(cookie, jur);

        // 3. Obtener organismos disponibles
        const organismos = await getOrganismos(cookie);
        const toSearch   = organismos.slice(0, maxOrganismos);

        console.log(`[SCBA MEV] Organismos en ${jur.label}: ${organismos.length} total, buscando en ${toSearch.length}`);

        // 4. Buscar en cada organismo
        const allResults = [];
        for (const org of toSearch) {
            try {
                const html = await searchOrganismo(cookie, { organismoId: org.id, nombre });
                const { results, total } = parseMuestraCausas(html, org.label, jur.label);
                console.log(`[SCBA MEV]   ${org.label}: ${results.length} (de ${total}) resultados`);
                allResults.push(...results);
            } catch (orgErr) {
                console.warn(`[SCBA MEV]   Error en organismo ${org.label}:`, orgErr.message);
            }
        }

        const duration = Date.now() - startMs;
        console.log(`[SCBA MEV] Total: ${allResults.length} resultados en ${duration}ms`);

        return {
            results:            allResults,
            total:              allResults.length,
            jurisdiccion:       jur.label,
            organismosBuscados: toSearch.map(o => o.label),
        };
    } catch (err) {
        console.error('[SCBA MEV] Error:', err.message);
        return {
            results: [],
            total:   0,
            error:   err.message,
        };
    }
}
