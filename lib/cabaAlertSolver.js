/**
 * CABA Alert Solver
 * Scraper HTTP para el Tribunal Superior de Justicia de la CABA.
 * Busca por carátula (partes) — sin captcha, sin login, HTTP directo.
 * Portal: http://jurisprudencia.tsjbaires.gob.ar/jurisprudencia
 */

const TSJ_BASE   = 'http://jurisprudencia.tsjbaires.gob.ar/jurisprudencia';
const TSJ_SEARCH = `${TSJ_BASE}/resultadoBusqueda.asp`;
const TSJ_DOC    = `${TSJ_BASE}/verDocumento.asp?idDoc=`;
const TIMEOUT_MS = 30_000;

const SECRETARIAS_ALL = {
    chkSAO: 'on', chkSACAYT: 'on', chkSAC: 'on',
    chkSACyC: 'on', chkSAL: 'on', chkSAG: 'on', chkTSN: 'on',
};

function cleanText(v) {
    return String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

async function postSearch(caratula, page = 1) {
    const body = new URLSearchParams({
        hdnPaginaOrigen:      'busqueda.asp',
        textoLibreTodas:      '',
        textoLibreFrase:      '',
        textoLibreAlgunas:    '',
        textoLibreExcluyendo: '',
        expCaratula:          caratula,
        expNro:               '',
        expFechaResDesde:     '',
        expFechaResHasta:     '',
        termino_elegido:      '',
        IDtermino_elegido:    '',
        sModoOpe:             'post',
        limpiarBusq:          '',
        ordenInicial:         '',
        ordenResCampo:        '',
        ordenResTipo:         '',
        rebusq:               '',
        rebusqIdTermino:      '',
        rebusqDescTermino:    '',
        pag:                  String(page),
        cantRegPagina:        '100',
        ...SECRETARIAS_ALL,
    });

    const res = await fetch(TSJ_SEARCH, {
        method:   'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept':       'text/html,application/xhtml+xml',
            'Referer':      `${TSJ_BASE}/`,
            'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        body:     body.toString(),
        redirect: 'follow',
        signal:   AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`TSJ_CABA HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return new TextDecoder('iso-8859-1').decode(buf);
}

/**
 * Busca decisiones del TSJ CABA por carátula/parte.
 *
 * @param {object}  opts
 * @param {string}  opts.nombre       - Texto a buscar en carátula (ej: "García c/ GCBA")
 * @param {number}  [opts.maxPages=3] - Páginas máximas a consultar (100 resultados/página)
 * @returns {{ results: Array, total: number, error?: string }}
 */
export async function searchCABAByCaratula({ nombre, maxPages = 3 }) {
    if (!nombre?.trim()) return { results: [], total: 0, error: 'nombre vacío' };

    const { load } = await import('cheerio');
    const allResults = [];
    let totalAvailable = 0;

    try {
        for (let page = 1; page <= maxPages; page++) {
            const html = await postSearch(nombre.trim(), page);
            const $ = load(html, { decodeEntities: true });
            const bodyText = $('body').text();

            if (page === 1) {
                const tm = bodyText.match(/Se encontraron\s+([\d.]+)\s+resultados/i);
                totalAvailable = tm ? parseInt(tm[1].replace(/\./g, '')) : 0;
                if (totalAvailable === 0) break;
            }

            const pagMatch = bodyText.match(/P[áa]gina\s+(\d+)\/(\d+)/i);
            const currentPage = pagMatch ? parseInt(pagMatch[1]) : 1;
            const totalPages  = pagMatch ? parseInt(pagMatch[2]) : 1;

            $('table tr').each((_, tr) => {
                const tds = $(tr).find('td');
                if (tds.length < 5) return;

                const nroExp     = cleanText($(tds[0]).text());
                const caratula   = cleanText($(tds[1]).text());
                const secretaria = cleanText($(tds[2]).text());
                const fechaRaw   = cleanText($(tds[3]).text());
                if (!nroExp || isNaN(parseInt(nroExp))) return;

                let link = null;
                $(tds[4]).find('a').each((_, a) => {
                    const href = $(a).attr('href') || '';
                    const oc   = $(a).attr('onclick') || '';
                    if (href.includes('.pdf') || href.includes('verDoc') || href.includes('idDoc')) {
                        link = href.startsWith('http') ? href : `${TSJ_BASE}/${href.replace(/^\//, '')}`;
                    } else if (oc.includes('idDoc') || oc.includes('verDoc')) {
                        const m = oc.match(/idDoc=(\d+)/i) || oc.match(/verDocumento[^(]*\((\d+)/i);
                        if (m) link = `${TSJ_DOC}${m[1]}`;
                    }
                });

                let fechaISO = null;
                const fm = fechaRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (fm) fechaISO = `${fm[3]}-${fm[2].padStart(2,'0')}-${fm[1].padStart(2,'0')}`;

                allResults.push({
                    id:                   `tsj-caba-${nroExp}`,
                    expediente:           nroExp,
                    caratula:             caratula || `Expediente ${nroExp}`,
                    dependencia_asignada: secretaria || 'TSJ CABA',
                    assigned_date:        fechaISO || '',
                    link:                 link || TSJ_SEARCH,
                    source:               'TSJ CABA',
                });
            });

            if (currentPage >= totalPages) break;
            if (page < maxPages) await new Promise(r => setTimeout(r, 500));
        }

        console.log(`[CABA] "${nombre}": ${allResults.length} resultados (total disponible: ${totalAvailable})`);
        return { results: allResults, total: totalAvailable };

    } catch (err) {
        console.error('[CABA] Error:', err.message);
        return { results: [], total: 0, error: err.message };
    }
}
