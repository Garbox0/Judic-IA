# 🎯 Recomendaciones Específicas para Tu Sistema

## Problemas Identificados en tu DB Actual

### 1. **Ambigüedad: Plan en `profiles` vs `organizations`**

**Problema:**
```sql
-- profiles tiene:
plan_tier TEXT DEFAULT 'free'
subscription_status TEXT DEFAULT 'inactive'

-- organizations TAMBIÉN tiene:
plan_tier TEXT DEFAULT 'free'
```

**Pregunta crítica:** ¿Cuál es la fuente de verdad?
- Si un abogado pertenece a una organización, ¿usa el plan del profile o de la org?
- ¿Qué pasa si el profile tiene `plan_tier: 'free'` pero la org tiene `plan_tier: 'professional'`?

**Solución:**

Opción A (B2C - Abogados individuales):
```sql
-- Plan siempre en profiles
-- organizations.plan_tier solo para orgs que compran plan corporativo
-- Si user.org_id IS NOT NULL, usar organizations.plan_tier
-- Si user.org_id IS NULL, usar profiles.plan_tier
```

Opción B (B2B - Organizaciones):
```sql
-- Plan SOLO en organizations
-- profiles NO tiene plan_tier (deprecated)
-- Todos los miembros de una org heredan el plan de la org
-- Abogados independientes crean una "org personal" automáticamente
```

**Recomendación:** Opción B si querés escalar a estudios jurídicos (más limpio a largo plazo).

---

### 2. **Campos Duplicados de MercadoPago**

**Problema:**
```sql
-- profiles tiene 4 campos de MP:
mp_preference_id TEXT
mp_customer_id TEXT
mp_preapproval_plan_id TEXT
mp_preapproval_id TEXT
mp_subscription_status TEXT
```

- `mp_preference_id` es para pagos únicos (deprecated si usás suscripciones)
- `mp_preapproval_plan_id` debería estar en la tabla de planes, no en profiles
- `mp_subscription_status` duplica `subscription_status`

**Solución:**
```sql
-- Limpiar profiles:
ALTER TABLE profiles DROP COLUMN mp_preference_id; -- Ya no se usa
ALTER TABLE profiles DROP COLUMN mp_preapproval_plan_id; -- Va en otra tabla

-- Unificar status:
-- Usar SOLO subscription_status (eliminar mp_subscription_status)
-- Valores: 'active', 'inactive', 'past_due', 'cancelled'
```

---

### 3. **Quotas No Resetean**

**Problema:**
```sql
ai_messages_used INTEGER DEFAULT 0
inquiries_used INTEGER DEFAULT 0
```

No veo ningún campo que indique CUÁNDO se resetearon estas quotas. Esto significa:
- ❌ No sabés si el usuario usó 100 mensajes hoy o hace 6 meses
- ❌ No podés resetear mensualmente
- ❌ No hay histórico de uso

**Solución Rápida (sin nueva tabla):**
```sql
ALTER TABLE profiles
ADD COLUMN quota_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Crear función que resetea automáticamente:
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    ai_messages_used = 0,
    inquiries_used = 0,
    quota_reset_at = NOW()
  WHERE DATE_TRUNC('month', quota_reset_at) < DATE_TRUNC('month', NOW());
END;
$$ LANGUAGE plpgsql;

-- CRON job (ejecutar diariamente):
SELECT reset_monthly_quotas();
```

**Solución Ideal (con tabla de tracking):**
Ver `TIER_IMPROVEMENTS_COMPLETE.md` → Tabla `usage_tracking`

---

### 4. **No Hay Histórico de Facturación**

**Problema:**
```sql
CREATE TABLE invoices (
  -- ...
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT now()
  -- ...
)
```

Tenés tabla de invoices pero:
- ❌ No hay relación con subscription_id (¿qué período cubre la factura?)
- ❌ No hay tracking de pagos fallidos vs exitosos
- ❌ No hay link a payment_id de MercadoPago

**Solución:**
```sql
ALTER TABLE invoices
ADD COLUMN subscription_id UUID REFERENCES user_subscriptions(id),
ADD COLUMN mp_payment_id TEXT,
ADD COLUMN billing_period_start DATE,
ADD COLUMN billing_period_end DATE,
ADD COLUMN payment_status TEXT DEFAULT 'pending'; -- 'pending', 'paid', 'failed', 'refunded'

-- Índice para queries rápidas
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);
```

---

### 5. **Roles Confusos**

**Problema:**
```sql
-- profiles tiene:
role TEXT DEFAULT 'user' CHECK (role IN ('lawyer', 'client', 'admin'))

-- org_members tiene:
role TEXT DEFAULT 'lawyer' CHECK (role IN ('owner', 'lawyer', 'staff', 'admin'))
```

**Pregunta:** ¿Un usuario puede ser `lawyer` en profiles pero `staff` en org_members?

**Solución:**
```sql
-- profiles.role = Rol GLOBAL del usuario en la plataforma
-- 'lawyer', 'client', 'admin' (ok, mantener)

-- org_members.role = Rol DENTRO de la organización
-- 'owner', 'member', 'admin', 'viewer' (simplificar)

-- Ejemplo:
-- Juan es 'lawyer' (profiles.role)
-- Juan es 'member' en "Estudio ABC" (org_members.role)
-- Juan es 'owner' en "Estudio Personal de Juan" (org_members.role)
```

---

### 6. **Campos Deprecated**

**Problema:**
```sql
-- profiles tiene campos que probablemente ya no uses:
demo_expires_at TIMESTAMP WITH TIME ZONE
subscription_expiry TIMESTAMP WITH TIME ZONE -- Con suscripciones recurrentes no aplica
```

**Solución:**
```sql
-- Si migrás a suscripciones recurrentes:
ALTER TABLE profiles DROP COLUMN subscription_expiry;

-- Si mantenés trials:
-- Renombrar para claridad
ALTER TABLE profiles RENAME COLUMN demo_expires_at TO trial_ends_at;
```

---

### 7. **Falta de Índices para Performance**

**Problema:**
Tu tabla `profiles` tiene muchas queries pero pocos índices:

```sql
-- Queries comunes que hacés:
WHERE plan_tier = 'professional'
WHERE subscription_status = 'active'
WHERE org_id = '...'
WHERE email = '...'
```

**Solución:**
```sql
-- Índices para queries frecuentes
CREATE INDEX idx_profiles_plan_tier ON profiles(plan_tier);
CREATE INDEX idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX idx_profiles_org_id ON profiles(org_id);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Índice compuesto para query más común
CREATE INDEX idx_profiles_plan_status ON profiles(plan_tier, subscription_status);

-- Para research_reports
CREATE INDEX idx_research_reports_user_id_created_at ON research_reports(user_id, created_at DESC);

-- Para inquiries
CREATE INDEX idx_inquiries_org_id_status ON inquiries(org_id, status);
```

---

### 8. **No Hay Soft Deletes**

**Problema:**
Si un usuario cancela su cuenta, perdés todo su histórico (casos, inquiries, research).

**Solución:**
```sql
-- Agregar soft deletes
ALTER TABLE profiles
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN delete_reason TEXT;

-- Modificar queries para excluir deleted
-- Antes:
SELECT * FROM profiles WHERE id = '...';

-- Después:
SELECT * FROM profiles WHERE id = '...' AND deleted_at IS NULL;

-- Crear vista helper
CREATE VIEW active_profiles AS
SELECT * FROM profiles WHERE deleted_at IS NULL;
```

---

## 🚀 Quick Wins (Mejoras de 1 día)

### Quick Win #1: Clarificar Nomenclatura

```sql
-- Migración de 5 minutos
UPDATE profiles
SET plan_tier = 'trial'
WHERE plan_tier = 'starter' AND subscription_status = 'demo';

UPDATE profiles
SET plan_tier = 'free'
WHERE plan_tier = 'starter' AND subscription_status = 'inactive';

-- Cambiar constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_tier_check
CHECK (plan_tier IN ('trial', 'free', 'professional', 'enterprise'));
```

---

### Quick Win #2: Reset Mensual de Quotas

```sql
-- Agregar campo (1 min)
ALTER TABLE profiles
ADD COLUMN quota_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Función de reset (2 min)
CREATE OR REPLACE FUNCTION reset_user_quotas(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_last_reset TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT quota_reset_at INTO v_last_reset
  FROM profiles
  WHERE id = p_user_id;

  -- Si pasó un mes, resetear
  IF DATE_TRUNC('month', v_last_reset) < DATE_TRUNC('month', NOW()) THEN
    UPDATE profiles
    SET
      ai_messages_used = 0,
      inquiries_used = 0,
      quota_reset_at = NOW()
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Llamar antes de cada acción
-- SELECT reset_user_quotas(current_user_id);
```

---

### Quick Win #3: Centralizar Plan Limits

```javascript
// lib/planLimits.js (crear archivo, 10 min)
export const PLAN_LIMITS = {
  trial: {
    ai_messages: 50,
    inquiries: 5,
    research_reports: 10,
    duration_days: 14
  },
  free: {
    ai_messages: 20,
    inquiries: 5,
    research_reports: 3
  },
  professional: {
    ai_messages: 1000,
    inquiries: 100,
    research_reports: 50,
    team_members: 5
  },
  enterprise: {
    ai_messages: -1, // Ilimitado
    inquiries: -1,
    research_reports: -1,
    team_members: -1
  }
};

export function getPlanLimit(planTier, limitKey) {
  return PLAN_LIMITS[planTier]?.[limitKey] ?? 0;
}

export function canPerformAction(profile, action) {
  const limit = getPlanLimit(profile.plan_tier, action);
  if (limit === -1) return true; // Ilimitado
  const used = profile[`${action}_used`] || 0;
  return used < limit;
}
```

**Reemplazar en código:**
```javascript
// ❌ Antes (hardcoded en 10 lugares diferentes):
if (profile.plan_tier === 'professional' && profile.ai_messages_used < 1000) {
  // ...
}

// ✅ Después (centralizado):
import { canPerformAction } from '@/lib/planLimits';

if (canPerformAction(profile, 'ai_messages')) {
  // ...
}
```

---

### Quick Win #4: Middleware de Verificación

```javascript
// lib/tierMiddleware.js (15 min)
import { supabase } from './supabase';
import { getPlanLimit } from './planLimits';

export async function verifyAccess(userId, requiredAction) {
  // 1. Reset quotas si es necesario
  await supabase.rpc('reset_user_quotas', { p_user_id: userId });

  // 2. Obtener perfil actualizado
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // 3. Verificar trial expirado
  if (profile.plan_tier === 'trial') {
    const trialEnd = new Date(profile.trial_ends_at);
    if (trialEnd < new Date()) {
      return {
        allowed: false,
        reason: 'TRIAL_EXPIRED',
        message: 'Tu período de prueba ha finalizado'
      };
    }
  }

  // 4. Verificar quota
  const limit = getPlanLimit(profile.plan_tier, requiredAction);
  const used = profile[`${requiredAction}_used`] || 0;

  if (limit !== -1 && used >= limit) {
    return {
      allowed: false,
      reason: 'QUOTA_EXCEEDED',
      message: `Has alcanzado el límite de ${requiredAction}`,
      current: used,
      limit: limit
    };
  }

  return { allowed: true, profile };
}

// Uso en API routes:
export async function POST(request) {
  const userId = await getCurrentUserId();
  const access = await verifyAccess(userId, 'research_reports');

  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason, message: access.message },
      { status: 403 }
    );
  }

  // Realizar acción...
  const result = await performResearch();

  // Incrementar contador
  await supabase.rpc('increment_quota', {
    p_user_id: userId,
    p_quota_key: 'research_reports',
    p_amount: 1
  });

  return NextResponse.json({ result });
}
```

---

### Quick Win #5: Función SQL para Incrementar Quotas

```sql
-- Evita race conditions (2 requests simultáneos)
CREATE OR REPLACE FUNCTION increment_quota(
  p_user_id UUID,
  p_quota_key TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  v_new_value INTEGER;
BEGIN
  -- Actualizar atómicamente
  UPDATE profiles
  SET ai_messages_used = CASE
      WHEN p_quota_key = 'ai_messages' THEN ai_messages_used + p_amount
      ELSE ai_messages_used
    END,
    inquiries_used = CASE
      WHEN p_quota_key = 'inquiries' THEN inquiries_used + p_amount
      ELSE inquiries_used
    END
  WHERE id = p_user_id
  RETURNING CASE
    WHEN p_quota_key = 'ai_messages' THEN ai_messages_used
    WHEN p_quota_key = 'inquiries' THEN inquiries_used
    ELSE 0
  END INTO v_new_value;

  RETURN v_new_value;
END;
$$ LANGUAGE plpgsql;

-- Uso:
-- SELECT increment_quota('user-id', 'ai_messages', 1);
```

---

## 📊 Priorización Recomendada

### Fase 1 (Esta semana - 1-2 días):
1. ✅ Quick Win #1: Clarificar nomenclatura (trial/free/pro)
2. ✅ Quick Win #2: Reset mensual de quotas
3. ✅ Quick Win #3: Centralizar plan limits en código
4. ✅ Agregar índices a profiles y research_reports

### Fase 2 (Próxima semana - 3-5 días):
5. ✅ Implementar suscripciones recurrentes de MercadoPago
6. ✅ Migrar usuarios actuales a sistema de suscripciones
7. ✅ Agregar gracia period para pagos fallidos
8. ✅ Email notifications (pago exitoso, fallido, cancelación)

### Fase 3 (Mes siguiente - opcional):
9. ⭐ Refactorización completa (si querés escalar fuerte)
10. ⭐ Tabla de usage_tracking para analytics
11. ⭐ Admin panel para gestionar planes
12. ⭐ Feature flags dinámicos

---

## 🎯 Mi Recomendación Final

**Para empezar HOY:**
1. Implementá los 5 Quick Wins (1 día de trabajo)
2. Migrá a suscripciones recurrentes de MercadoPago (2-3 días)
3. Dejá la refactorización completa para cuando tengas más usuarios y necesites escalar

**Por qué:**
- ✅ Mejora inmediata de UX (reset mensual de quotas)
- ✅ Menos churn (suscripciones automáticas)
- ✅ Código más mantenible (centralizado)
- ✅ Preparado para crecer sin re-arquitecturar todo

**Cuando refactorizar:**
- Cuando tengas > 100 usuarios pagos
- Cuando quieras ofrecer 3+ tiers diferentes
- Cuando necesites analytics detallados de uso
- Cuando agregues planes corporativos

---

¿Querés que te ayude a implementar alguno de estos quick wins ahora? 🚀
