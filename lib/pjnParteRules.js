function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Reglas detectadas automáticamente desde SCW (extract_scw_parte_types_by_jurisdiction).
 * Fecha de extracción: 2026-02-26
 */
export const PJN_PARTE_TYPE_RULES = {
  '7': {
    jurisdiction_id: '7',
    jurisdiction_code: 'CNT',
    forced_type: 'DEMANDADO',
    select_locked: true,
    note: 'Solo puede consultar por tipo de parte DEMANDADO'
  }
};

export function getPjnParteTypeRule(jurisdictionId) {
  const id = cleanText(jurisdictionId);
  if (!id) return null;
  return PJN_PARTE_TYPE_RULES[id] || null;
}

export function resolvePjnParteType({ jurisdictionId, requestedType } = {}) {
  const rule = getPjnParteTypeRule(jurisdictionId);
  if (rule?.forced_type) return rule.forced_type;

  const cleanRequested = cleanText(requestedType);
  return cleanRequested || null;
}

export function isPjnParteTypeAllowed({ jurisdictionId, parteType } = {}) {
  const cleanRequested = cleanText(parteType);
  if (!cleanRequested) return true;

  const rule = getPjnParteTypeRule(jurisdictionId);
  if (!rule?.forced_type) return true;

  return normalizeText(cleanRequested) === normalizeText(rule.forced_type);
}
