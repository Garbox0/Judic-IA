const CSJN_DEPENDENCIAS = [
  { value: '1089', label: 'JUZGADO CRIMINAL Y CORRECCIONAL FEDERAL 1' },
  { value: '1092', label: 'JUZGADO CRIMINAL Y CORRECCIONAL FEDERAL 2' },
  { value: '1095', label: 'JUZGADO CRIMINAL Y CORRECCIONAL FEDERAL 3' },
  { value: '1098', label: 'JUZGADO CRIMINAL Y CORRECCIONAL FEDERAL 4' },
  { value: '1101', label: 'JUZGADO CRIMINAL Y CORRECCIONAL FEDERAL 5' },
  { value: '1104', label: 'JUZGADO CRIMINAL Y CORRECCIONAL FEDERAL 6' },
  { value: '1107', label: 'JUZGADO CRIMINAL Y CORRECCIONAL FEDERAL 7' },
  { value: '1110', label: 'JUZGADO CRIMINAL Y CORRECCIONAL FEDERAL 8' },
  { value: '1113', label: 'JUZGADO CRIMINAL Y CORRECCIONAL FEDERAL 9' },
  { value: '1116', label: 'JUZGADO CRIMINAL Y CORRECCIONAL FEDERAL 10' },
  { value: '1119', label: 'JUZGADO CRIMINAL Y CORRECCIONAL FEDERAL 11' },
  { value: '1122', label: 'JUZGADO CRIMINAL Y CORRECCIONAL FEDERAL 12' }
];

export const CSJN_DEPENDENCIA_OPTIONS = CSJN_DEPENDENCIAS;

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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;

  const text = cleanText(value).toLowerCase();
  if (!text) return fallback;
  if (['1', 'true', 'si', 'yes'].includes(text)) return true;
  if (['0', 'false', 'no'].includes(text)) return false;
  return fallback;
}

function findDependenciaLabelById(id) {
  const cleanId = cleanText(id);
  if (!cleanId) return '';
  return CSJN_DEPENDENCIAS.find((item) => item.value === cleanId)?.label || '';
}

export function normalizeCsjnAlertFilters(rawFilters = {}) {
  const base = rawFilters?.csjn && typeof rawFilters.csjn === 'object'
    ? rawFilters.csjn
    : rawFilters;

  const dependencyOfficeId = cleanText(
    base?.dependency_office_id ||
    base?.dependencyOfficeId ||
    base?.office_id ||
    base?.oficina ||
    ''
  );
  const dependencyLabel = cleanText(
    base?.dependency_label ||
    base?.dependencyLabel ||
    base?.oficina_label ||
    findDependenciaLabelById(dependencyOfficeId)
  );

  const intervinienteName = cleanText(
    base?.interviniente_name ||
    base?.intervinienteName ||
    base?.intervenor_name ||
    base?.nombre ||
    ''
  );

  const hasRoleDenunciante = (
    base?.role_denunciante !== undefined ||
    base?.roleDenunciante !== undefined ||
    base?.includeDenunciante !== undefined
  );
  const hasRoleDenunciado = (
    base?.role_denunciado !== undefined ||
    base?.roleDenunciado !== undefined ||
    base?.includeDenunciado !== undefined
  );

  let roleDenunciante = parseBoolean(
    base?.role_denunciante ?? base?.roleDenunciante ?? base?.includeDenunciante,
    true
  );
  let roleDenunciado = parseBoolean(
    base?.role_denunciado ?? base?.roleDenunciado ?? base?.includeDenunciado,
    true
  );

  if (intervinienteName) {
    if (!hasRoleDenunciante && !hasRoleDenunciado) {
      roleDenunciante = true;
      roleDenunciado = true;
    }

    if (!roleDenunciante && !roleDenunciado) {
      roleDenunciante = true;
      roleDenunciado = true;
    }
  } else {
    roleDenunciante = false;
    roleDenunciado = false;
  }

  const normalized = {};
  if (dependencyOfficeId) normalized.dependency_office_id = dependencyOfficeId;
  if (dependencyLabel) normalized.dependency_label = dependencyLabel;

  if (intervinienteName) {
    normalized.interviniente_name = intervinienteName;
    normalized.role_denunciante = roleDenunciante;
    normalized.role_denunciado = roleDenunciado;
  }

  return normalized;
}

export function hasCsjnAlertFilters(rawFilters = {}) {
  return Object.keys(normalizeCsjnAlertFilters(rawFilters)).length > 0;
}

export function encodeCsjnAlertFilters(rawFilters = {}) {
  const normalized = normalizeCsjnAlertFilters(rawFilters);
  if (!hasCsjnAlertFilters(normalized)) return '';
  return JSON.stringify({
    v: 1,
    csjn: normalized
  });
}

export function decodeCsjnAlertFilters(serializedValue) {
  const text = cleanText(serializedValue);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    const normalized = normalizeCsjnAlertFilters(parsed);
    return hasCsjnAlertFilters(normalized) ? normalized : null;
  } catch (_) {
    return null;
  }
}

function passesIntervinienteFilter(item, filters) {
  if (!filters?.interviniente_name) return true;

  const needle = normalizeText(filters.interviniente_name);
  if (!needle) return true;

  const inDenunciantes = normalizeText(item?.denunciantes).includes(needle);
  const inDenunciados = normalizeText(item?.denunciados).includes(needle);

  if (filters.role_denunciante && filters.role_denunciado) {
    return inDenunciantes || inDenunciados;
  }
  if (filters.role_denunciante) return inDenunciantes;
  if (filters.role_denunciado) return inDenunciados;

  return inDenunciantes || inDenunciados;
}

function passesDependenciaFilter(item, filters) {
  if (!filters?.dependency_label) return true;
  const dependencyText = normalizeText(item?.dependencia_asignada);
  const expected = normalizeText(filters.dependency_label);
  if (!expected) return true;
  return dependencyText.includes(expected);
}

export function applyCsjnAlertFilters(cases = [], rawFilters = {}) {
  const filters = normalizeCsjnAlertFilters(rawFilters);
  if (!hasCsjnAlertFilters(filters)) return cases || [];

  return (cases || []).filter((item) => {
    if (!passesDependenciaFilter(item, filters)) return false;
    if (!passesIntervinienteFilter(item, filters)) return false;
    return true;
  });
}

export function buildCsjnFilterSummary(rawFilters = {}) {
  const filters = normalizeCsjnAlertFilters(rawFilters);
  if (!hasCsjnAlertFilters(filters)) return '';

  const parts = [];

  if (filters.dependency_label) {
    parts.push(`Dependencia: ${filters.dependency_label}`);
  }

  if (filters.interviniente_name) {
    let roleText = 'Denunciante o Denunciado';
    if (filters.role_denunciante && !filters.role_denunciado) roleText = 'Denunciante';
    if (!filters.role_denunciante && filters.role_denunciado) roleText = 'Denunciado';
    parts.push(`Interviniente (${roleText}): ${filters.interviniente_name}`);
  }

  return parts.join(' | ');
}
