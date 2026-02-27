/**
 * PJN SCW Scraper — Puppeteer + Gemini Vision para resolver el captcha
 *
 * Flujo:
 *  1. Carga SCW con Puppeteer (stealth)
 *  2. Selecciona jurisdicción, llena campos de búsqueda
 *  3. Resuelve captcha: lee imagen → Gemini Vision → tipea dígitos → espera token
 *  4. Submit Consultar → parsea tabla de resultados
 */

import puppeteer from 'puppeteer-extra';
import { resolvePjnParteType } from './pjnParteRules.js';
// --- INICIO PARCHE PARA NEXT.JS/WEBPACK Y PUPPETEER-EXTRA-PLUGIN-STEALTH ---
let StealthPlugin;
try {
    StealthPlugin = require('puppeteer-extra-plugin-stealth');
} catch (e) {
    StealthPlugin = require('puppeteer-extra-plugin-stealth')();
}
// Fix manual para el bug "utils.typeOf is not a function"
if (typeof StealthPlugin === 'function') {
    puppeteer.use(StealthPlugin());
} else if (StealthPlugin && typeof StealthPlugin.default === 'function') {
    puppeteer.use(StealthPlugin.default());
}
// --- FIN PARCHE ---

const SCW_URL = 'https://scw.pjn.gov.ar/scw/home.seam';

/**
 * Usa Gemini Vision vía OpenRouter para leer los dígitos del captcha.
 * Mucho más preciso que Tesseract para imágenes estilizadas.
 */
async function readCaptchaWithVision(base64Image) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY no definida en el entorno');

    // Prompt ultra-estricto en inglés para mejor seguimiento de instrucciones
    const prompt = 'Return ONLY the 4 digits shown in this CAPTCHA image. Do not include any other text, labels, or explanations. Just the 4 numbers.';

    const body = {
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: { url: `data:image/jpeg;base64,${base64Image}` },
                    },
                    {
                        type: 'text',
                        text: prompt,
                    },
                ],
            },
        ],
        max_tokens: 10,
        temperature: 0,
    };

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://judic-ia.com',
            'X-Title': 'Judic-IA PJN Scraper',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter error: ${res.status} — ${err.substring(0, 200)}`);
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim() || '';
    const digits = text.replace(/\D/g, '').substring(0, 6);

    console.log(`[VisionOCR] Gemini respondió: "${text}" → dígitos: "${digits}"`);
    return digits;
}

/**
 * Resuelve el captcha dentro del iframe del SCW.
 * Retorna el token (string) si tuvo éxito, null si todos los intentos fallaron.
 */
async function solveCaptchaInPage(page, captchaFrame, maxAttempts = 4) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`[CaptchaSolver] Intento ${attempt}/${maxAttempts}`);

        // Desde el 2do intento: recargar challenge
        if (attempt > 1) {
            await captchaFrame.evaluate(() => {
                const allBtns = [...document.querySelectorAll('button, input[type="button"], a, input[type="submit"]')];
                const reloadBtn = allBtns.find(b =>
                    (b.className || '').toLowerCase().includes('reload') ||
                    (b.className || '').toLowerCase().includes('refresh') ||
                    (b.title || '').toLowerCase().includes('recargar') ||
                    (b.textContent || '').trim() === '↺'
                );
                if (reloadBtn) {
                    reloadBtn.click();
                } else {
                    const verBtn = document.querySelector('input[type="submit"]') || document.querySelector('button');
                    if (verBtn) verBtn.click();
                }
            });
            await new Promise(r => setTimeout(r, 2000));
        } else {
            // Primer intento: click VER DESAFÍO
            await captchaFrame.evaluate(() => {
                const btn = document.querySelector('input[type="submit"]') || document.querySelector('button');
                if (btn) btn.click();
            });
        }

        // Esperar que aparezca la imagen (polling hasta 7s)
        let imgSrc = null;
        for (let i = 0; i < 14; i++) {
            await new Promise(r => setTimeout(r, 500));
            imgSrc = await captchaFrame.evaluate(() => {
                const img = document.querySelector('.text-challenge-image img, img[src^="data:image"]');
                return img ? img.src : null;
            }).catch(() => null);
            if (imgSrc) break;
        }

        if (!imgSrc) {
            console.warn('[CaptchaSolver] No se encontró imagen del captcha, reintentando...');
            continue;
        }

        // Extraer base64
        const base64 = imgSrc.replace(/^data:image\/\w+;[^,]*,/, '');

        // ── GEMINI VISION OCR (reemplaza Tesseract) ──
        let digits;
        try {
            digits = await readCaptchaWithVision(base64);
        } catch (err) {
            console.warn('[CaptchaSolver] Error en Gemini Vision:', err.message);
            continue;
        }

        if (!digits || digits.length < 2) {
            console.warn('[CaptchaSolver] Gemini no devolvió dígitos válidos, reintentando...');
            continue;
        }

        // Tipear en el input del captcha
        await captchaFrame.evaluate((answer) => {
            const input = document.querySelector('input.text-challenge-input, input[placeholder*="texto"]');
            if (input) {
                input.value = answer;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            }
        }, digits);

        // Click ACEPTAR
        await captchaFrame.evaluate(() => {
            const allBtns = [...document.querySelectorAll('button, input[type="submit"]')];
            const acceptBtn = allBtns.find(b =>
                (b.textContent || b.value || '').toUpperCase().includes('ACEPTAR')
            ) || allBtns[allBtns.length - 1];
            if (acceptBtn) acceptBtn.click();
        });

        // Esperar hasta 8s a que el token aparezca en captcha-response
        let token = null;
        for (let i = 0; i < 16; i++) {
            await new Promise(r => setTimeout(r, 500));
            token = await page.evaluate(() => {
                const inp = document.querySelector('input[name="captcha-response"], #captcha-response');
                return inp ? inp.value : null;
            }).catch(() => null);
            if (token && token.length > 5) break;

            // Verificar si el widget mostró ERROR (respuesta incorrecta)
            const isError = await captchaFrame.evaluate(() => {
                const errEl = document.querySelector('[class*="error"]');
                return !!errEl && (errEl.textContent?.includes('ERROR') || errEl.textContent?.includes('Incorrecto'));
            }).catch(() => false);

            if (isError) {
                console.warn(`[CaptchaSolver] Captcha rechazado (Gemini dijo: "${digits}"), reintentando...`);
                break;
            }
        }

        if (token && token.length > 5) {
            console.log(`[CaptchaSolver] ✅ Token obtenido con dígitos "${digits}"`);
            return token;
        }

        console.warn(`[CaptchaSolver] Sin token en intento ${attempt}`);
    }

    return null;
}

// ── Public API ──

/**
 * Búsqueda en SCW por expediente.
 * @param {{ jurisdiccion: string, jurisdictionName?: string, numero: string|number, anio: string|number }} params
 */
export async function searchByExpediente({ jurisdiccion, jurisdictionName, numero, anio, maxPages }) {
    return runSCWSearch({ tab: 'porExpediente', jurisdiccion, jurisdictionName, numero, anio, maxPages });
}

/**
 * Búsqueda en SCW por parte.
 * @param {{ jurisdiccion: string, jurisdictionName?: string, nombre: string }} params
 */
export async function searchByParte({ jurisdiccion, jurisdictionName, nombre, parteTipo, maxPages }) {
    return runSCWSearch({ tab: 'porParte', jurisdiccion, jurisdictionName, nombre, parteTipo, maxPages });
}

/**
 * Motor principal — Puppeteer realiza toda la interacción con SCW.
 */
async function runSCWSearch({ tab, jurisdiccion, jurisdictionName, numero, anio, nombre, parteTipo, maxPages = null }) {
    const effectiveParteTipo = tab === 'porParte'
        ? resolvePjnParteType({
            jurisdictionId: jurisdiccion,
            requestedType: parteTipo
        })
        : null;

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        );
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9' });
        await page.setViewport({ width: 1280, height: 900 });

        // 1. Cargar SCW
        console.log('[SCWScraper] Cargando SCW...');
        await page.goto(SCW_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));

        const getActiveTabSelector = (tabName) => {
            if (tabName === 'porParte') return '#formPublica\\:porParte';
            if (tabName === 'porExpediente') return '#formPublica\\:porExpediente';
            return '';
        };

        // 2. Cambiar a pestaña "Por parte" si corresponde
        if (tab === 'porParte') {
            await page.evaluate(() => {
                const normalizeText = (text = '') => {
                    try {
                        return String(text)
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase()
                            .trim();
                    } catch {
                        return String(text || '').toLowerCase().trim();
                    }
                };

                const explicit =
                    document.getElementById('formPublica:porParte:header:inactive') ||
                    document.getElementById('formPublica:porParte:header:active');
                if (explicit) {
                    explicit.click();
                    return;
                }

                const links = [...document.querySelectorAll('td.rf-tab-hdr, span.rf-tab-lbl, a, li, span')];
                const porParte = links.find((l) => normalizeText(l.textContent || '').includes('por parte'));
                if (!porParte) return;
                const clickable = porParte.closest('td.rf-tab-hdr') || porParte;
                clickable.click();
            });
            // Esperar a que aparezca la pestaña de "Por parte" activa con sus campos.
            await page.waitForSelector('#formPublica\\:porParte[style*="display: block"], #formPublica\\:nomIntervParte', { timeout: 7000 }).catch(() => { });
            await new Promise(r => setTimeout(r, 1000));
        }

        // 3. Seleccionar jurisdicción
        if (jurisdiccion) {
            const selected = await page.evaluate((jur, activeTabSelector, currentTab) => {
                const normalizeText = (text = '') => {
                    try {
                        return String(text)
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase()
                            .trim();
                    } catch {
                        return String(text || '').toLowerCase().trim();
                    }
                };

                const activeRoot = document.querySelector(activeTabSelector) || document;
                const preferredSelector = currentTab === 'porParte'
                    ? 'select[name="formPublica:camaraPartes"], #formPublica\\:camaraPartes'
                    : 'select[name="formPublica:camaraNumAni"], #formPublica\\:camaraNumAni';

                const preferred = activeRoot.querySelector(preferredSelector);
                if (preferred) {
                    const opt = [...preferred.options].find((o) => o.value === jur);
                    if (opt) {
                        preferred.value = opt.value;
                        preferred.dispatchEvent(new Event('change', { bubbles: true }));
                        return { name: preferred.name || preferred.id || '', value: preferred.value, strategy: 'preferred' };
                    }
                }

                const visibleSelects = [...activeRoot.querySelectorAll('select')].filter((sel) => {
                    const st = window.getComputedStyle(sel);
                    return st.display !== 'none' && st.visibility !== 'hidden' && sel.offsetParent !== null;
                });

                for (const sel of visibleSelects) {
                    for (const opt of sel.options) {
                        if (opt.value === jur) {
                            sel.value = jur;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                            return {
                                name: sel.name || sel.id || '',
                                value: sel.value,
                                label: (opt.textContent || '').trim(),
                                strategy: 'visible-fallback'
                            };
                        }
                    }
                }

                // Ultimo fallback global (evitar tabs ocultos solo si es posible)
                const selects = [...document.querySelectorAll('select')];
                for (const sel of selects) {
                    const contextText = normalizeText(`${sel.name || ''} ${sel.id || ''}`);
                    if (currentTab === 'porParte' && contextText.includes('camaranumani')) continue;
                    if (currentTab === 'porExpediente' && contextText.includes('camarapartes')) continue;
                    for (const opt of sel.options) {
                        if (opt.value === jur) {
                            sel.value = jur;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                            return {
                                name: sel.name || sel.id || '',
                                value: sel.value,
                                label: (opt.textContent || '').trim(),
                                strategy: 'global-fallback'
                            };
                        }
                    }
                }
                return null;
            }, jurisdiccion, getActiveTabSelector(tab), tab);
            console.log('[SCWScraper] Jurisdicción:', JSON.stringify(selected));
            await new Promise(r => setTimeout(r, 500));
        }

        // 3.1 Seleccionar tipo de parte (opcional/fijado, solo en tab Por parte)
        if (tab === 'porParte' && effectiveParteTipo) {
            const selectedTipo = await page.evaluate((tipoRaw, activeTabSelector) => {
                const normalizeText = (text = '') => {
                    try {
                        return String(text)
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase()
                            .trim();
                    } catch {
                        return String(text || '').toLowerCase().trim();
                    }
                };

                const target = normalizeText(tipoRaw);
                const activeRoot = document.querySelector(activeTabSelector) || document;
                const preferred = activeRoot.querySelector('select[name="formPublica:tipo"], #formPublica\\:tipo');
                if (preferred) {
                    const options = [...preferred.options];
                    const match = options.find((opt) => normalizeText(opt.textContent || '').includes(target));
                    if (match) {
                        preferred.value = match.value;
                        preferred.dispatchEvent(new Event('change', { bubbles: true }));
                        return {
                            name: preferred.name || preferred.id || 'tipo',
                            value: match.value,
                            label: (match.textContent || '').trim(),
                            strategy: 'preferred'
                        };
                    }
                }

                const selects = [...activeRoot.querySelectorAll('select')];

                for (const sel of selects) {
                    const contextText = normalizeText(`${sel.name || ''} ${sel.id || ''} ${sel.closest('tr')?.textContent || ''}`);
                    const mightBeTipo = contextText.includes('tipo') || contextText.includes('parte');
                    if (!mightBeTipo) continue;

                    const options = [...sel.options];
                    const match = options.find((opt) => normalizeText(opt.textContent || '').includes(target));
                    if (!match) continue;

                    sel.value = match.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    return {
                        name: sel.name || sel.id || 'tipo',
                        value: match.value,
                        label: (match.textContent || '').trim()
                    };
                }

                return null;
            }, effectiveParteTipo, getActiveTabSelector(tab));

            if (selectedTipo) {
                console.log('[SCWScraper] Tipo parte:', JSON.stringify(selectedTipo));
                await new Promise(r => setTimeout(r, 400));
            }
        }

        // 4. Llenar campos
        if (tab === 'porExpediente') {
            await page.evaluate((n, a) => {
                const num = document.querySelector('input[name="formPublica:numero"]');
                const yr = document.querySelector('input[name="formPublica:anio"]');
                if (num) { num.value = n; num.dispatchEvent(new Event('input', { bubbles: true })); }
                if (yr) { yr.value = a; yr.dispatchEvent(new Event('input', { bubbles: true })); }
            }, String(numero || ''), String(anio || ''));
        } else if (tab === 'porParte' && nombre) {
            const filledInput = await page.evaluate((n, activeTabSelector) => {
                const activeRoot = document.querySelector(activeTabSelector) || document;
                const preferred =
                    activeRoot.querySelector('input[name="formPublica:nomIntervParte"], #formPublica\\:nomIntervParte') ||
                    activeRoot.querySelector('input[name*="nomIntervParte"], input[id*="nomIntervParte"]');

                if (preferred) {
                    preferred.focus();
                    preferred.value = n;
                    preferred.dispatchEvent(new Event('input', { bubbles: true }));
                    preferred.dispatchEvent(new Event('change', { bubbles: true }));
                    return { name: preferred.name || preferred.id || '', value: preferred.value, strategy: 'preferred' };
                }

                const visibleInputs = [...activeRoot.querySelectorAll('input[type="text"], input:not([type])')].filter((inp) => {
                    const st = window.getComputedStyle(inp);
                    return st.display !== 'none' && st.visibility !== 'hidden' && inp.offsetParent !== null;
                });
                const fallback = visibleInputs.find((inp) =>
                    (inp.name || '').includes('parte') ||
                    (inp.name || '').includes('nombre') ||
                    (inp.id || '').includes('parte') ||
                    (inp.id || '').includes('nombre')
                ) || visibleInputs[0];

                if (fallback) {
                    fallback.focus();
                    fallback.value = n;
                    fallback.dispatchEvent(new Event('input', { bubbles: true }));
                    fallback.dispatchEvent(new Event('change', { bubbles: true }));
                    return { name: fallback.name || fallback.id || '', value: fallback.value, strategy: 'visible-fallback' };
                }

                return null;
            }, nombre, getActiveTabSelector(tab));
            console.log('[SCWScraper] Campo parte:', JSON.stringify(filledInput));
        }

        // 5. Resolver captcha con Gemini Vision
        const captchaFrame = page.frames().find(f => f.url().includes('captcha.pjn'));
        if (!captchaFrame) throw new Error('CAPTCHA_FRAME_NOT_FOUND');

        const captchaToken = await solveCaptchaInPage(page, captchaFrame);
        if (!captchaToken) throw new Error('CAPTCHA_SOLVE_FAILED');

        // 6. Clickear "Consultar"
        console.log('[SCWScraper] Clickeando Consultar...');
        const clickMeta = await page.evaluate((activeTabSelector, currentTab) => {
            const activeRoot = document.querySelector(activeTabSelector) || document;
            const preferredSelector = currentTab === 'porParte'
                ? 'input[name="formPublica:buscarPorParteButton"], #formPublica\\:buscarPorParteButton'
                : 'input[name="formPublica:buscarPorNumeroButton"], #formPublica\\:buscarPorNumeroButton';
            const preferred = activeRoot.querySelector(preferredSelector);
            if (preferred) {
                preferred.click();
                return { id: preferred.id || '', name: preferred.name || '', strategy: 'preferred' };
            }

            const visibleSubmits = [...activeRoot.querySelectorAll('input[type="submit"], button[type="submit"], input[value="Consultar"]')].filter((el) => {
                const st = window.getComputedStyle(el);
                return st.display !== 'none' && st.visibility !== 'hidden' && el.offsetParent !== null;
            });
            const fallback = visibleSubmits[0];
            if (fallback) {
                fallback.click();
                return { id: fallback.id || '', name: fallback.name || '', strategy: 'visible-fallback' };
            }

            const globalFallback =
                document.querySelector('input[name="formPublica:buscarPorParteButton"]') ||
                document.querySelector('input[name="formPublica:buscarPorNumeroButton"]') ||
                document.querySelector('input[value="Consultar"]') ||
                document.querySelector('input[type="submit"]');
            if (globalFallback) {
                globalFallback.click();
                return { id: globalFallback.id || '', name: globalFallback.name || '', strategy: 'global-fallback' };
            }
            return null;
        }, getActiveTabSelector(tab), tab);
        console.log('[SCWScraper] Boton consultar:', JSON.stringify(clickMeta));

        // 7. Esperar resultados
        console.log('[SCWScraper] Esperando resultados...');
        await page.waitForFunction(() => {
            return document.querySelectorAll('table').length > 2
                || document.querySelector('[class*="message"], [class*="Message"]') !== null;
        }, { timeout: 15000 }).catch(() => {
            console.warn('[SCWScraper] Timeout esperando resultados, continuando...');
        });
        await new Promise(r => setTimeout(r, 1500));

        // 8. Guardar screenshot de debug
        try {
            const { writeFileSync } = await import('fs');
            const scr = await page.screenshot({ encoding: 'base64', fullPage: true });
            writeFileSync('_results_page.png', Buffer.from(scr, 'base64'));
        } catch { }

        // 9. Extraer resultados (con paginacion "Siguiente" cuando existe)
        const parseResultsPage = async () => {
            return page.evaluate(() => {
                const normalizeText = (text = '') => {
                    try {
                        return String(text)
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase()
                            .trim();
                    } catch {
                        return String(text || '').toLowerCase().trim();
                    }
                };

                const allMessages = [...document.querySelectorAll('[class*="message"], [class*="Message"], [class*="error"]')]
                    .map(el => el.textContent?.trim())
                    .filter(t => t && t.length > 3 && t.length < 300);

                const allTables = [...document.querySelectorAll('table')];
                const likelyTables = allTables.filter(t =>
                    (t.className || '').includes('rich-table') ||
                    (t.id || '').includes('resultados') ||
                    (t.id || '').includes('expedientes')
                );
                const candidateTables = likelyTables.length > 0 ? likelyTables : allTables;

                let resultsTable = null;
                for (const table of candidateTables) {
                    const rows = [...table.querySelectorAll('tbody tr')];
                    const hasExpRow = rows.some((tr) => {
                        const firstCell = tr.querySelector('td');
                        return (firstCell?.textContent || '').includes('/');
                    });
                    if (hasExpRow) {
                        resultsTable = table;
                        break;
                    }
                }
                if (!resultsTable && candidateTables.length > 0) {
                    resultsTable = candidateTables[0];
                }

                const tableRows = [];
                if (resultsTable) {
                    resultsTable.querySelectorAll('tbody tr').forEach((tr) => {
                        const cells = [...tr.querySelectorAll('td')].map(td => td.textContent?.trim() || '');
                        if (cells.length >= 4 && cells[0].includes('/')) {
                            const link = tr.querySelector('a[href]');
                            tableRows.push({ cells, link: link ? link.href : null });
                        }
                    });
                }

                const headers = resultsTable
                    ? [...resultsTable.querySelectorAll('thead th')].map(th => th.textContent?.trim()).filter(Boolean)
                    : [...document.querySelectorAll('thead th')].map(th => th.textContent?.trim()).filter(Boolean);

                const first = tableRows[0];
                const firstSignature = first
                    ? first.cells.join('|').replace(/\s+/g, ' ').trim()
                    : '';

                const paginationCandidates = [];
                if (resultsTable) {
                    const tableContainer = resultsTable.closest('div') || resultsTable.parentElement;
                    if (tableContainer) {
                        paginationCandidates.push(...tableContainer.querySelectorAll('.pagination'));
                        const parent = tableContainer.parentElement;
                        if (parent) paginationCandidates.push(...parent.querySelectorAll('.pagination'));
                    }
                }
                paginationCandidates.push(...document.querySelectorAll('.pagination'));

                let paginationRoot = null;
                for (const p of paginationCandidates) {
                    if (p && p.querySelector('li a, a[title], .fa-chevron-right, .fa-arrow-circle-o-right')) {
                        paginationRoot = p;
                        break;
                    }
                }

                let currentPage = 1;
                let totalPages = 1;
                let hasNext = false;

                if (paginationRoot) {
                    const activeLi = paginationRoot.querySelector('li.active');
                    currentPage = Number.parseInt((activeLi?.textContent || '').replace(/\D/g, ''), 10) || 1;
                    const numericLinks = [...paginationRoot.querySelectorAll('li a')]
                        .map(a => Number.parseInt((a.textContent || '').trim(), 10))
                        .filter(n => Number.isFinite(n));
                    totalPages = numericLinks.length ? Math.max(currentPage, ...numericLinks) : currentPage;
                    const hasNumericNext = numericLinks.some(n => n > currentPage);

                    const links = [...paginationRoot.querySelectorAll('li a, a')];
                    const hasArrowNext = links.some((a) => {
                        const ownTitle = a.getAttribute('title') || '';
                        const nestedTitles = [...a.querySelectorAll('[title]')]
                            .map(n => n.getAttribute('title') || '')
                            .join(' ');
                        const label = normalizeText(`${ownTitle} ${nestedTitles} ${a.textContent || ''}`);
                        const hasRightIcon = !!a.querySelector('.fa-arrow-circle-o-right, .fa-chevron-right, .fa-angle-right, .fa-caret-right');
                        const disabled = (a.closest('li')?.className || '').toLowerCase().includes('disabled');
                        return !disabled && (hasRightIcon || label.includes('siguiente') || label.includes('next') || label.includes('avanzar'));
                    });

                    hasNext = hasNumericNext || hasArrowNext;
                }

                return {
                    allMessages,
                    tableRows,
                    headers,
                    firstSignature,
                    currentPage,
                    totalPages,
                    hasNext
                };
            });
        };

        const clickNextResultsPage = async () => {
            return page.evaluate(() => {
                const normalizeText = (text = '') => {
                    try {
                        return String(text)
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase()
                            .trim();
                    } catch {
                        return String(text || '').toLowerCase().trim();
                    }
                };

                const paginationRoots = [...document.querySelectorAll('.pagination')];
                let targetRoot = paginationRoots.find((p) => p.querySelector('li.active'));
                if (!targetRoot) targetRoot = paginationRoots[0] || null;
                if (!targetRoot) return { clicked: false, expectedPage: null, reason: 'no_pagination' };

                const activeLi = targetRoot.querySelector('li.active');
                const currentPage = Number.parseInt((activeLi?.textContent || '').replace(/\D/g, ''), 10) || 1;
                const links = [...targetRoot.querySelectorAll('li a, a')];

                let nextLink = links.find((a) => {
                    const n = Number.parseInt((a.textContent || '').trim(), 10);
                    return Number.isFinite(n) && n === currentPage + 1;
                });

                if (!nextLink) {
                    nextLink = links.find((a) => {
                        const ownTitle = a.getAttribute('title') || '';
                        const nestedTitles = [...a.querySelectorAll('[title]')]
                            .map(n => n.getAttribute('title') || '')
                            .join(' ');
                        const label = normalizeText(`${ownTitle} ${nestedTitles} ${a.textContent || ''}`);
                        const hasRightIcon = !!a.querySelector('.fa-arrow-circle-o-right, .fa-chevron-right, .fa-angle-right, .fa-caret-right');
                        const disabled = (a.closest('li')?.className || '').toLowerCase().includes('disabled');
                        return !disabled && (hasRightIcon || label.includes('siguiente') || label.includes('next') || label.includes('avanzar'));
                    });
                }

                if (!nextLink) return { clicked: false, expectedPage: null, reason: 'no_next_link' };

                nextLink.click();
                return { clicked: true, expectedPage: currentPage + 1, reason: 'clicked' };
            });
        };

        const defaultMaxPages = tab === 'porParte' ? 20 : 6;
        const normalizedMaxPages = Math.max(
            1,
            Math.min(Number(maxPages) || defaultMaxPages, 80)
        );

        const allMessages = [];
        const headersFromPages = [];
        const allTableRows = [];
        const seenRows = new Set();
        let pagesFetched = 0;
        let totalPagesEstimate = 1;
        let truncated = false;

        while (pagesFetched < normalizedMaxPages) {
            const pageData = await parseResultsPage();
            pagesFetched += 1;
            totalPagesEstimate = Math.max(totalPagesEstimate, Number(pageData.totalPages) || 1);

            if (Array.isArray(pageData.allMessages)) {
                for (const m of pageData.allMessages) {
                    if (m && !allMessages.includes(m)) allMessages.push(m);
                }
            }
            if (Array.isArray(pageData.headers)) {
                for (const h of pageData.headers) {
                    if (h && !headersFromPages.includes(h)) headersFromPages.push(h);
                }
            }
            if (Array.isArray(pageData.tableRows)) {
                for (const row of pageData.tableRows) {
                    const key = (row.cells || []).join('|').replace(/\s+/g, ' ').trim();
                    if (!key || seenRows.has(key)) continue;
                    seenRows.add(key);
                    allTableRows.push(row);
                }
            }

            console.log(`[SCWScraper] Pagina resultados ${pageData.currentPage}/${pageData.totalPages} - filas en pagina: ${pageData.tableRows?.length || 0}`);

            if (!pageData.hasNext) break;
            if (pagesFetched >= normalizedMaxPages) {
                truncated = true;
                break;
            }

            const clickResult = await clickNextResultsPage();
            if (!clickResult.clicked) break;

            await page.waitForFunction(
                ({ expectedPage, prevSignature }) => {
                    const rows = [...document.querySelectorAll('tbody tr')];
                    const firstRow = rows[0];
                    const cells = firstRow ? [...firstRow.querySelectorAll('td')].map(td => (td.textContent || '').trim()) : [];
                    const currentSignature = cells.join('|').replace(/\s+/g, ' ').trim();

                    const paginations = [...document.querySelectorAll('.pagination')];
                    const pagRoot = paginations.find((p) => p.querySelector('li.active')) || paginations[0] || null;
                    const currentPage = Number.parseInt((pagRoot?.querySelector('li.active')?.textContent || '').replace(/\D/g, ''), 10) || 1;

                    return (
                        (Number.isFinite(expectedPage) && currentPage === expectedPage) ||
                        (!!currentSignature && currentSignature !== prevSignature)
                    );
                },
                {
                    timeout: 15000
                },
                {
                    expectedPage: clickResult.expectedPage,
                    prevSignature: pageData.firstSignature || ''
                }
            ).catch(() => {
                console.warn('[SCWScraper] Timeout esperando siguiente pagina de resultados.');
            });

            await new Promise(r => setTimeout(r, 700));
        }

        console.log('[SCWScraper] Mensajes:', JSON.stringify(allMessages?.slice(0, 3)));
        console.log(`[SCWScraper] Filas extraidas (total): ${allTableRows.length}`);
        if (truncated) {
            console.log(`[SCWScraper] Corte por maxPages=${normalizedMaxPages}.`);
        }

        const normalizeHeader = (value = '') => {
            try {
                return String(value)
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .trim();
            } catch {
                return String(value || '').toLowerCase().trim();
            }
        };

        const normalizedHeaders = (headersFromPages || []).map(normalizeHeader);
        const idxByHeader = {
            expediente: normalizedHeaders.findIndex((h) => h.includes('expediente')),
            caratula: normalizedHeaders.findIndex((h) => h.includes('caratula')),
            dependencia: normalizedHeaders.findIndex((h) => h.includes('dependenc') || h.includes('tribunal') || h.includes('juzgado')),
            situacion: normalizedHeaders.findIndex((h) => h.includes('situac')),
            ultimaAct: normalizedHeaders.findIndex((h) => h.includes('ult') || h.includes('ultima'))
        };

        const pickCell = (cells, index, fallback = '') => {
            if (Number.isInteger(index) && index >= 0 && index < cells.length) {
                return cells[index] || fallback;
            }
            return fallback;
        };

        const results = (allTableRows || []).map((row) => {
            const cells = row.cells || [];

            const expediente = pickCell(cells, idxByHeader.expediente, cells[0] || '');
            const dependencia = pickCell(cells, idxByHeader.dependencia, cells[1] || '');
            const caratula = pickCell(cells, idxByHeader.caratula, cells[2] || cells[1] || '');
            const situacion = pickCell(cells, idxByHeader.situacion, cells[3] || '');
            const ultimaActuacion = pickCell(cells, idxByHeader.ultimaAct, cells[4] || '');

            return {
                expediente,
                caratula,
                jurisdiccion: jurisdictionName || '',
                dependencia,
                situacion,
                ultimaActuacion,
                link: row.link || null
            };
        });

        const errorMsg = allMessages?.find(m =>
            m.toLowerCase().includes('error') ||
            m.toLowerCase().includes('completa') ||
            m.toLowerCase().includes('verifica')
        );

        // --- DEEP SCRAPING ON THE FLY ---
        // Si buscamos por expediente y nos devolvió algo con link, entramos y lo sacamos ya mismo
        if (tab === 'porExpediente' && results.length === 1 && results[0].link) {
            console.log('[SCWScraper] Un único resultado encontrado. Extrayendo detalle interno sin nuevo captcha...');
            try {
                // Hacemos click en el DOM en vez de goto para no romper el estado JSF
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { }),
                    page.evaluate(() => {
                        const trs = [...document.querySelectorAll('tbody tr')];
                        for (const tr of trs) {
                            let eyeIcon = tr.querySelector('.fa-eye, .fa-search');
                            let a = eyeIcon ? eyeIcon.closest('a') : (tr.querySelector('a[title*="Ver" i], a[title*="Detalle" i]') || tr.querySelector('a[href*="expediente.seam"]'));
                            if (a) {
                                a.removeAttribute('target');
                                a.click();
                                return;
                            }
                        }
                    })
                ]);
                await new Promise(r => setTimeout(r, 2000));

                const detalle = await extractDetalleCompleto(page);

                results[0].detalle = detalle;
                console.log('[SCWScraper] Detalle interno extraído con éxito y adjuntado.');
            } catch (deepErr) {
                console.warn('[SCWScraper] Error en deep-scraping on-the-fly:', deepErr.message);
            }
        }

        return {
            results,
            headers: headersFromPages || [],
            error: errorMsg || null,
            noResults: results.length === 0 && !errorMsg ? 'No se encontraron expedientes' : null,
            pagination: {
                pages_fetched: pagesFetched,
                total_pages_estimate: totalPagesEstimate,
                truncated,
                max_pages: normalizedMaxPages
            }
        };

    } finally {
        await browser.close();
    }
}

/**
 * Deep Scraper: Busca el expediente y entra al detalle para extraer Actuaciones e Intervinientes.
 */
export async function getExpedienteDetalle({ jurisdiccion, numero, anio }) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9' });
        await page.setViewport({ width: 1280, height: 900 });

        console.log(`[DeepScraper] Iniciando extracción detalle: Exp ${numero}/${anio} Jur: ${jurisdiccion}`);
        await page.goto(SCW_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));

        // Seleccionar jurisdicción
        if (jurisdiccion) {
            await page.evaluate((jur) => {
                const selects = document.querySelectorAll('select');
                for (const sel of selects) {
                    for (const opt of sel.options) {
                        if (opt.value === jur) {
                            sel.value = jur;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                            return;
                        }
                    }
                }
            }, jurisdiccion);
            await new Promise(r => setTimeout(r, 500));
        }

        // Llenar campos
        await page.evaluate((n, a) => {
            const num = document.querySelector('input[name="formPublica:numero"]');
            const yr = document.querySelector('input[name="formPublica:anio"]');
            if (num) { num.value = n; num.dispatchEvent(new Event('input', { bubbles: true })); }
            if (yr) { yr.value = a; yr.dispatchEvent(new Event('input', { bubbles: true })); }
        }, String(numero || ''), String(anio || ''));

        // Captcha
        const captchaFrame = page.frames().find(f => f.url().includes('captcha.pjn'));
        if (!captchaFrame) throw new Error('CAPTCHA_FRAME_NOT_FOUND');
        const captchaToken = await solveCaptchaInPage(page, captchaFrame);
        if (!captchaToken) throw new Error('CAPTCHA_SOLVE_FAILED');

        // Consultar
        await page.evaluate(() => {
            const btn = document.querySelector('input[name="formPublica:buscarPorNumeroButton"]');
            if (btn) btn.click();
        });

        console.log('[DeepScraper] Esperando tabla de resultados...');
        await page.waitForFunction(() => {
            return document.querySelectorAll('table').length > 2 || document.querySelector('[class*="message"], [class*="error"]') !== null;
        }, { timeout: 15000 });
        await new Promise(r => setTimeout(r, 1500));

        // Encontrar el link del primer expediente y clickearlo
        console.log('[DeepScraper] Haciendo clic en el link del expediente para navegar a detalle...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { }),
            page.evaluate(() => {
                const trs = [...document.querySelectorAll('tbody tr')];
                for (const tr of trs) {
                    let eyeIcon = tr.querySelector('.fa-eye, .fa-search');
                    let a = eyeIcon ? eyeIcon.closest('a') : (tr.querySelector('a[title*="Ver" i], a[title*="Detalle" i]') || tr.querySelector('a[href*="expediente.seam"]'));
                    if (a) {
                        a.removeAttribute('target');
                        a.click();
                        return;
                    }
                }
            })
        ]);
        await new Promise(r => setTimeout(r, 2000));

        // Extraer todo el detalle iterando sobre las páginas
        const detalle = await extractDetalleCompleto(page);

        // Tomar pantallazo por si falla extra pestaña (debug)
        await page.screenshot({ path: '_deep_scraper.png', fullPage: true }).catch(() => { });

        console.log(`[DeepScraper] Fin. Actuaciones: ${detalle.actuaciones.length}, Intervinientes: ${detalle.intervinientes.length}`);
        return detalle;

    } catch (err) {
        console.error('[DeepScraper] Error:', err.message);
        throw err;
    } finally {
        await browser.close();
    }
}

/**
 * Función auxiliar para navegar por las pantallas de SCW
 * Extrayendo "Históricas", "Ver Todos" y Paginación recursiva.
 */
async function extractDetalleCompleto(page) {
    const isDetail = await page.evaluate(() =>
        document.querySelector('span[id*="formVisualizacionExpediente"]') !== null || document.querySelector('label') !== null
    );

    await page.screenshot({ path: 'debug_scw_detail.png', fullPage: true }).catch(() => { });
    const html = await page.content();
    require('fs').writeFileSync('debug_scw_detail.html', html);

    if (!isDetail) {
        throw new Error('EXPEDIENTE_NO_ENCONTRADO - Sesion rechazada por el portal.');
    }

    const baseObj = await page.evaluate(() => {
        const obj = { datosGenerales: {}, actuaciones: [], intervinientes: [] };

        const generalRows = document.querySelectorAll('span[id*="formVisualizacionExpediente"]');
        generalRows.forEach(span => {
            const text = span.textContent?.trim();
            if (text && text.includes(':')) {
                const [key, val] = text.split(':').map(s => s.trim());
                if (key && val) obj.datosGenerales[key] = val;
            }
        });

        if (Object.keys(obj.datosGenerales).length === 0) {
            const labels = document.querySelectorAll('label');
            labels.forEach(lbl => {
                const key = lbl.textContent?.replace(':', '').trim();
                const valEl = lbl.nextElementSibling || lbl.parentElement?.nextElementSibling;
                if (key && valEl) {
                    const val = valEl.textContent?.trim();
                    if (val && val !== '/' && !val.includes('Seleccione una opcion')) {
                        obj.datosGenerales[key] = val;
                    }
                }
            });
        }

        const intsTable = document.querySelector('table[id*="Interviniente"]');
        if (intsTable) {
            intsTable.querySelectorAll('tbody tr').forEach(tr => {
                const cells = [...tr.querySelectorAll('td')].map(t => (t.textContent || '').trim());
                if (cells.length > 1) {
                    obj.intervinientes.push({ tipo: cells[0] || '', nombre: cells[1] || '' });
                }
            });
        }

        return obj;
    });

    let actsAll = [];
    let paginasTotales = 0;

    const normalize = (text = '') => {
        try {
            return String(text)
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
        } catch {
            return String(text || '').toLowerCase().trim();
        }
    };

    const scrapeCurrentTablePages = async () => {
        try {
            const verTodosFound = await page.evaluate(() => {
                const labels = [...document.querySelectorAll('label')];
                const verTodosLbl = labels.find(l => l.textContent && l.textContent.includes('Ver Todos'));
                if (!verTodosLbl) return false;
                const cb = verTodosLbl.previousElementSibling || verTodosLbl.querySelector('input') || document.getElementById(verTodosLbl.getAttribute('for'));
                return !!(cb && cb.type === 'checkbox' && !cb.checked);
            });

            if (verTodosFound) {
                console.log('[DeepScraper] "Ver Todos" detectado, intentando aplicar...');
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { }),
                    page.evaluate(() => {
                        const labels = [...document.querySelectorAll('label')];
                        const verTodosLbl = labels.find(l => l.textContent && l.textContent.includes('Ver Todos'));
                        if (!verTodosLbl) return;
                        const cb = verTodosLbl.previousElementSibling || verTodosLbl.querySelector('input') || document.getElementById(verTodosLbl.getAttribute('for'));
                        if (!cb) return;
                        cb.click();
                        const btnAplicar = [...document.querySelectorAll('input[type="submit"], button, a')]
                            .find(b =>
                                (b.value && b.value.includes('Aplicar')) ||
                                (b.textContent && b.textContent.includes('Aplicar')) ||
                                (b.title && b.title.includes('Aplicar'))
                            );
                        if (btnAplicar) btnAplicar.click();
                    })
                ]);
                await new Promise(r => setTimeout(r, 1200));
            }
        } catch (e) {
            console.warn('[DeepScraper] No se pudo accionar "Ver Todos":', e.message);
        }

        const currentActs = [];
        const seenActKeys = new Set();
        let safety = 0;
        let pagesVisited = 0;

        while (safety < 50) {
            safety++;

            const pageData = await page.evaluate(() => {
                const cleanText = (t) => t
                    ? t
                        .replace(/^(Oficina:|Fecha:|Tipo actuacion:|Descripcion:)\s*/i, '')
                        .replace(/\s+/g, ' ')
                        .trim()
                    : '';

                const actsTable = document.querySelector('table[id*="action-table"], table[id*="action"], table[id*="actuaciones"], table[id*="Despachos"]');
                const acts = [];
                if (actsTable) {
                    actsTable.querySelectorAll('tbody tr').forEach(tr => {
                        const cells = [...tr.querySelectorAll('td')].map(td => cleanText(td.textContent || ''));
                        if (cells.length < 5) return;

                        let linkVer = '';
                        let linkDescargar = '';
                        [...tr.querySelectorAll('a')].forEach(a => {
                            if (a.querySelector('.fa-eye')) linkVer = a.href;
                            if (a.querySelector('.fa-download')) linkDescargar = a.href;
                        });

                        acts.push({
                            oficina: cells[1] || '',
                            fecha: cells[2] || '',
                            tipo: cells[3] || '',
                            descripcion: cells[4] || '',
                            fojas: cells[5] || '',
                            linkVer,
                            linkDescargar
                        });
                    });
                }

                const first = acts[0];
                const firstSignature = first
                    ? (first.fecha + '|' + first.tipo + '|' + first.oficina + '|' + first.descripcion).replace(/\s+/g, ' ').trim()
                    : '';

                const paginationRoot =
                    document.querySelector('[id*="divPagesAct"] .pagination') ||
                    document.querySelector('#expediente\\:j_idt217 .pagination') ||
                    document.querySelector('.pagination');

                if (!paginationRoot) {
                    return {
                        acts,
                        rowsCount: acts.length,
                        firstSignature,
                        currentPage: 1,
                        totalPages: 1,
                        hasNext: false
                    };
                }

                const activeLi = paginationRoot.querySelector('li.active');
                const currentPage = Number.parseInt((activeLi?.textContent || '').replace(/\D/g, ''), 10) || 1;
                const numericLinks = [...paginationRoot.querySelectorAll('li a')]
                    .map(a => Number.parseInt((a.textContent || '').trim(), 10))
                    .filter(n => Number.isFinite(n));
                const totalPages = numericLinks.length ? Math.max(currentPage, ...numericLinks) : currentPage;
                const hasNumericNext = numericLinks.some(n => n > currentPage);
                const hasArrowNext = !!paginationRoot.querySelector('a i.fa-arrow-circle-o-right, a i.fa-chevron-right, a i.fa-angle-right, a i.fa-caret-right');

                return {
                    acts,
                    rowsCount: acts.length,
                    firstSignature,
                    currentPage,
                    totalPages,
                    hasNext: hasNumericNext || hasArrowNext
                };
            });

            pagesVisited++;

            for (const act of pageData.acts || []) {
                const key = normalize(act.fecha + '|' + act.tipo + '|' + act.oficina + '|' + act.descripcion + '|' + act.fojas);
                if (!key || seenActKeys.has(key)) continue;
                seenActKeys.add(key);
                currentActs.push(act);
            }

            console.log('[DeepScraper] Tabla actual - pagina ' + pageData.currentPage + '/' + pageData.totalPages + ' - filas: ' + pageData.rowsCount);

            if (!pageData.hasNext) {
                break;
            }

            const clickResult = await page.evaluate(() => {
                const normalizeText = (text = '') => {
                    try {
                        return String(text)
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase()
                            .trim();
                    } catch {
                        return String(text || '').toLowerCase().trim();
                    }
                };

                const paginationRoot =
                    document.querySelector('[id*="divPagesAct"] .pagination') ||
                    document.querySelector('#expediente\\:j_idt217 .pagination') ||
                    document.querySelector('.pagination');

                if (!paginationRoot) {
                    return { clicked: false, reason: 'no_pagination', expectedPage: null };
                }

                const activeLi = paginationRoot.querySelector('li.active');
                const currentPage = Number.parseInt((activeLi?.textContent || '').replace(/\D/g, ''), 10) || 1;
                const links = [...paginationRoot.querySelectorAll('li a')];

                let nextLink = links.find(a => {
                    const n = Number.parseInt((a.textContent || '').trim(), 10);
                    return Number.isFinite(n) && n === currentPage + 1;
                });

                if (!nextLink) {
                    nextLink = links.find(a => {
                        const ownTitle = a.getAttribute('title') || '';
                        const nestedTitles = [...a.querySelectorAll('[title]')].map(n => n.getAttribute('title') || '').join(' ');
                        const label = normalizeText(ownTitle + ' ' + nestedTitles + ' ' + (a.textContent || ''));
                        const hasRightIcon = !!a.querySelector('.fa-arrow-circle-o-right, .fa-chevron-right, .fa-angle-right, .fa-caret-right');
                        return hasRightIcon || label.includes('siguiente') || label.includes('next') || label.includes('avanzar');
                    });
                }

                if (!nextLink) {
                    return { clicked: false, reason: 'no_next_link', expectedPage: currentPage };
                }

                nextLink.click();
                return { clicked: true, reason: 'clicked', expectedPage: currentPage + 1 };
            });

            if (!clickResult.clicked) {
                console.log('[DeepScraper] Sin boton siguiente utilizable (' + clickResult.reason + ').');
                break;
            }

            console.log('[DeepScraper] Paginando tabla (' + pageData.currentPage + ' -> ' + clickResult.expectedPage + ')...');

            await page.waitForFunction(
                ({ prevSignature, prevPage, expectedPage }) => {
                    const cleanText = (t) => t ? t.replace(/\s+/g, ' ').trim() : '';
                    const table = document.querySelector('table[id*="action-table"], table[id*="action"], table[id*="actuaciones"], table[id*="Despachos"]');
                    let currentSignature = '';
                    if (table) {
                        const firstTr = table.querySelector('tbody tr');
                        if (firstTr) {
                            const cells = [...firstTr.querySelectorAll('td')].map(td => cleanText(td.textContent || ''));
                            currentSignature = (cells[2] || '') + '|' + (cells[3] || '') + '|' + (cells[1] || '') + '|' + (cells[4] || '');
                        }
                    }

                    const paginationRoot =
                        document.querySelector('[id*="divPagesAct"] .pagination') ||
                        document.querySelector('#expediente\\:j_idt217 .pagination') ||
                        document.querySelector('.pagination');
                    const activeLi = paginationRoot?.querySelector('li.active');
                    const currentPage = Number.parseInt((activeLi?.textContent || '').replace(/\D/g, ''), 10) || prevPage;

                    return (
                        currentPage !== prevPage ||
                        (Number.isFinite(expectedPage) && currentPage === expectedPage) ||
                        (!!currentSignature && currentSignature !== prevSignature)
                    );
                },
                { timeout: 15000 },
                {
                    prevSignature: pageData.firstSignature || '',
                    prevPage: pageData.currentPage || 1,
                    expectedPage: clickResult.expectedPage
                }
            ).catch(() => {
                console.warn('[DeepScraper] Timeout esperando refresco de paginacion AJAX.');
            });

            const afterMove = await page.evaluate((prevPage, prevSignature) => {
                const cleanText = (t) => t ? t.replace(/\s+/g, ' ').trim() : '';
                const paginationRoot =
                    document.querySelector('[id*="divPagesAct"] .pagination') ||
                    document.querySelector('#expediente\\:j_idt217 .pagination') ||
                    document.querySelector('.pagination');
                const activeLi = paginationRoot?.querySelector('li.active');
                const currentPage = Number.parseInt((activeLi?.textContent || '').replace(/\D/g, ''), 10) || prevPage;

                const table = document.querySelector('table[id*="action-table"], table[id*="action"], table[id*="actuaciones"], table[id*="Despachos"]');
                let currentSignature = '';
                if (table) {
                    const firstTr = table.querySelector('tbody tr');
                    if (firstTr) {
                        const cells = [...firstTr.querySelectorAll('td')].map(td => cleanText(td.textContent || ''));
                        currentSignature = (cells[2] || '') + '|' + (cells[3] || '') + '|' + (cells[1] || '') + '|' + (cells[4] || '');
                    }
                }

                const moved = currentPage !== prevPage || (!!currentSignature && currentSignature !== prevSignature);
                return { moved, currentPage };
            }, pageData.currentPage || 1, pageData.firstSignature || '');

            if (!afterMove.moved) {
                console.warn('[DeepScraper] El portal no avanzo realmente de pagina; se corta para evitar loop.');
                break;
            }

            await new Promise(r => setTimeout(r, 900));
        }

        paginasTotales += Math.max(1, pagesVisited);
        return currentActs;
    };

    console.log('[DeepScraper] Extrayendo vista de actuaciones actuales...');
    const actsActuales = await scrapeCurrentTablePages();
    actsAll.push(...actsActuales);

    try {
        const historicasBtnFound = await page.evaluate(() => {
            const normalizeText = (text = '') => {
                try {
                    return String(text)
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .toLowerCase()
                        .trim();
                } catch {
                    return String(text || '').toLowerCase().trim();
                }
            };

            const btnHist = [...document.querySelectorAll('a, button')].find(el => {
                const label = normalizeText(el.textContent || '');
                return label.includes('ver historicas') || label.includes('ver hist');
            });

            return !!btnHist;
        });

        if (historicasBtnFound) {
            console.log('[DeepScraper] "Ver historicas" detectado, entrando...');
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { }),
                page.evaluate(() => {
                    const normalizeText = (text = '') => {
                        try {
                            return String(text)
                                .normalize('NFD')
                                .replace(/[\u0300-\u036f]/g, '')
                                .toLowerCase()
                                .trim();
                        } catch {
                            return String(text || '').toLowerCase().trim();
                        }
                    };

                    const btnHist = [...document.querySelectorAll('a, button')].find(el => {
                        const label = normalizeText(el.textContent || '');
                        return label.includes('ver historicas') || label.includes('ver hist');
                    });
                    if (btnHist) btnHist.click();
                })
            ]);

            await new Promise(r => setTimeout(r, 1200));

            const tieneHistoricas = await page.evaluate(() => {
                const text = (document.body?.textContent || '')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase();
                return !text.includes('no posee actuaciones historicas');
            });

            if (tieneHistoricas) {
                console.log('[DeepScraper] Extrayendo vista de actuaciones historicas...');
                const actsHist = await scrapeCurrentTablePages();
                actsAll.push(...actsHist);
            } else {
                console.log('[DeepScraper] La vista historica indico que esta vacia.');
            }
        }
    } catch (e) {
        console.warn('[DeepScraper] Ignorando paso historicas:', e.message);
    }

    baseObj.actuaciones = actsAll;
    baseObj.paginasActuaciones = paginasTotales || 1;
    return baseObj;
}
