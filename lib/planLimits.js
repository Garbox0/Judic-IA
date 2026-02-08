/**
 * PLAN LIMITS CONFIGURATION
 * Centraliza todos los límites y features de cada tier
 * Único lugar donde cambiar quotas (no más hardcoded en 10 archivos diferentes)
 */

export const PLAN_LIMITS = {
  trial: {
    // Quotas
    ai_messages: 50,
    inquiries: 5,
    research_reports: 10,
    team_members: 1,
    storage_mb: 100,

    // Duración
    duration_days: 14,

    // Features habilitadas
    features: {
      basic_search: true,
      advanced_research: true,      // Trial tiene acceso completo temporalmente
      case_library: true,
      team_collaboration: false,    // Solo 1 miembro
      api_access: false,
      priority_support: false,
      custom_branding: false,
      analytics: false
    }
  },

  free: {
    // Quotas
    ai_messages: 20,
    inquiries: 5,
    research_reports: 3,
    team_members: 1,
    storage_mb: 50,

    // Features habilitadas
    features: {
      basic_search: true,
      advanced_research: false,     // Bloqueado en free
      case_library: false,
      team_collaboration: false,
      api_access: false,
      priority_support: false,
      custom_branding: false,
      analytics: false
    }
  },

  professional: {
    // Quotas
    ai_messages: 1000,
    inquiries: 100,
    research_reports: 50,
    team_members: 5,                // Preparado para pequeño estudio
    storage_mb: 5000,

    // Features habilitadas
    features: {
      basic_search: true,
      advanced_research: true,
      case_library: true,
      team_collaboration: true,     // Puede invitar hasta 5 miembros
      api_access: false,            // Solo para enterprise
      priority_support: true,
      custom_branding: false,
      analytics: true
    }
  },

  enterprise: {
    // Quotas ilimitadas (-1 = sin límite)
    ai_messages: -1,
    inquiries: -1,
    research_reports: -1,
    team_members: -1,
    storage_mb: -1,

    // Features habilitadas (todas)
    features: {
      basic_search: true,
      advanced_research: true,
      case_library: true,
      team_collaboration: true,
      api_access: true,
      priority_support: true,
      custom_branding: true,
      analytics: true,
      sla_guarantee: true,
      dedicated_support: true
    }
  }
};

/**
 * Obtiene el límite de una quota específica para un plan
 * @param {string} planTier - 'trial', 'free', 'professional', 'enterprise'
 * @param {string} limitKey - 'ai_messages', 'inquiries', etc.
 * @returns {number} Límite (-1 = ilimitado, 0 = no disponible)
 */
export function getPlanLimit(planTier, limitKey) {
  return PLAN_LIMITS[planTier]?.[limitKey] ?? 0;
}

/**
 * Verifica si un plan tiene acceso a una feature
 * @param {string} planTier - Plan tier
 * @param {string} featureName - Nombre de la feature
 * @returns {boolean}
 */
export function hasFeature(planTier, featureName) {
  return PLAN_LIMITS[planTier]?.features?.[featureName] ?? false;
}

/**
 * Verifica si un usuario puede realizar una acción basado en su quota
 * @param {object} profile - Perfil del usuario de Supabase
 * @param {string} action - 'ai_messages', 'inquiries', 'research_reports'
 * @returns {boolean}
 */
export function canPerformAction(profile, action) {
  const limit = getPlanLimit(profile.plan_tier, action);

  // -1 = ilimitado
  if (limit === -1) return true;

  // 0 = no disponible
  if (limit === 0) return false;

  const used = profile[`${action}_used`] || 0;
  return used < limit;
}

/**
 * Obtiene el uso actual como porcentaje
 * @param {object} profile - Perfil del usuario
 * @param {string} action - 'ai_messages', 'inquiries', 'research_reports'
 * @returns {number} Porcentaje 0-100
 */
export function getUsagePercentage(profile, action) {
  const limit = getPlanLimit(profile.plan_tier, action);

  if (limit === -1) return 0; // Ilimitado
  if (limit === 0) return 100; // No disponible = 100% usado

  const used = profile[`${action}_used`] || 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

/**
 * Obtiene información detallada de uso para mostrar al usuario
 * @param {object} profile - Perfil del usuario
 * @param {string} action - 'ai_messages', 'inquiries', 'research_reports'
 * @returns {object} { used, limit, remaining, percentage, canUse }
 */
export function getUsageInfo(profile, action) {
  const limit = getPlanLimit(profile.plan_tier, action);
  const used = profile[`${action}_used`] || 0;

  return {
    used,
    limit,
    remaining: limit === -1 ? Infinity : Math.max(0, limit - used),
    percentage: getUsagePercentage(profile, action),
    canUse: canPerformAction(profile, action),
    isUnlimited: limit === -1
  };
}

/**
 * Verifica si el usuario está cerca de agotar su quota (>80%)
 * @param {object} profile - Perfil del usuario
 * @param {string} action - Action a verificar
 * @returns {boolean}
 */
export function isNearingQuotaLimit(profile, action) {
  const percentage = getUsagePercentage(profile, action);
  return percentage >= 80;
}

/**
 * Obtiene el nombre legible de un plan
 * @param {string} planTier
 * @returns {string}
 */
export function getPlanName(planTier) {
  const names = {
    trial: 'Prueba Gratuita',
    free: 'Plan Gratuito',
    professional: 'Plan Profesional',
    enterprise: 'Plan Empresarial'
  };
  return names[planTier] || planTier;
}

/**
 * Obtiene el precio mensual de un plan
 * @param {string} planTier
 * @returns {number} Precio en ARS
 */
export function getPlanPrice(planTier) {
  const prices = {
    trial: 0,
    free: 0,
    professional: 25000,
    enterprise: 0 // Contactar ventas
  };
  return prices[planTier] || 0;
}

/**
 * Obtiene todas las features de un plan
 * @param {string} planTier
 * @returns {object} Features object
 */
export function getPlanFeatures(planTier) {
  return PLAN_LIMITS[planTier]?.features ?? {};
}

/**
 * Compara dos planes y retorna las diferencias
 * Útil para mostrar "Upgrade benefits"
 * @param {string} fromPlan
 * @param {string} toPlan
 * @returns {object} { quotaImprovements, newFeatures }
 */
export function comparePlans(fromPlan, toPlan) {
  const from = PLAN_LIMITS[fromPlan];
  const to = PLAN_LIMITS[toPlan];

  if (!from || !to) return { quotaImprovements: [], newFeatures: [] };

  // Quotas que mejoran
  const quotaImprovements = [];
  ['ai_messages', 'inquiries', 'research_reports', 'team_members'].forEach(key => {
    if (to[key] > from[key] || to[key] === -1) {
      quotaImprovements.push({
        name: key,
        from: from[key],
        to: to[key],
        improvement: to[key] === -1 ? 'Ilimitado' : `+${to[key] - from[key]}`
      });
    }
  });

  // Features nuevas
  const newFeatures = [];
  Object.keys(to.features).forEach(featureKey => {
    if (to.features[featureKey] && !from.features[featureKey]) {
      newFeatures.push(featureKey);
    }
  });

  return { quotaImprovements, newFeatures };
}

/**
 * Valida que un plan tier sea válido
 * @param {string} planTier
 * @returns {boolean}
 */
export function isValidPlanTier(planTier) {
  return ['trial', 'free', 'professional', 'enterprise'].includes(planTier);
}
