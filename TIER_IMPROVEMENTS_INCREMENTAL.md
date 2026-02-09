# 🔧 Mejoras Incrementales al Sistema de Tiers

## Cambios Mínimos (Sin Refactorizar DB)

### 1. Clarificar Nomenclatura
Cambiar la lógica de `plan_tier` para ser más explícita:

```javascript
// lib/subscription.js
export const PLAN_TIERS = {
  TRIAL: 'trial',           // Nuevo usuario en demo (antes starter+demo)
  FREE: 'free',             // Usuario gratis/expirado (antes starter+inactive)
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise'  // Para futuro
};

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  CANCELLED: 'cancelled',
  PAST_DUE: 'past_due'      // Para manejo de pagos fallidos
};
```

**Migración DB:**
```sql
-- Migrar usuarios actuales
UPDATE profiles
SET plan_tier = 'trial'
WHERE plan_tier = 'starter' AND subscription_status = 'demo';

UPDATE profiles
SET plan_tier = 'free'
WHERE plan_tier = 'starter' AND subscription_status = 'inactive';
```

---

### 2. Centralizar Quotas (Sin Nueva Tabla)
Crear un único archivo de configuración:

```javascript
// lib/planLimits.js
export const PLAN_LIMITS = {
  trial: {
    ai_messages: 20,
    inquiries: 3,
    research_reports: 5,
    team_members: 1,
    storage_mb: 100,
    features: {
      advanced_research: false,
      case_library: false,
      team_collaboration: false,
      api_access: false,
      priority_support: false
    }
  },
  free: {
    ai_messages: 20,
    inquiries: 5,
    research_reports: 3,
    team_members: 1,
    storage_mb: 50,
    features: {
      advanced_research: false,
      case_library: false,
      team_collaboration: false,
      api_access: false,
      priority_support: false
    }
  },
  professional: {
    ai_messages: 1000,
    inquiries: 100,
    research_reports: 50,
    team_members: 5,
    storage_mb: 5000,
    features: {
      advanced_research: true,
      case_library: true,
      team_collaboration: true,
      api_access: false,
      priority_support: true
    }
  },
  enterprise: {
    ai_messages: -1, // Ilimitado
    inquiries: -1,
    research_reports: -1,
    team_members: -1,
    storage_mb: -1,
    features: {
      advanced_research: true,
      case_library: true,
      team_collaboration: true,
      api_access: true,
      priority_support: true,
      custom_branding: true,
      sla_guarantee: true
    }
  }
};

// Helper functions
export function getPlanLimit(planTier, limitKey) {
  return PLAN_LIMITS[planTier]?.[limitKey] ?? 0;
}

export function hasFeature(planTier, featureName) {
  return PLAN_LIMITS[planTier]?.features?.[featureName] ?? false;
}

export function canPerformAction(profile, action) {
  const limits = PLAN_LIMITS[profile.plan_tier];
  if (!limits) return false;

  switch(action) {
    case 'ai_message':
      if (limits.ai_messages === -1) return true; // Ilimitado
      return (profile.ai_messages_used || 0) < limits.ai_messages;

    case 'inquiry':
      if (limits.inquiries === -1) return true;
      return (profile.inquiries_used || 0) < limits.inquiries;

    // ... más casos
    default:
      return false;
  }
}
```

**Uso en componentes:**
```javascript
// Dashboard Research
import { hasFeature, canPerformAction } from '@/lib/planLimits';

if (!hasFeature(profile.plan_tier, 'advanced_research')) {
  return <UpgradePrompt feature="advanced_research" />;
}

if (!canPerformAction(profile, 'research_report')) {
  return <QuotaExceeded type="research_reports" />;
}
```

---

### 3. Reset Mensual de Quotas
Agregar tracking de períodos:

```javascript
// lib/quotaManager.js
export async function resetMonthlyQuotas(userId) {
  const profile = await getProfile(userId);
  const lastReset = new Date(profile.quota_reset_at || profile.created_at);
  const now = new Date();

  // Si pasó un mes desde el último reset
  if (now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()) {

    await supabase.from('profiles').update({
      ai_messages_used: 0,
      inquiries_used: 0,
      quota_reset_at: now
    }).eq('id', userId);

    return true;
  }

  return false;
}
```

**Agregar campo a DB:**
```sql
ALTER TABLE profiles
ADD COLUMN quota_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

---

### 4. Middleware de Verificación Unificado
Crear un único punto de control:

```javascript
// lib/tierMiddleware.js
export async function verifyTierAccess(userId, requiredFeature) {
  const profile = await getProfile(userId);

  // 1. Verificar trial expirado
  if (isTrialExpired(profile)) {
    return {
      allowed: false,
      reason: 'TRIAL_EXPIRED',
      upgrade_required: true
    };
  }

  // 2. Reset mensual de quotas (si aplica)
  await resetMonthlyQuotas(userId);

  // 3. Verificar feature disponible en tier
  if (!hasFeature(profile.plan_tier, requiredFeature)) {
    return {
      allowed: false,
      reason: 'FEATURE_NOT_AVAILABLE',
      upgrade_required: true,
      required_tier: 'professional'
    };
  }

  // 4. Verificar quota
  if (!canPerformAction(profile, requiredFeature)) {
    return {
      allowed: false,
      reason: 'QUOTA_EXCEEDED',
      current_usage: profile[`${requiredFeature}_used`],
      limit: getPlanLimit(profile.plan_tier, requiredFeature)
    };
  }

  return { allowed: true };
}
```

**Uso en API routes:**
```javascript
// app/api/research/route.js
const access = await verifyTierAccess(userId, 'advanced_research');

if (!access.allowed) {
  return NextResponse.json(
    { error: access.reason, ...access },
    { status: 403 }
  );
}
```

---

### 5. Tracking de Cambios de Plan
Agregar tabla simple de auditoría:

```sql
CREATE TABLE plan_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  from_tier TEXT,
  to_tier TEXT,
  reason TEXT, -- 'upgrade', 'downgrade', 'trial_expired', 'payment_failed'
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Función helper:**
```javascript
// lib/planManager.js
export async function changePlan(userId, newTier, reason) {
  const profile = await getProfile(userId);

  // Log el cambio
  await supabase.from('plan_changes').insert({
    user_id: userId,
    from_tier: profile.plan_tier,
    to_tier: newTier,
    reason: reason
  });

  // Actualizar perfil
  await supabase.from('profiles').update({
    plan_tier: newTier,
    subscription_status: 'active',
    subscription_started_at: new Date()
  }).eq('id', userId);
}
```

---

## 📊 Beneficios Inmediatos

✅ **Nomenclatura clara**: trial, free, professional (no más starter+demo)
✅ **Quotas centralizadas**: Fácil cambiar límites sin deploy
✅ **Features por tier definidos**: Fuente única de verdad
✅ **Reset mensual automático**: Mejor UX, menos confusión
✅ **Auditoría de cambios**: Saber por qué un usuario cambió de plan
✅ **Middleware unificado**: Menos código duplicado, más seguro

---

## 🚀 Implementación Sugerida

1. **Semana 1**: Migrar nomenclatura (trial/free/pro) + crear planLimits.js
2. **Semana 2**: Implementar middleware + reset mensual
3. **Semana 3**: Agregar tabla plan_changes + refactorizar verificaciones existentes
4. **Semana 4**: Testing + monitoreo de uso real

---

## 🔮 Futuro: Si Querés Escalar Más

- Tabla `subscription_plans` en DB (no hardcoded)
- Tabla `usage_logs` para analytics detallados
- Soporte multi-organización (plan en `organizations`, no en `profiles`)
- API de admin para crear planes custom
- Feature flags dinámicos (toggle features sin deploy)
