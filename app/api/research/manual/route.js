import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { load } from 'cheerio';
import { isTrialExpired } from '@/app/lib/subscription';

const SCBA_BASE_URL = 'https://www-2020.scba.gov.ar';
const SCBA_NAVBAR_ENDPOINT = `${SCBA_BASE_URL}/jurisprudencia/navbar.asp`;
const SCBA_SCOPE = 'Fallos Completos';
const SOURCE_LABEL = 'SCBA publico';
const MAX_LIMIT = 100;
const MIN_LIMIT = 5;
const MAX_PAGES = 8;

const INSTANCIA_LABELS = {
  todas: 'Todas',
  scba: 'SCBA',
  camara: 'Camara',
  juzgado: 'Juzgado',
  otra: 'Otra'
};

const FUERO_LABELS = {
  todas: 'Todas',
  civil_comercial: 'Civil y Comercial',
  familia: 'Familia',
  laboral: 'Laboral',
  penal: 'Penal',
  contencioso_admin: 'Contencioso Administrativo',
  previsional: 'Previsional',
  otro: 'Otro'
};

function cleanText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function sanitizeQuery(value) {
  return cleanText(value).replace(/[\r\n\t]+/g, ' ');
}

function buildTerms(value) {
  return normalizeText(value)
    .split(/[,\s]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2);
}

function toIsoDate(mmddyyyy) {
  const match = cleanText(mmddyyyy).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = match[1].padStart(2, '0');
  const day = match[2].padStart(2, '0');
  const year = match[3];
  return `${year}-${month}-${day}`;
}

function extractDateIso(statsText) {
  const match = cleanText(statsText).match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  return match ? toIsoDate(match[1]) : null;
}

function formatDateLabel(isoDate) {
  if (!isoDate || !isoDate.includes('-')) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function inferInstanciaKey(path = '', summary = '') {
  const pathNorm = normalizeText(path);
  const summaryNorm = normalizeText(summary);
  if (pathNorm.includes('/scba/')) return 'scba';
  if (pathNorm.includes('/camara/')) return 'camara';
  if (summaryNorm.includes('juzg')) return 'juzgado';
  return 'otra';
}

function inferFueroKey(text = '') {
  const norm = normalizeText(text);
  if (!norm) return 'otro';

  if (/(familia|alimentos|filiacion|divorcio|tenencia|regimen de comunicacion|menor|adopcion)/.test(norm)) {
    return 'familia';
  }
  if (/(laboral|trabajo|despido|indemnizacion laboral|accidente de trabajo)/.test(norm)) {
    return 'laboral';
  }
  if (/(penal|homicidio|imputado|condena|fiscalia|ministerio publico fiscal)/.test(norm)) {
    return 'penal';
  }
  if (/(contencioso|administrativ|licitacion|acto administrativo|municipalidad|estado provincial)/.test(norm)) {
    return 'contencioso_admin';
  }
  if (/(previsional|jubilacion|pension|anses|haberes)/.test(norm)) {
    return 'previsional';
  }
  if (/(comercial|sociedad|quiebra|concurso|cheque|pagare)/.test(norm)) {
    return 'civil_comercial';
  }
  if (/(civil|danos|danios|responsabilidad|contrato|hipoteca|sucesion|amparo)/.test(norm)) {
    return 'civil_comercial';
  }

  return 'otro';
}

function extractTribunal(summary = '') {
  const text = cleanText(summary);
  const patterns = [
    /(Camara[^.;]{0,170})/i,
    /(Juzg\.?[^.;]{0,170})/i,
    /(Tribunal[^.;]{0,170})/i,
    /(Suprema Corte[^.;]{0,180})/i,
    /(SCBA[^.;]{0,90})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }

  return '';
}

function scoreCase(item, queryTerms, keywordTerms) {
  const text = normalizeText(`${item.autos || ''} ${item.summary || ''} ${item.tribunal || ''}`);
  let score = item.instancia_key === 'scba' ? 58 : 46;

  for (const term of queryTerms) {
    if (text.includes(term)) score += 7;
  }

  for (const term of keywordTerms) {
    if (text.includes(term)) score += 5;
  }

  if (item.fecha) score += 2;
  if (item.tribunal) score += 2;
  return Math.round(score);
}

function dedupeCases(cases) {
  const seen = new Set();
  return cases.filter((item) => {
    const key = item.url || `${item.autos}-${item.source_path}-${item.fecha || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractTotalAvailable($) {
  const headerText = $('p')
    .toArray()
    .map((el) => cleanText($(el).text()))
    .find((text) => /Documentos\s+\d+\s+a\s+\d+\s+de\s+/i.test(text));

  if (!headerText) return null;
  const match = headerText.match(/Documentos\s+\d+\s+a\s+\d+\s+de\s+([\d.]+)/i);
  if (!match?.[1]) return null;
  return Number(match[1].replace(/\./g, '')) || null;
}

function extractNextPageUrl($) {
  const nextAnchor = $('a')
    .toArray()
    .find((el) => {
      const href = $(el).attr('href') || '';
      const text = normalizeText($(el).text() || '');
      if (!/pg=\d+/i.test(href)) return false;
      return /ximos\s*10|roximos\s*10|proximos\s*10/.test(text);
    });

  if (!nextAnchor) return null;
  const href = $(nextAnchor).attr('href');
  if (!href) return null;

  try {
    return new URL(href, `${SCBA_BASE_URL}/jurisprudencia/`).toString();
  } catch {
    return null;
  }
}

function parseScbaPage(html) {
  const $ = load(html || '');
  const rows = $('tr.RecordTitle').toArray();
  const cases = [];

  rows.forEach((row, idx) => {
    const rawAutos = cleanText($(row).find('td.RecordTitle').text() || $(row).text());
    const autos = cleanText(rawAutos.replace(/^\d+\.\s*/, '')) || `Fallo ${idx + 1}`;
    const detailsRow = $(row).next('tr');
    if (!detailsRow?.length) return;

    const detailsCells = detailsRow.find('td');
    if (detailsCells.length < 2) return;

    const summaryCell = detailsCells.eq(1);
    const summaryRaw = cleanText(summaryCell.text()).replace(/^Inicio:\s*/i, '');
    const statsRow = detailsRow.next('tr');
    const statsAnchor = statsRow.find('a.RecordStats').first();
    const sourcePath = cleanText(statsAnchor.attr('href') || statsAnchor.text());
    if (!sourcePath) return;

    const statsText = cleanText(statsRow.find('i.RecordStats').text());
    const fecha = extractDateIso(statsText);
    const instanciaKey = inferInstanciaKey(sourcePath, summaryRaw);
    const fueroKey = inferFueroKey(`${autos} ${summaryRaw}`);
    const tribunal = extractTribunal(summaryRaw);

    let sourceUrl = '';
    try {
      sourceUrl = new URL(sourcePath, SCBA_BASE_URL).toString();
    } catch {
      sourceUrl = sourcePath;
    }

    const titleForPdf = encodeURIComponent((autos || 'fallo').slice(0, 80));
    const pdfProxyUrl = sourceUrl
      ? `/api/kb-proxy?url=${encodeURIComponent(sourceUrl)}&title=${titleForPdf}`
      : null;

    cases.push({
      id: `${sourcePath}-${idx}`,
      autos,
      summary: summaryRaw,
      tribunal,
      instancia_key: instanciaKey,
      instancia: INSTANCIA_LABELS[instanciaKey] || INSTANCIA_LABELS.otra,
      fuero_key: fueroKey,
      fuero: FUERO_LABELS[fueroKey] || FUERO_LABELS.otro,
      jurisdiction: 'Provincial',
      province: 'Buenos Aires',
      fecha,
      date_label: formatDateLabel(fecha),
      url: sourceUrl,
      pdf_url: pdfProxyUrl,
      source: SOURCE_LABEL,
      source_path: sourcePath,
      stats: statsText
    });
  });

  return {
    cases,
    nextUrl: extractNextPageUrl($),
    totalAvailable: extractTotalAvailable($)
  };
}

function passesDateFilter(itemDate, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  if (!itemDate) return false;
  if (dateFrom && itemDate < dateFrom) return false;
  if (dateTo && itemDate > dateTo) return false;
  return true;
}

function extractTribunalSearchKey(tribunalRaw) {
  // Catalog values look like: "Camara Civil y Comercial — Quilmes"
  // Extract only the departamento part for a looser partial match.
  const emdashIdx = tribunalRaw.indexOf('\u2014');
  if (emdashIdx !== -1) {
    const dept = tribunalRaw.slice(emdashIdx + 1).trim();
    if (dept.length > 2) return normalizeText(dept);
  }
  const dashIdx = tribunalRaw.indexOf(' - ');
  if (dashIdx !== -1) {
    const dept = tribunalRaw.slice(dashIdx + 3).trim();
    if (dept.length > 2) return normalizeText(dept);
  }
  return normalizeText(tribunalRaw);
}

function applyClientFilters(cases, filters) {
  const instanciaFilter = normalizeText(filters.instancia || 'todas');
  const fueroFilter = normalizeText(filters.fuero || 'todas');
  const tribunalSearchKey = extractTribunalSearchKey(filters.tribunal || '');
  const keywordTerms = buildTerms(filters.keywords || '');
  const dateFrom = cleanText(filters.dateFrom || '');
  const dateTo = cleanText(filters.dateTo || '');

  return cases.filter((item) => {
    if (instanciaFilter !== 'todas' && normalizeText(item.instancia_key) !== instanciaFilter) return false;
    if (fueroFilter !== 'todas' && normalizeText(item.fuero_key) !== fueroFilter) return false;
    if (!passesDateFilter(item.fecha, dateFrom, dateTo)) return false;

    const haystack = normalizeText(
      `${item.autos || ''} ${item.summary || ''} ${item.tribunal || ''} ${item.fuero || ''}`
    );

    if (tribunalSearchKey && !haystack.includes(tribunalSearchKey)) return false;
    if (keywordTerms.length > 0 && keywordTerms.some((term) => !haystack.includes(term))) return false;
    return true;
  });
}

async function fetchScbaCases(query, maxPagesToScan) {
  let currentUrl = `${SCBA_NAVBAR_ENDPOINT}?Busca=${encodeURIComponent(SCBA_SCOPE)}&SearchString=${encodeURIComponent(query)}`;
  let scannedPages = 0;
  let totalAvailable = null;
  const collected = [];

  while (currentUrl && scannedPages < maxPagesToScan) {
    const res = await fetch(currentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml'
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000)
    });

    if (!res.ok) {
      throw new Error(`SCBA_HTTP_${res.status}`);
    }

    const html = await res.text();
    const parsed = parseScbaPage(html);
    collected.push(...parsed.cases);
    scannedPages += 1;

    if (typeof parsed.totalAvailable === 'number' && totalAvailable === null) {
      totalAvailable = parsed.totalAvailable;
    }

    currentUrl = parsed.nextUrl;
  }

  return {
    cases: dedupeCases(collected),
    scannedPages,
    totalAvailable
  };
}

export async function POST(request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Sesion invalida.' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Sesion invalida.' }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('verification_status, trial_ends_at')
    .eq('id', user.id)
    .single();

  if (profileData?.verification_status !== 'verified') {
    return NextResponse.json({ error: 'VERIFICATION_REQUIRED', message: 'Cuenta pendiente de verificacion.' }, { status: 403 });
  }

  if (profileData && isTrialExpired(profileData)) {
    return NextResponse.json({ error: 'TRIAL_EXPIRED', message: 'Tu periodo de prueba ha vencido.' }, { status: 403 });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const rawQuery = sanitizeQuery(payload.query);
  const keywords = sanitizeQuery(payload.keywords);
  const effectiveQuery = rawQuery || keywords;
  const province = sanitizeQuery(payload.province || 'Buenos Aires');
  const jurisdiction = normalizeText(payload.jurisdiction || 'provincial');
  const instancia = normalizeText(payload.instancia || 'todas');
  const fuero = normalizeText(payload.fuero || 'todas');
  const tribunal = sanitizeQuery(payload.tribunal || '');
  const dateFrom = sanitizeQuery(payload.dateFrom || '');
  const dateTo = sanitizeQuery(payload.dateTo || '');
  const limit = Math.max(MIN_LIMIT, Math.min(Number(payload.limit) || 40, MAX_LIMIT));
  const maxPagesToScan = Math.max(1, Math.min(Number(payload.maxPages) || Math.ceil(limit / 10) + 2, MAX_PAGES));

  if (effectiveQuery.length < 3) {
    return NextResponse.json(
      { error: 'INVALID_QUERY', message: 'Escribi al menos 3 caracteres en Texto libre o Palabras clave.' },
      { status: 400 }
    );
  }

  if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    return NextResponse.json({ error: 'INVALID_DATE', message: 'Fecha desde invalida (formato: YYYY-MM-DD).' }, { status: 400 });
  }

  if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return NextResponse.json({ error: 'INVALID_DATE', message: 'Fecha hasta invalida (formato: YYYY-MM-DD).' }, { status: 400 });
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return NextResponse.json({ error: 'INVALID_DATE_RANGE', message: 'Fecha desde no puede ser mayor a fecha hasta.' }, { status: 400 });
  }

  if (normalizeText(province) !== 'buenos aires') {
    return NextResponse.json({
      cases: [],
      total: 0,
      totalMatched: 0,
      totalAvailable: 0,
      scannedPages: 0,
      source: 'scba_public',
      message: 'Por ahora esta busqueda manual solo soporta Provincia de Buenos Aires.'
    });
  }

  if (jurisdiction !== 'todas' && jurisdiction !== 'provincial') {
    return NextResponse.json({
      cases: [],
      total: 0,
      totalMatched: 0,
      totalAvailable: 0,
      scannedPages: 0,
      source: 'scba_public',
      message: 'La fuente actual es provincial (Buenos Aires).'
    });
  }

  if (!Object.prototype.hasOwnProperty.call(INSTANCIA_LABELS, instancia)) {
    return NextResponse.json({ error: 'INVALID_FILTER', message: 'Filtro de instancia invalido.' }, { status: 400 });
  }

  if (!Object.prototype.hasOwnProperty.call(FUERO_LABELS, fuero)) {
    return NextResponse.json({ error: 'INVALID_FILTER', message: 'Filtro de fuero invalido.' }, { status: 400 });
  }

  // ─── 1. Try local Supabase index first (fast path) ───────────────
  async function queryLocalIndex() {
    try {
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const tsQuery = effectiveQuery.trim().replace(/\s+/g, ' & ');
      let q = serviceSupabase.from('jurisprudencia_ba').select('*');

      // Full-text search
      q = q.textSearch('fts', tsQuery, { config: 'spanish', type: 'websearch' });

      // Fuero filter
      if (fuero !== 'todas') q = q.eq('fuero', fuero);

      // Instancia filter
      if (instancia !== 'todas') q = q.eq('instancia', instancia);

      // Tribunal filter (partial text on tribunal column)
      if (tribunal) {
        const tribunalKey = extractTribunalSearchKey(tribunal);
        if (tribunalKey) q = q.ilike('tribunal', `%${tribunalKey}%`);
      }

      // Date filters
      if (dateFrom) q = q.gte('fecha', dateFrom);
      if (dateTo) q = q.lte('fecha', dateTo);

      q = q.order('fecha', { ascending: false }).limit(limit * 2);

      const { data, error } = await q;
      if (error || !data?.length) return null;

      return data.map(row => ({
        autos: row.autos,
        summary: row.summary,
        tribunal: row.tribunal,
        instancia_key: row.instancia,
        fuero_key: row.fuero,
        fecha: row.fecha,
        url: row.url,
        pdf_url: row.pdf_url,
        fuero: FUERO_LABELS[row.fuero] || row.fuero,
        instancia: INSTANCIA_LABELS[row.instancia] || row.instancia,
        source: 'local_index'
      }));
    } catch {
      return null; // Silent fail → fall through to live scb scrape
    }
  }
  // ─────────────────────────────────────────────────────────────────

  try {
    let cases, scannedPages, totalAvailable, usedLocalIndex = false;

    // Fast path: local index
    const localResults = await queryLocalIndex();
    if (localResults && localResults.length >= 5) {
      cases = localResults;
      scannedPages = 0;
      totalAvailable = null;
      usedLocalIndex = true;
    } else {
      // Slow path: live SCBA scraping
      ({ cases, scannedPages, totalAvailable } = await fetchScbaCases(effectiveQuery, maxPagesToScan));
    }

    const casesFinal = usedLocalIndex ? cases : applyClientFilters(cases, {
      instancia,
      fuero,
      tribunal,
      dateFrom,
      dateTo,
      keywords
    });

    const queryTerms = buildTerms(effectiveQuery);
    const keywordTerms = buildTerms(keywords);

    const ranked = casesFinal
      .map((item) => ({
        ...item,
        relevance: scoreCase(item, queryTerms, keywordTerms)
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    const sourceLabelFinal = usedLocalIndex ? 'Índice local BA (SCBA)' : SOURCE_LABEL;
    const sourceUrlFinal = usedLocalIndex ? '' : `${SCBA_BASE_URL}/jurisprudencia/default2.asp?busca=Fallos+Completos`;

    return NextResponse.json({
      cases: ranked,
      total: ranked.length,
      totalMatched: casesFinal.length,
      totalAvailable: totalAvailable || casesFinal.length,
      scannedPages,
      source: usedLocalIndex ? 'local_index' : 'scba_public',
      sourceLabel: sourceLabelFinal,
      sourceUrl: sourceUrlFinal
    });
  } catch (error) {
    console.error('Manual BA search failed:', error);
    return NextResponse.json(
      {
        error: 'SEARCH_FAILED',
        message: 'No se pudo consultar la fuente publica de Buenos Aires en este momento.'
      },
      { status: 502 }
    );
  }
}
