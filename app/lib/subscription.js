/**
 * Subscription & Trial Helper Functions
 *
 * NOTA: Este archivo mantiene compatibilidad con código legacy.
 * Para nuevas implementaciones, usar:
 * - @/lib/tierMiddleware.js para verificaciones de acceso
 * - @/lib/planLimits.js para límites y features
 *
 * La verificación de trial se hace TANTO en frontend (UX) como en backend (seguridad).
 * El frontend muestra UI de bloqueo, el backend rechaza las requests.
 */

import { hasFeature } from '@/lib/planLimits';

/**
 * Verifica si el trial del usuario ha expirado
 * @param {Object} profile - Perfil del usuario de Supabase
 * @returns {boolean} - true si el trial venció y no es usuario Pro
 */
export function isTrialExpired(profile) {
    // Usuarios Pro o Enterprise nunca están bloqueados
    if (profile?.plan_tier === 'professional' || profile?.plan_tier === 'enterprise') {
        return false;
    }

    // Si tiene suscripción activa, no está bloqueado
    if (profile?.subscription_status === 'active') {
        return false;
    }

    // Si es plan trial, verificar fecha
    if (profile?.plan_tier === 'trial') {
        // Si no tiene fecha de expiración, consideramos que expiró
        if (!profile?.trial_ends_at) {
            return true;
        }

        const expiryDate = new Date(profile.trial_ends_at);
        const now = new Date();
        return expiryDate < now;
    }

    // Plan free no "expira" pero tiene acceso limitado
    return false;
}

/**
 * Calcula los días restantes del trial
 * @param {Object} profile - Perfil del usuario de Supabase
 * @returns {number} - Días restantes (0 si expiró, -1 si es Pro)
 */
export function getTrialDaysRemaining(profile) {
    // Usuarios Pro/Enterprise no tienen trial
    if (profile?.plan_tier === 'professional' ||
        profile?.plan_tier === 'enterprise' ||
        profile?.subscription_status === 'active') {
        return -1;
    }

    // Solo plan trial tiene días de trial
    if (profile?.plan_tier !== 'trial') {
        return 0;
    }

    if (!profile?.trial_ends_at) {
        return 0;
    }

    const expiryDate = new Date(profile.trial_ends_at);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
}

/**
 * Verifica si el usuario puede acceder a funciones premium (Research, Legislation)
 * @param {Object} profile - Perfil del usuario de Supabase
 * @returns {{ allowed: boolean, reason: string }} - Resultado de la verificación
 */
export function canAccessPremiumFeatures(profile) {
    if (!profile) {
        return { allowed: false, reason: 'NO_PROFILE' };
    }

    // Verificar si tiene la feature 'advanced_research'
    if (hasFeature(profile.plan_tier, 'advanced_research')) {
        return { allowed: true, reason: 'HAS_FEATURE' };
    }

    // Trial expirado o plan free
    return { allowed: false, reason: 'FEATURE_NOT_AVAILABLE' };
}

/**
 * Verifica si el usuario está en gracia period (pago fallido)
 * @param {Object} profile
 * @returns {boolean}
 */
export function isInGracePeriod(profile) {
    if (profile?.subscription_status !== 'past_due') return false;
    if (!profile?.grace_period_ends_at) return false;

    return new Date(profile.grace_period_ends_at) > new Date();
}

/**
 * Obtiene días restantes de gracia period
 * @param {Object} profile
 * @returns {number} Días restantes
 */
export function getGracePeriodDaysLeft(profile) {
    if (!isInGracePeriod(profile)) return 0;

    const now = new Date();
    const end = new Date(profile.grace_period_ends_at);
    const diffMs = end - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
}
