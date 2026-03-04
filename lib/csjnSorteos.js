import crypto from 'crypto';
import puppeteer from 'puppeteer';
import { normalizeCsjnAlertFilters } from './csjnAlertFilters.js';

const isVercel = process.env.VERCEL === '1';

const SORTEOS_URL = 'https://www.csjn.gov.ar/tribunales-federales-nacionales/sorteos';
const CSJN_REFERER = 'https://judic-ia.com';

function cleanText(value) {
    return String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripUiNoise(value) {
    return cleanText(value)
        .replace(/\bver todos\b/gi, '')
        .replace(/\bver menos\b/gi, '')
        .replace(/\s+-\s*$/g, '')
        .trim();
}

function toIsoDate(value) {
    const text = cleanText(value);
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;

    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];

    return `${year}-${month}-${day}`;
}

function toArDate(value) {
    const text = cleanText(value);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return `${match[3]}/${match[2]}/${match[1]}`;
}

function normalizeRequestedDate(value) {
    if (!value) return null;

    const text = cleanText(value);
    if (!text) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return { iso: text, ar: toArDate(text) };
    }

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
        const [day, month, year] = text.split('/');
        const ar = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
        return { ar, iso: toIsoDate(ar) };
    }

    return null;
}

function normalizeRequestedRange(fromValue, toValue) {
    const fromDate = normalizeRequestedDate(fromValue);
    const toDate = normalizeRequestedDate(toValue);

    if (!fromDate && !toDate) return null;
    if (!fromDate || !toDate) return { invalid: true };
    if (!fromDate.iso || !toDate.iso) return { invalid: true };
    if (fromDate.iso > toDate.iso) return { invalid: true };

    return {
        from_iso: fromDate.iso,
        from_ar: fromDate.ar,
        to_iso: toDate.iso,
        to_ar: toDate.ar
    };
}

function pickFirst(raw, keys) {
    const source = raw || {};
    const normalizedEntries = Object.entries(source).map(([key, value]) => ({
        key,
        normalized: cleanText(key)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''),
        value
    }));

    for (const key of keys) {
        const value = source[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return value;
        }

        const normalizedKey = cleanText(key)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const fallback = normalizedEntries.find((entry) => entry.normalized === normalizedKey)?.value;
        if (fallback !== undefined && fallback !== null && String(fallback).trim() !== '') {
            return fallback;
        }
    }
    return '';
}

function pickByTokens(raw, tokenSets) {
    const entries = Object.entries(raw || {}).map(([key, value]) => ({
        key: cleanText(key)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        value
    }));

    for (const tokens of tokenSets) {
        const found = entries.find((entry) => tokens.every((token) => entry.key.includes(token)));
        if (found && found.value !== undefined && found.value !== null && String(found.value).trim() !== '') {
            return found.value;
        }
    }

    return '';
}

function buildStableId(item) {
    const base = [
        item.assigned_date_iso || item.assigned_date || '',
        item.expediente || '',
        item.dependencia_asignada || '',
        item.denunciantes || '',
        item.denunciados || ''
    ].join('|');

    const digest = crypto.createHash('sha1').update(base).digest('hex').slice(0, 16);
    return `sorteo-${digest}`;
}

async function readCsjnCaptchaWithVision(base64Image) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is missing');

    const body = {
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: { url: `data:image/png;base64,${base64Image}` }
                    },
                    {
                        type: 'text',
                        text: 'Read this CAPTCHA and return ONLY the exact characters (letters and digits). No spaces or punctuation.'
                    }
                ]
            }
        ],
        max_tokens: 12,
        temperature: 0
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': CSJN_REFERER,
            'X-Title': 'Judic-IA CSJN Sorteos Solver'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OPENROUTER_ERROR_${response.status}: ${errText.slice(0, 200)}`);
    }

    const json = await response.json();
    const raw = cleanText(json?.choices?.[0]?.message?.content || '');
    const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);

    if (!cleaned) {
        throw new Error('CAPTCHA_OCR_EMPTY');
    }

    return cleaned;
}

async function setJuzgadosFilters(page, filters = {}) {
    await page.evaluate((input) => {
        const mode = input?.mode || 'exact';
        const exactDate = input?.exactDate || '';
        const rangeFrom = input?.rangeFrom || '';
        const rangeTo = input?.rangeTo || '';
        const dependencyOfficeId = input?.dependencyOfficeId || '';
        const intervinienteName = input?.intervinienteName || '';
        const includeDenunciante = Boolean(input?.includeDenunciante);
        const includeDenunciado = Boolean(input?.includeDenunciado);

        const exactOption = document.getElementById('e1-option');
        const rangeOption = document.getElementById('f1-option');

        const exactHidden = document.getElementById('fecha_exacta_juzgados');
        const fromHidden = document.getElementById('fecha_juzgados_desde');
        const toHidden = document.getElementById('fecha_juzgados_hasta');

        const fromAux = document.getElementById('fecha_juzgados_desde_aux');
        const toAux = document.getElementById('fecha_juzgados_hasta_aux');
        const dependenciaSelect = document.getElementById('oficina');

        if (mode === 'range') {
            if (rangeOption && !rangeOption.checked) rangeOption.click();
            if (exactHidden) exactHidden.value = '';
            if (fromHidden) fromHidden.value = rangeFrom;
            if (toHidden) toHidden.value = rangeTo;
            if (fromAux) fromAux.value = rangeFrom;
            if (toAux) toAux.value = rangeTo;
        } else {
            if (exactOption && !exactOption.checked) exactOption.click();
            if (exactHidden) {
                exactHidden.value = exactDate;
                exactHidden.setAttribute('value', exactDate);
                exactHidden.dispatchEvent(new Event('change', { bubbles: true }));
                exactHidden.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (fromHidden) fromHidden.value = '';
            if (toHidden) toHidden.value = '';
            if (fromAux) fromAux.value = '';
            if (toAux) toAux.value = '';
        }

        if (dependenciaSelect) {
            dependenciaSelect.value = dependencyOfficeId;
            dependenciaSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const intervinienteInput = document.querySelector('input[name=\"nombre[]\"]');
        if (intervinienteInput) {
            intervinienteInput.value = intervinienteName;
            intervinienteInput.dispatchEvent(new Event('input', { bubbles: true }));
            intervinienteInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const denuncianteCheckbox = document.querySelector('#op1te, input[name=\"op1[]\"][value=\"DENUNCIANTE\"]');
        const denunciadoCheckbox = document.querySelector('#op1do, input[name=\"op1[]\"][value=\"DENUNCIADO\"]');
        if (denuncianteCheckbox) denuncianteCheckbox.checked = !!intervinienteName && includeDenunciante;
        if (denunciadoCheckbox) denunciadoCheckbox.checked = !!intervinienteName && includeDenunciado;

        const selectorInput = document.querySelector('input[name="selector"]:checked');
        if (!selectorInput || !selectorInput.value) {
            if (mode === 'range' && rangeOption) rangeOption.checked = true;
            if (mode !== 'range' && exactOption) exactOption.checked = true;
        }

        const captchaInput = document.getElementById('captcha_code');
        if (captchaInput) captchaInput.value = '';
    }, {
        mode: filters.mode || 'exact',
        exactDate: filters.exactDate || '',
        rangeFrom: filters.rangeFrom || '',
        rangeTo: filters.rangeTo || '',
        dependencyOfficeId: filters.dependencyOfficeId || '',
        intervinienteName: filters.intervinienteName || '',
        includeDenunciante: filters.includeDenunciante === undefined ? true : !!filters.includeDenunciante,
        includeDenunciado: filters.includeDenunciado === undefined ? true : !!filters.includeDenunciado
    });
}

async function refreshCsjnCaptcha(page) {
    await page.evaluate(() => {
        const captchaImage = document.getElementById('captcha');
        if (!captchaImage) return;
        captchaImage.src = `lib/securimage/securimage_show.php?${Math.random()}`;
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
}

async function readCaptchaFromPage(page) {
    const captchaImage = await page.$('#captcha');
    if (!captchaImage) throw new Error('CSJN_CAPTCHA_IMAGE_NOT_FOUND');

    const base64 = await captchaImage.screenshot({ encoding: 'base64' });
    return readCsjnCaptchaWithVision(base64);
}

async function submitJuzgadosForm(page, captchaValue) {
    await page.evaluate((captcha) => {
        const captchaInput = document.getElementById('captcha_code');
        if (captchaInput) {
            captchaInput.value = captcha;
            captchaInput.dispatchEvent(new Event('change', { bubbles: true }));
            captchaInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const form = document.getElementById('juzgados');
        if (form) form.submit();
    }, captchaValue);

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 1600));
}

async function hasCaptchaError(page) {
    return page.evaluate(() => {
        const text = (document.body?.innerText || '').toLowerCase();
        return text.includes('captcha mal ingresado') || text.includes('verifique el captcha');
    });
}

async function runCsjnCaptchaSearch(page, filters = {}, maxAttempts = 6) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            if (attempt > 1) {
                await refreshCsjnCaptcha(page);
            }

            await setJuzgadosFilters(page, filters);
            const captchaValue = await readCaptchaFromPage(page);
            await submitJuzgadosForm(page, captchaValue);

            const invalidCaptcha = await hasCaptchaError(page);
            if (!invalidCaptcha) {
                return;
            }
        } catch (error) {
            if (attempt === maxAttempts) throw error;
        }
    }

    throw new Error('CSJN_CAPTCHA_SOLVE_FAILED');
}

function mapCases(items, fallbackDate = null) {
    return (items || []).map((raw) => {
        const assignedDate = stripUiNoise(pickFirst(raw, [
            'Fecha de Asignacion',
            'Fecha de Asignacion:'
        ]) || pickByTokens(raw, [['fecha', 'asign']]) || fallbackDate || '');

        const assignedDateIso = toIsoDate(assignedDate);

        const item = {
            assigned_date: assignedDate,
            assigned_date_iso: assignedDateIso,
            expediente: stripUiNoise(pickFirst(raw, ['Expediente', 'Expediente:'])),
            tipo: stripUiNoise(pickFirst(raw, ['Tipo', 'Tipo:'])),
            motivo_asignacion: stripUiNoise(pickFirst(raw, [
                'Motivo Asignacion',
                'Motivo Asignacion:',
                'Motivo de Asignacion',
                'Motivo de Asignacion:',
                'Motivo de Intervencion',
                'Motivo de Intervencion:'
            ]) || pickByTokens(raw, [['motivo', 'asign'], ['motivo', 'interv']])),
            dependencia_asignada: stripUiNoise(pickFirst(raw, [
                'Dependencia Asignada',
                'Dependencia Asignada:'
            ]) || pickByTokens(raw, [['dependencia', 'asign']])),
            denunciantes: stripUiNoise(pickFirst(raw, ['Denunciantes', 'Denunciantes:']) || pickByTokens(raw, [['denunciante']])),
            denunciados: stripUiNoise(pickFirst(raw, ['Denunciados', 'Denunciados:']) || pickByTokens(raw, [['denunciado']])),
            delitos: stripUiNoise(pickFirst(raw, ['Delitos', 'Delitos:']) || pickByTokens(raw, [['delito']])),
            origen: stripUiNoise(pickFirst(raw, ['Origen', 'Origen:']) || pickByTokens(raw, [['origen']])),
            source_url: SORTEOS_URL
        };

        return {
            ...item,
            id: buildStableId(item)
        };
    });
}

async function extractCsjnPayload(page) {
    return page.evaluate(() => {
        const titleEl = document.querySelector('.sorteos-title');
        const titleText = (titleEl?.textContent || '').trim();
        const bodyText = (document.body?.innerText || '').trim();

        const rows = Array.from(document.querySelectorAll('#sorteos-resultado .result'));
        const items = rows.map((resultNode) => {
            const record = {};
            resultNode.querySelectorAll('li').forEach((li) => {
                const labelNode = li.querySelector('span.s2');
                if (!labelNode) return;

                const rawLabel = (labelNode.textContent || '').replace(':', '').trim();
                const rawValue = (li.textContent || '').replace(labelNode.textContent || '', '').trim();
                if (rawLabel) record[rawLabel] = rawValue;
            });
            return record;
        });

        const hasCaptchaError = /captcha mal ingresado|verifique el captcha/i.test(bodyText);

        return { titleText, bodyText, items, hasCaptchaError };
    });
}

export async function fetchCsjnDailySorteos(options = {}) {
    const requestedDate = normalizeRequestedDate(options?.exactDate || options?.date || null);
    const requestedRange = normalizeRequestedRange(options?.fromDate || options?.dateFrom, options?.toDate || options?.dateTo);
    const normalizedAlertFilters = normalizeCsjnAlertFilters(options?.filters || {});
    const hasAdvancedFilters = Object.keys(normalizedAlertFilters).length > 0;

    if (requestedRange?.invalid) {
        throw new Error('CSJN_DATE_RANGE_INVALID');
    }

    if (requestedDate && requestedRange) {
        throw new Error('CSJN_DATE_AND_RANGE_CONFLICT');
    }

    const shouldRunCaptchaSearch = Boolean(
        requestedDate?.ar ||
        requestedRange?.from_ar ||
        hasAdvancedFilters ||
        options?.forceCaptcha
    );

    let browser;
    if (isVercel) {
        const chromium = (await import('@sparticuz/chromium-min')).default;
        const puppeteerCore = (await import('puppeteer-core')).default;

        browser = await puppeteerCore.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(
                'https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar'
            ),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
    } else {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
    }

    try {
        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );

        await page.goto(SORTEOS_URL, { waitUntil: 'networkidle2', timeout: 90000 });
        await new Promise((resolve) => setTimeout(resolve, 2500));

        if (shouldRunCaptchaSearch) {
            await runCsjnCaptchaSearch(page, requestedRange
                ? {
                    mode: 'range',
                    rangeFrom: requestedRange.from_ar,
                    rangeTo: requestedRange.to_ar,
                    dependencyOfficeId: normalizedAlertFilters.dependency_office_id || '',
                    intervinienteName: normalizedAlertFilters.interviniente_name || '',
                    includeDenunciante: normalizedAlertFilters.role_denunciante !== false,
                    includeDenunciado: normalizedAlertFilters.role_denunciado !== false
                }
                : {
                    mode: 'exact',
                    exactDate: requestedDate?.ar || '',
                    dependencyOfficeId: normalizedAlertFilters.dependency_office_id || '',
                    intervinienteName: normalizedAlertFilters.interviniente_name || '',
                    includeDenunciante: normalizedAlertFilters.role_denunciante !== false,
                    includeDenunciado: normalizedAlertFilters.role_denunciado !== false
                });
        }

        const payload = await extractCsjnPayload(page);

        if (payload?.hasCaptchaError) {
            throw new Error('CSJN_CAPTCHA_SOLVE_FAILED');
        }

        const sourceDate = (
            cleanText(payload?.titleText).match(/-\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*$/)?.[1] ||
            cleanText(payload?.bodyText).match(/Resultados del sorteo[^-]*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] ||
            requestedDate?.ar ||
            requestedRange?.to_ar ||
            null
        );

        const cases = mapCases(payload?.items || [], sourceDate);

        return {
            source: 'csjn_sorteos',
            source_url: SORTEOS_URL,
            fetched_at: new Date().toISOString(),
            source_date: sourceDate,
            source_date_iso: sourceDate ? toIsoDate(sourceDate) : null,
            requested_date: requestedDate?.ar || null,
            requested_date_iso: requestedDate?.iso || null,
            requested_range_from: requestedRange?.from_ar || null,
            requested_range_to: requestedRange?.to_ar || null,
            requested_range_from_iso: requestedRange?.from_iso || null,
            requested_range_to_iso: requestedRange?.to_iso || null,
            applied_filters: hasAdvancedFilters ? normalizedAlertFilters : null,
            total: cases.length,
            cases
        };
    } finally {
        await browser.close();
    }
}
