/**
 * TIER MIDDLEWARE
 * Centraliza todas las verificaciones de acceso y quotas
 * Usar en API routes y componentes para verificar permisos
 */

import { createClient } from '@supabase/supabase-js';
import { getPlanLimit, hasFeature, canPerformAction } from './planLimits';

// Initialize Supabase client with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verifica si el trial del usuario ha expirado
 * @param {object} profile - Profile de Supabase
 * @returns {boolean}
 */
export function isTrialExpired(profile) {
  // Si es professional o enterprise, nunca expira
  if (profile?.plan_tier === 'professional' || profile?.plan_tier === 'enterprise') {
    return false;
  }

  // Si es trial, verificar fecha
  if (profile?.plan_tier === 'trial') {
    if (!profile.trial_ends_at) return true; // Sin fecha = expirado
    return new Date(profile.trial_ends_at) < new Date();
  }

  // Si es free, no "expira" pero tiene acceso limitado
  return false;
}

/**
 * Verifica acceso completo de un usuario (trial no expirado + features + quotas)
 * @param {string} userId - ID del usuario
 * @param {string} requiredFeature - Feature requerida (ej: 'advanced_research')
 * @param {string} requiredAction - Acción que consumirá quota (ej: 'research_reports')
 * @returns {Promise<object>} { allowed, reason, message, profile }
 */
export async function verifyAccess(userId, requiredFeature = null, requiredAction = null) {
  try {
    // 1. Resetear quotas si es necesario (llamar a función SQL)
    await supabase.rpc('reset_user_quotas', { p_user_id: userId });

    // 2. Obtener perfil actualizado
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return {
        allowed: false,
        reason: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado'
      };
    }

    // 3. Verificar soft delete
    if (profile.deleted_at) {
      return {
        allowed: false,
        reason: 'ACCOUNT_DELETED',
        message: 'Esta cuenta ha sido eliminada'
      };
    }

    // 4. Verificar trial expirado
    if (isTrialExpired(profile)) {
      return {
        allowed: false,
        reason: 'TRIAL_EXPIRED',
        message: 'Tu período de prueba ha finalizado. Actualizá a Professional para continuar.',
        upgrade_required: true,
        current_plan: profile.plan_tier,
        recommended_plan: 'professional'
      };
    }

    // 5. Verificar feature requerida (si se especificó)
    if (requiredFeature && !hasFeature(profile.plan_tier, requiredFeature)) {
      // Excepción: si la feature bloqueada es 'advanced_research' y el usuario
      // tiene créditos extra pagados, le permitimos usarlos aunque su suscripción
      // haya vencido. Los créditos ya fueron pagados.
      const hasExtraCredits =
        requiredFeature === 'advanced_research' &&
        (profile.research_reports_extra || 0) > 0;

      if (!hasExtraCredits) {
        return {
          allowed: false,
          reason: 'FEATURE_NOT_AVAILABLE',
          message: `Esta funcionalidad requiere el Plan Profesional.`,
          upgrade_required: true,
          current_plan: profile.plan_tier,
          recommended_plan: 'professional',
          required_feature: requiredFeature
        };
      }
    }

    // 6. Verificar quota (si se especificó acción)
    if (requiredAction && !canPerformAction(profile, requiredAction)) {
      const limit = getPlanLimit(profile.plan_tier, requiredAction);
      const used = profile[`${requiredAction}_used`] || 0;

      return {
        allowed: false,
        reason: 'QUOTA_EXCEEDED',
        message: `Has alcanzado el límite de ${requiredAction} de tu plan.`,
        upgrade_required: true,
        current_plan: profile.plan_tier,
        recommended_plan: 'professional',
        quota_info: {
          action: requiredAction,
          used: used,
          limit: limit,
          remaining: 0
        }
      };
    }

    // ✅ Todo OK
    return {
      allowed: true,
      profile: profile
    };

  } catch (error) {
    console.error('❌ verifyAccess error:', error);
    return {
      allowed: false,
      reason: 'VERIFICATION_ERROR',
      message: 'Error al verificar acceso',
      error: error.message
    };
  }
}

/**
 * Incrementa el contador de uso de una acción
 * @param {string} userId - ID del usuario
 * @param {string} action - 'ai_messages', 'inquiries', 'research_reports'
 * @param {number} amount - Cantidad a incrementar (default: 1)
 * @returns {Promise<number>} Nuevo valor
 */
export async function incrementUsage(userId, action, amount = 1) {
  try {
    const { data, error } = await supabase.rpc('increment_quota', {
      p_user_id: userId,
      p_quota_key: action,
      p_amount: amount
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('❌ incrementUsage error:', error);
    throw error;
  }
}

/**
 * Verifica acceso y retorna respuesta HTTP si falla
 * Helper para usar en API routes
 * @param {string} userId
 * @param {string} requiredFeature
 * @param {string} requiredAction
 * @returns {Promise<object|null>} NextResponse si falla, null si OK
 */
export async function verifyAccessOrRespond(userId, requiredFeature = null, requiredAction = null) {
  const access = await verifyAccess(userId, requiredFeature, requiredAction);

  if (!access.allowed) {
    const status = access.reason === 'USER_NOT_FOUND' ? 404 : 403;

    return {
      error: access.reason,
      message: access.message,
      upgrade_required: access.upgrade_required,
      current_plan: access.current_plan,
      recommended_plan: access.recommended_plan,
      quota_info: access.quota_info
    };
  }

  return null; // null = OK, continuar
}

/**
 * Hook para usar en componentes de React
 * Verifica acceso y retorna estado
 */
export function useAccess(userId, requiredFeature = null) {
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      if (!userId) {
        setLoading(false);
        return;
      }

      const result = await verifyAccess(userId, requiredFeature);
      setAccess(result);
      setLoading(false);
    }

    checkAccess();
  }, [userId, requiredFeature]);

  return { access, loading };
}

/**
 * Verifica si un usuario puede invitar más miembros a su organización
 * @param {object} profile - Profile del usuario
 * @param {number} currentMembers - Miembros actuales en la org
 * @returns {boolean}
 */
export function canInviteTeamMembers(profile, currentMembers) {
  const limit = getPlanLimit(profile.plan_tier, 'team_members');

  if (limit === -1) return true; // Ilimitado
  return currentMembers < limit;
}

/**
 * Verifica si el usuario está en "gracia period" tras pago fallido
 * @param {object} profile
 * @returns {boolean}
 */
export function isInGracePeriod(profile) {
  if (profile.subscription_status !== 'past_due') return false;
  if (!profile.grace_period_ends_at) return false;

  return new Date(profile.grace_period_ends_at) > new Date();
}

/**
 * Obtiene días restantes de gracia period
 * @param {object} profile
 * @returns {number} Días restantes (0 si no aplica)
 */
export function getGracePeriodDaysLeft(profile) {
  if (!isInGracePeriod(profile)) return 0;

  const now = new Date();
  const end = new Date(profile.grace_period_ends_at);
  const diffMs = end - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}
