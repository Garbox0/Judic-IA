/**
 * Subscription & Trial Helper Functions
 * 
 * La verificación de trial se hace TANTO en frontend (UX) como en backend (seguridad).
 * El frontend muestra UI de bloqueo, el backend rechaza las requests.
 */

/**
 * Verifica si el trial del usuario ha expirado
 * @param {Object} profile - Perfil del usuario de Supabase
 * @returns {boolean} - true si el trial venció y no es usuario Pro
 */
export function isTrialExpired(profile) {
    // Usuarios Pro nunca están bloqueados
    if (profile?.plan_tier === 'professional') {
        return false;
    }

    // Si tiene suscripción activa, no está bloqueado
    if (profile?.subscription_status === 'active') {
        return false;
    }

    // Si no tiene fecha de expiración de demo, consideramos que expiró
    if (!profile?.demo_expires_at) {
        return true;
    }

    // Comparar la fecha de expiración con la fecha actual
    const expiryDate = new Date(profile.demo_expires_at);
    const now = new Date();

    return expiryDate < now;
}

/**
 * Calcula los días restantes del trial
 * @param {Object} profile - Perfil del usuario de Supabase
 * @returns {number} - Días restantes (0 si expiró, -1 si es Pro)
 */
export function getTrialDaysRemaining(profile) {
    // Usuarios Pro no tienen trial
    if (profile?.plan_tier === 'professional' || profile?.subscription_status === 'active') {
        return -1;
    }

    if (!profile?.demo_expires_at) {
        return 0;
    }

    const expiryDate = new Date(profile.demo_expires_at);
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

    // Usuarios Pro siempre tienen acceso
    if (profile.plan_tier === 'professional' && profile.subscription_status === 'active') {
        return { allowed: true, reason: 'PRO_USER' };
    }

    // Usuarios en trial activo
    if (!isTrialExpired(profile)) {
        return { allowed: true, reason: 'ACTIVE_TRIAL' };
    }

    // Trial expirado
    return { allowed: false, reason: 'TRIAL_EXPIRED' };
}
