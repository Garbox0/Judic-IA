import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { verifyAccess } from '@/lib/tierMiddleware';
import { isTrialExpired } from '@/app/lib/subscription';

function normalizeYear(input) {
    const parsed = Number.parseInt(String(input ?? '').replace(/\D/g, ''), 10);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < 1900 || parsed > 2100) return null;
    return parsed;
}

function parseFlexibleDate(input) {
    if (!input) return null;
    const text = String(input).trim();
    if (!text) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const date = new Date(`${text}T00:00:00Z`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (!match) return null;

    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const year = Number.parseInt(match[3], 10);
    if (!day || !month || !year) return null;

    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date;
}

function buildYearSearchText(currentYear, yearFrom, yearTo) {
    let from = yearFrom ?? (currentYear - 3);
    let to = yearTo ?? currentYear;

    if (from > to) [from, to] = [to, from];
    from = Math.max(1900, from);
    to = Math.min(2100, to);

    const years = [];
    for (let y = from; y <= to && years.length < 15; y += 1) years.push(y);
    if (years.length === 0) years.push(currentYear);

    return years.join(' OR ');
}

const OFFICIAL_JUDICIAL_HOST_PATTERNS = [
    /(^|\.)scw\.pjn\.gov\.ar$/i,
    /(^|\.)pjn\.gov\.ar$/i,
    /(^|\.)csjn\.gov\.ar$/i,
    /(^|\.)jurisprudencia\.csjn\.gov\.ar$/i,
    /(^|\.)scba\.gov\.ar$/i,
    /(^|\.)juba\.scba\.gov\.ar$/i,
    /(^|\.)jusbaires\.gob\.ar$/i,
    /(^|\.)mpba\.gov\.ar$/i,
    /(^|\.)mpd\.gov\.ar$/i
];

const BLOCKED_MEDIA_HOST_PATTERNS = [
    /(^|\.)infobae\.com$/i,
    /(^|\.)clarin\.com$/i,
    /(^|\.)lanacion\.com\.ar$/i,
    /(^|\.)perfil\.com$/i,
    /(^|\.)ambito\.com$/i,
    /(^|\.)cronista\.com$/i,
    /(^|\.)iprofesional\.com$/i,
    /(^|\.)pagina12\.com\.ar$/i
];

function getHostFromUrl(url) {
    try {
        return new URL(String(url || '')).hostname.toLowerCase();
    } catch {
        return '';
    }
}

function isOfficialJudicialHost(host) {
    if (!host) return false;
    return OFFICIAL_JUDICIAL_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

function isBlockedMediaHost(host) {
    if (!host) return false;
    return BLOCKED_MEDIA_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

function hasExpedienteSignal(text) {
    const value = String(text || '');
    if (!value) return false;
    const patterns = [
        /\b[A-Z]{2,6}\s*\d{1,7}\/\d{4}\b/i,
        /\b\d{1,7}\/\d{4}\b/,
        /\bexp(?:te|ediente)\.?\s*[:#]?\s*[A-Z0-9\-\/]{4,}\b/i,
        /\bcausa\s+n[º°o]?\s*[A-Z0-9\-\/]{3,}\b/i
    ];
    return patterns.some((regex) => regex.test(value));
}

function hasTribunalSignal(text) {
    const value = String(text || '');
    if (!value) return false;
    return /\b(juzgado|tribunal|camara|sala|secretaria|fiscalia|corte suprema|csjn)\b/i.test(value);
}

function classifySource(result) {
    const host = getHostFromUrl(result?.url);
    const combined = `${result?.title || ''} ${result?.snippet || ''}`.trim();
    const official = isOfficialJudicialHost(host);
    const blockedMedia = isBlockedMediaHost(host);
    const expedienteSignal = hasExpedienteSignal(combined);
    const tribunalSignal = hasTribunalSignal(combined);
    const concreteSignal = expedienteSignal || (tribunalSignal && official);
    const strictJudicial = official || (expedienteSignal && tribunalSignal && !blockedMedia);

    return {
        ...result,
        host,
        source_type: official ? 'official' : 'external',
        blocked_media: blockedMedia,
        has_expediente_signal: expedienteSignal,
        has_tribunal_signal: tribunalSignal,
        has_concrete_signal: concreteSignal,
        strict_judicial: strictJudicial
    };
}

function normalizeEvidenceIndex(raw) {
    const parsed = Number.parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function normalizeCase(rawCase) {
    const yearKey = Object.keys(rawCase || {}).find((key) => {
        try {
            return key
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase() === 'anio';
        } catch {
            return String(key).toLowerCase() === 'anio';
        }
    });
    const anioRaw = rawCase?.anio ?? (yearKey ? rawCase?.[yearKey] : null) ?? null;
    const fechaRaw = rawCase?.fecha ?? rawCase?.date ?? null;
    const evidenceIndexRaw =
        rawCase?.evidence_index ??
        rawCase?.source_index ??
        rawCase?.indice_fuente ??
        rawCase?.fuente_indice ??
        null;
    const dateFromRaw = parseFlexibleDate(fechaRaw);
    const parsedYear = normalizeYear(anioRaw) ?? (dateFromRaw ? dateFromRaw.getUTCFullYear() : null);

    return {
        caratula: rawCase?.caratula || 'Sin caratula',
        expediente: rawCase?.expediente || null,
        tribunal: rawCase?.tribunal || null,
        anio: parsedYear ? String(parsedYear) : null,
        fecha: fechaRaw || null,
        tipo: rawCase?.tipo || 'Otro',
        estado: rawCase?.estado || null,
        resumen: rawCase?.resumen || null,
        url: rawCase?.url || null,
        evidence_index: normalizeEvidenceIndex(evidenceIndexRaw)
    };
}

function validateConcreteCases(cases, sources) {
    const byIndex = new Map();
    const byUrl = new Map();
    (sources || []).forEach((source, i) => {
        const idx = i + 1;
        byIndex.set(idx, source);
        byUrl.set(String(source.url || '').trim(), source);
    });

    const validated = [];
    const seen = new Set();

    for (const item of cases || []) {
        const normalized = normalizeCase(item);
        const mappedSource =
            (normalized.evidence_index ? byIndex.get(normalized.evidence_index) : null) ||
            byUrl.get(String(normalized.url || '').trim()) ||
            null;

        if (!mappedSource) continue;
        if (!mappedSource.strict_judicial) continue;

        const combinedCaseText = `${normalized.expediente || ''} ${normalized.tribunal || ''} ${normalized.caratula || ''} ${normalized.resumen || ''}`;
        const concreteByCase =
            hasExpedienteSignal(combinedCaseText) ||
            hasTribunalSignal(normalized.tribunal || '');
        const concreteBySource =
            mappedSource.has_concrete_signal ||
            mappedSource.has_expediente_signal;

        if (!concreteByCase && !concreteBySource) continue;

        const dedupeKey = `${normalized.expediente || ''}|${normalized.caratula}|${mappedSource.url}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        validated.push({
            ...normalized,
            url: mappedSource.url || normalized.url,
            source_type: mappedSource.source_type || 'external'
        });
    }

    return validated;
}

function applyTemporalFilters(cases, yearFrom, yearTo, dateFrom, dateTo) {
    const normalizedDateFrom = parseFlexibleDate(dateFrom);
    const normalizedDateTo = parseFlexibleDate(dateTo);

    const filtered = cases.filter((item) => {
        const itemYear = normalizeYear(item.anio);
        const itemDate = parseFlexibleDate(item.fecha);

        if (yearFrom && itemYear && itemYear < yearFrom) return false;
        if (yearTo && itemYear && itemYear > yearTo) return false;
        if (yearFrom && yearTo && !itemYear) return false;

        if (normalizedDateFrom && itemDate && itemDate < normalizedDateFrom) return false;
        if (normalizedDateTo && itemDate && itemDate > normalizedDateTo) return false;
        if (normalizedDateFrom && normalizedDateTo && !itemDate) return false;

        return true;
    });

    return {
        cases: filtered,
        filteredOutCount: Math.max(0, cases.length - filtered.length)
    };
}

export async function POST(request) {
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
    const apiKey = process.env.OPENROUTER_API_KEY;

    const body = await request.json();
    const {
        entityType = 'empresa',
        name,
        cuit,
        jurisdiction,
        yearFrom,
        yearTo,
        dateFrom,
        dateTo
    } = body || {};

    const normalizedEntityType = entityType === 'persona' ? 'persona' : 'empresa';
    const normalizedName = String(name || '').trim();
    const normalizedCuit = String(cuit || '').trim();
    const normalizedYearFrom = normalizeYear(yearFrom);
    const normalizedYearTo = normalizeYear(yearTo);

    if (!normalizedName && !normalizedCuit) {
        return NextResponse.json({ error: 'Ingresa nombre o CUIT' }, { status: 400 });
    }

    if (normalizedYearFrom && normalizedYearTo && normalizedYearFrom > normalizedYearTo) {
        return NextResponse.json({ error: 'YEAR_RANGE_INVALID' }, { status: 400 });
    }

    const parsedDateFrom = dateFrom ? parseFlexibleDate(dateFrom) : null;
    const parsedDateTo = dateTo ? parseFlexibleDate(dateTo) : null;
    if ((dateFrom && !parsedDateFrom) || (dateTo && !parsedDateTo)) {
        return NextResponse.json({ error: 'DATE_FORMAT_INVALID' }, { status: 400 });
    }
    if (parsedDateFrom && parsedDateTo && parsedDateFrom > parsedDateTo) {
        return NextResponse.json({ error: 'DATE_RANGE_INVALID' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Sesion invalida' }, { status: 401 });

    const { data: profileData } = await supabase
        .from('profiles')
        .select('plan_tier, subscription_status, trial_ends_at, verification_status, research_reports_used, research_reports_extra')
        .eq('id', user.id)
        .single();

    if (profileData?.verification_status !== 'verified') {
        return NextResponse.json({ error: 'VERIFICATION_REQUIRED' }, { status: 403 });
    }

    if (profileData && isTrialExpired(profileData)) {
        return NextResponse.json({ error: 'TRIAL_EXPIRED' }, { status: 403 });
    }

    const isSuperUser = user?.email === 'gbrlescalada@gmail.com' && user?.id === '365cd259-4f1e-4004-a677-1eda06a5147e';
    if (!isSuperUser) {
        // Casos Nacionales (rapido) no consume creditos de Estrategia.
        // Solo verificamos feature habilitada para el plan.
        const accessCheck = await verifyAccess(user.id, 'advanced_research', null);
        if (!accessCheck.allowed) {
            return NextResponse.json({ error: accessCheck.reason || 'FEATURE_NOT_AVAILABLE', cases: [] }, { status: 403 });
        }
    }

    const cleanName = normalizedName
        ? normalizedName
            .replace(/\b(S\.?A\.?|S\.?R\.?L\.?|S\.?A\.?S\.?)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim()
        : null;

    const nameTerm = normalizedName ? `"${normalizedName}"` : null;
    const cleanNameTerm = cleanName && cleanName !== normalizedName ? `"${cleanName}"` : null;
    const cuitTerm = normalizedCuit ? `"${normalizedCuit.replace(/\s/g, '')}"` : null;
    const primaryTerm = nameTerm || cuitTerm;

    const currentYear = new Date().getFullYear();
    const yearSearchText = buildYearSearchText(currentYear, normalizedYearFrom, normalizedYearTo);
    const subjectLabel = normalizedEntityType === 'persona' ? 'persona' : 'empresa';

    const queries = [
        `${primaryTerm} expediente judicial Argentina ${yearSearchText}`,
        `${primaryTerm} c/ OR s/ causa sentencia`,
        `${primaryTerm} site:scw.pjn.gov.ar OR site:pjn.gov.ar OR site:jurisprudencia.csjn.gov.ar`,
        `${primaryTerm} ${subjectLabel} demandada OR denunciada expediente`
    ];

    if (cleanNameTerm) {
        queries.push(`${cleanNameTerm} demanda judicial Argentina ${yearSearchText}`);
    }

    if (nameTerm && cuitTerm) {
        queries.push(`${cuitTerm} expediente OR causa OR sentencia`);
    }

    const jurisdictionSites = {
        buenosaires: [
            `${primaryTerm} site:scba.gov.ar OR site:juba.scba.gov.ar OR site:mpba.gov.ar`
        ],
        caba: [
            `${primaryTerm} site:jusbaires.gob.ar OR site:mpd.gov.ar OR site:pjn.gov.ar`
        ],
        todas: [
            `${primaryTerm} site:scba.gov.ar OR site:jusbaires.gob.ar OR site:pjn.gov.ar`
        ],
        federal: [
            `${primaryTerm} site:scw.pjn.gov.ar OR site:pjn.gov.ar OR site:jurisprudencia.csjn.gov.ar`
        ]
    };

    if (jurisdictionSites[jurisdiction]) queries.push(...jurisdictionSites[jurisdiction]);

    const finalQueries = queries.slice(0, 5);

    const braveSearch = async (q) => {
        try {
            const params = new URLSearchParams({
                q,
                count: '10',
                country: 'ar',
                search_lang: 'es',
                extra_snippets: 'true',
                freshness: 'py'
            });

            const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
                headers: {
                    Accept: 'application/json',
                    'X-Subscription-Token': braveApiKey
                }
            });

            if (!res.ok) return [];
            const data = await res.json();
            return (data?.web?.results || []).map((r) => ({
                title: r.title,
                url: r.url,
                snippet: [r.description, ...(r.extra_snippets || [])].filter(Boolean).join(' | ')
            }));
        } catch {
            return [];
        }
    };

    const allBatches = await Promise.all(finalQueries.map(braveSearch));
    const allResults = allBatches.flat();

    const seen = new Set();
    const unique = allResults.filter((r) => {
        const normalized = r.url.replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    }).slice(0, 30);

    const classifiedSources = unique.map(classifySource);
    const strictSources = classifiedSources
        .filter((s) => s.strict_judicial && !s.blocked_media)
        .slice(0, 25);

    if (strictSources.length === 0) {
        return NextResponse.json({
            cases: [],
            message: 'No se detectaron fuentes judiciales concretas para este termino. Usa Investigacion PJN para resultados oficiales por camara.',
            meta: {
                queries_used: finalQueries.length,
                results_found: unique.length,
                strict_judicial_mode: true,
                judicial_candidates: 0,
                discarded_non_judicial: classifiedSources.length,
                jurisdiction,
                entity_type: normalizedEntityType,
                filtered_out: 0,
                filters: {
                    year_from: normalizedYearFrom,
                    year_to: normalizedYearTo,
                    date_from: dateFrom || null,
                    date_to: dateTo || null
                }
            }
        });
    }

    const openai = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': 'https://judic-ia.com', 'X-Title': 'Judic-IA' }
    });

    const gptRes = await openai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: `Sos un analista juridico argentino de due diligence judicial.

Objetivo:
- Identificar expedientes judiciales reales de una ${subjectLabel}.
- Excluir noticias, blogs, perfiles, notas de opinion y contenido no judicial.

Salida JSON estricta:
{
  "cases": [
    {
      "caratula": "string",
      "expediente": "string|null",
      "tribunal": "string|null",
      "anio": "string|null",
      "fecha": "string|null",
      "tipo": "Laboral|Civil|Comercial|Penal|Contencioso Administrativo|Tributario|Otro",
      "estado": "Activo|Archivado|Con sentencia|null",
      "resumen": "string|null",
      "url": "string",
      "evidence_index": "number (indice de fuente usada)"
    }
  ]
}

Reglas:
- Maximo 15 casos.
- Si no hay casos reales: {"cases":[]}.
- "fecha": usar formato DD/MM/AAAA o AAAA-MM-DD solo si aparece clara en la fuente.
- SOLO podes usar las fuentes listadas abajo.
- El campo evidence_index debe apuntar al indice [n] de la fuente usada para cada caso.`
            },
            {
                role: 'user',
                content: `${normalizedEntityType === 'persona' ? 'Persona' : 'Empresa'} investigada: ${normalizedName || ''}${normalizedName && normalizedCuit ? ' - CUIT: ' : ''}${normalizedCuit || ''}\n\nFuentes judiciales candidatas (${strictSources.length}):\n${strictSources.map((r, i) => `[${i + 1}] URL: ${r.url}\nHost: ${r.host}\nTitulo: ${r.title}\nSnippet: ${r.snippet}`).join('\n---\n')}`
            }
        ],
        response_format: { type: 'json_object' }
    });

    let parsed;
    try {
        parsed = JSON.parse(gptRes.choices?.[0]?.message?.content || '{}');
    } catch {
        parsed = { cases: [] };
    }

    const aiRawCases = Array.isArray(parsed?.cases) ? parsed.cases : [];
    const validatedCases = validateConcreteCases(aiRawCases, strictSources);
    const droppedByValidation = Math.max(0, aiRawCases.length - validatedCases.length);

    const { cases: filteredCases, filteredOutCount } = applyTemporalFilters(
        validatedCases,
        normalizedYearFrom,
        normalizedYearTo,
        dateFrom,
        dateTo
    );

    return NextResponse.json({
        cases: filteredCases,
        message:
            filteredCases.length === 0
                ? (validatedCases.length === 0
                    ? 'No se encontraron casos judiciales concretos en fuentes verificables. Proba con Investigacion PJN para busqueda oficial.'
                    : 'No hubo coincidencias con los filtros aplicados.')
                : undefined,
        meta: {
            queries_used: finalQueries.length,
            results_found: unique.length,
            strict_judicial_mode: true,
            judicial_candidates: strictSources.length,
            discarded_non_judicial: Math.max(0, classifiedSources.length - strictSources.length),
            ai_raw_cases: aiRawCases.length,
            dropped_by_validation: droppedByValidation,
            jurisdiction,
            entity_type: normalizedEntityType,
            filtered_out: filteredOutCount,
            filters: {
                year_from: normalizedYearFrom,
                year_to: normalizedYearTo,
                date_from: dateFrom || null,
                date_to: dateTo || null
            }
        }
    });
}
