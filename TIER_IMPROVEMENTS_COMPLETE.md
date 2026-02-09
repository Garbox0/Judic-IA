# 🏗️ Refactorización Completa del Sistema de Tiers

## Arquitectura Normalizada y Escalable

Esta opción requiere más trabajo inicial pero te da:
- ✅ Planes configurables desde DB (sin deploy para cambios)
- ✅ Features dinámicos por tier
- ✅ Soporte multi-organización real
- ✅ Analytics de uso detallados
- ✅ Escalabilidad para 10+ tiers diferentes

---

## 📋 Nuevo Esquema de Base de Datos

### 1. Tabla `subscription_plans`
Define los planes disponibles:

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- 'trial', 'free', 'professional', 'enterprise'
  name TEXT NOT NULL, -- 'Trial Gratuito', 'Plan Profesional', etc.
  description TEXT,
  price_monthly NUMERIC DEFAULT 0,
  price_annual NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true, -- false para planes internos/custom
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed inicial
INSERT INTO subscription_plans (slug, name, description, price_monthly, price_annual, sort_order) VALUES
('trial', 'Prueba Gratuita', '14 días de acceso completo', 0, 0, 1),
('free', 'Plan Gratuito', 'Funcionalidad limitada', 0, 0, 2),
('professional', 'Profesional', 'Acceso completo para abogados independientes', 25000, 250000, 3),
('enterprise', 'Empresarial', 'Para estudios jurídicos', 0, 0, 4); -- Precio custom, contactar ventas
```

---

### 2. Tabla `plan_quotas`
Define límites por plan (dinámico, no hardcoded):

```sql
CREATE TABLE plan_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE CASCADE,
  quota_key TEXT NOT NULL, -- 'ai_messages', 'inquiries', 'research_reports', etc.
  quota_limit INTEGER NOT NULL, -- -1 = ilimitado
  reset_period TEXT DEFAULT 'monthly', -- 'monthly', 'annual', 'never'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, quota_key)
);

-- Seed para plan Trial
INSERT INTO plan_quotas (plan_id, quota_key, quota_limit, reset_period)
SELECT id, 'ai_messages', 50, 'never' FROM subscription_plans WHERE slug = 'trial'
UNION ALL
SELECT id, 'inquiries', 5, 'never' FROM subscription_plans WHERE slug = 'trial'
UNION ALL
SELECT id, 'research_reports', 10, 'never' FROM subscription_plans WHERE slug = 'trial';

-- Seed para plan Professional
INSERT INTO plan_quotas (plan_id, quota_key, quota_limit, reset_period)
SELECT id, 'ai_messages', 1000, 'monthly' FROM subscription_plans WHERE slug = 'professional'
UNION ALL
SELECT id, 'inquiries', 100, 'monthly' FROM subscription_plans WHERE slug = 'professional'
UNION ALL
SELECT id, 'research_reports', 50, 'monthly' FROM subscription_plans WHERE slug = 'professional'
UNION ALL
SELECT id, 'team_members', 5, 'never' FROM subscription_plans WHERE slug = 'professional';

-- Seed para plan Enterprise (ilimitado)
INSERT INTO plan_quotas (plan_id, quota_key, quota_limit, reset_period)
SELECT id, 'ai_messages', -1, 'monthly' FROM subscription_plans WHERE slug = 'enterprise'
UNION ALL
SELECT id, 'inquiries', -1, 'monthly' FROM subscription_plans WHERE slug = 'enterprise'
UNION ALL
SELECT id, 'research_reports', -1, 'monthly' FROM subscription_plans WHERE slug = 'enterprise'
UNION ALL
SELECT id, 'team_members', -1, 'never' FROM subscription_plans WHERE slug = 'enterprise';
```

---

### 3. Tabla `plan_features`
Define qué features tiene cada plan:

```sql
CREATE TABLE plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL, -- 'advanced_research', 'case_library', 'api_access', etc.
  is_enabled BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}', -- Para configuraciones extras
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, feature_key)
);

-- Definir features disponibles
CREATE TABLE feature_catalog (
  feature_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'core', 'ai', 'collaboration', 'integrations'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO feature_catalog (feature_key, name, description, category) VALUES
('basic_search', 'Búsqueda básica', 'Búsqueda simple de jurisprudencia', 'core'),
('advanced_research', 'Investigación avanzada', 'Terminal de estrategia con IA', 'ai'),
('case_library', 'Biblioteca de casos', 'Acceso a casos guardados', 'core'),
('team_collaboration', 'Colaboración', 'Trabajo en equipo', 'collaboration'),
('api_access', 'API Access', 'Acceso programático', 'integrations'),
('priority_support', 'Soporte prioritario', 'Respuesta en <24hs', 'support'),
('custom_branding', 'Branding personalizado', 'Logo y colores propios', 'enterprise'),
('sla_guarantee', 'SLA Garantizado', 'Uptime 99.9%', 'enterprise');

-- Seed features para cada plan
-- Trial: Todo habilitado temporalmente
INSERT INTO plan_features (plan_id, feature_key, is_enabled)
SELECT p.id, f.feature_key, true
FROM subscription_plans p
CROSS JOIN feature_catalog f
WHERE p.slug = 'trial' AND f.category IN ('core', 'ai', 'collaboration');

-- Free: Solo básico
INSERT INTO plan_features (plan_id, feature_key, is_enabled)
SELECT p.id, f.feature_key, true
FROM subscription_plans p
CROSS JOIN feature_catalog f
WHERE p.slug = 'free' AND f.feature_key = 'basic_search';

-- Professional: Core + AI + Collaboration
INSERT INTO plan_features (plan_id, feature_key, is_enabled)
SELECT p.id, f.feature_key, true
FROM subscription_plans p
CROSS JOIN feature_catalog f
WHERE p.slug = 'professional' AND f.category IN ('core', 'ai', 'collaboration', 'support');

-- Enterprise: Todo
INSERT INTO plan_features (plan_id, feature_key, is_enabled)
SELECT p.id, f.feature_key, true
FROM subscription_plans p
CROSS JOIN feature_catalog f
WHERE p.slug = 'enterprise';
```

---

### 4. Tabla `user_subscriptions`
Separa la suscripción del perfil (permite histórico):

```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  status TEXT DEFAULT 'active', -- 'active', 'cancelled', 'expired', 'past_due'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL = no expira (free tier)
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT,

  -- MercadoPago integration
  mp_subscription_id TEXT,
  mp_preapproval_id TEXT,
  mp_customer_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Para datos extra (cupones, descuentos, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);

-- Vista helper para obtener suscripción activa
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT
  us.*,
  sp.slug as plan_slug,
  sp.name as plan_name
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.status = 'active'
  AND (us.expires_at IS NULL OR us.expires_at > NOW());
```

---

### 5. Tabla `usage_tracking`
Tracking detallado de uso:

```sql
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_key TEXT NOT NULL, -- 'ai_messages', 'inquiries', etc.
  amount INTEGER DEFAULT 1,
  period_start DATE NOT NULL, -- Primer día del período (ej: 2024-01-01)
  period_end DATE NOT NULL,   -- Último día del período (ej: 2024-01-31)
  metadata JSONB DEFAULT '{}', -- Para contexto (ej: inquiry_id, message_id)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para queries rápidas
CREATE INDEX idx_usage_tracking_user_period ON usage_tracking(user_id, period_start, quota_key);
CREATE INDEX idx_usage_tracking_created_at ON usage_tracking(created_at);

-- Vista agregada para uso actual
CREATE OR REPLACE VIEW current_usage AS
SELECT
  user_id,
  quota_key,
  SUM(amount) as total_used,
  DATE_TRUNC('month', NOW()) as period_start
FROM usage_tracking
WHERE period_start = DATE_TRUNC('month', NOW())
GROUP BY user_id, quota_key;
```

---

### 6. Tabla `subscription_history`
Auditoría completa de cambios:

```sql
CREATE TABLE subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id),
  event_type TEXT NOT NULL, -- 'created', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'expired'
  from_plan_id UUID REFERENCES subscription_plans(id),
  to_plan_id UUID REFERENCES subscription_plans(id),
  reason TEXT,
  metadata JSONB DEFAULT '{}', -- Datos extra (ej: payment_id, coupon_code)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX idx_subscription_history_event_type ON subscription_history(event_type);
```

---

## 🔧 Funciones de Base de Datos (PostgreSQL)

### Función: Obtener límites del plan actual

```sql
CREATE OR REPLACE FUNCTION get_user_quota_limit(p_user_id UUID, p_quota_key TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  SELECT pq.quota_limit INTO v_limit
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  JOIN plan_quotas pq ON pq.plan_id = sp.id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND (us.expires_at IS NULL OR us.expires_at > NOW())
    AND pq.quota_key = p_quota_key
  ORDER BY us.started_at DESC
  LIMIT 1;

  RETURN COALESCE(v_limit, 0);
END;
$$ LANGUAGE plpgsql;
```

### Función: Obtener uso actual del usuario

```sql
CREATE OR REPLACE FUNCTION get_user_current_usage(p_user_id UUID, p_quota_key TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_usage INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_usage
  FROM usage_tracking
  WHERE user_id = p_user_id
    AND quota_key = p_quota_key
    AND period_start = DATE_TRUNC('month', NOW());

  RETURN v_usage;
END;
$$ LANGUAGE plpgsql;
```

### Función: Verificar si el usuario puede realizar acción

```sql
CREATE OR REPLACE FUNCTION can_user_perform_action(p_user_id UUID, p_quota_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_limit INTEGER;
  v_usage INTEGER;
BEGIN
  v_limit := get_user_quota_limit(p_user_id, p_quota_key);

  -- -1 = ilimitado
  IF v_limit = -1 THEN
    RETURN true;
  END IF;

  v_usage := get_user_current_usage(p_user_id, p_quota_key);

  RETURN v_usage < v_limit;
END;
$$ LANGUAGE plpgsql;
```

### Función: Registrar uso

```sql
CREATE OR REPLACE FUNCTION track_usage(
  p_user_id UUID,
  p_quota_key TEXT,
  p_amount INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
  v_period_start DATE := DATE_TRUNC('month', NOW());
  v_period_end DATE := (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
BEGIN
  INSERT INTO usage_tracking (user_id, quota_key, amount, period_start, period_end, metadata)
  VALUES (p_user_id, p_quota_key, p_amount, v_period_start, v_period_end, p_metadata);
END;
$$ LANGUAGE plpgsql;
```

---

## 📦 Librería JavaScript

```javascript
// lib/subscription/index.js
import { supabase } from '../supabase';

export class SubscriptionManager {
  /**
   * Obtiene la suscripción activa de un usuario
   */
  static async getActiveSubscription(userId) {
    const { data, error } = await supabase
      .from('active_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Obtiene los límites del plan actual
   */
  static async getPlanLimits(userId) {
    const subscription = await this.getActiveSubscription(userId);

    const { data, error } = await supabase
      .from('plan_quotas')
      .select('quota_key, quota_limit, reset_period')
      .eq('plan_id', subscription.plan_id);

    if (error) throw error;

    // Convertir a objeto { ai_messages: 1000, inquiries: 100, ... }
    return data.reduce((acc, quota) => {
      acc[quota.quota_key] = {
        limit: quota.quota_limit,
        reset_period: quota.reset_period
      };
      return acc;
    }, {});
  }

  /**
   * Obtiene las features habilitadas del plan actual
   */
  static async getPlanFeatures(userId) {
    const subscription = await this.getActiveSubscription(userId);

    const { data, error } = await supabase
      .from('plan_features')
      .select('feature_key, is_enabled, metadata')
      .eq('plan_id', subscription.plan_id)
      .eq('is_enabled', true);

    if (error) throw error;

    return data.map(f => f.feature_key);
  }

  /**
   * Verifica si el usuario tiene acceso a una feature
   */
  static async hasFeature(userId, featureKey) {
    const features = await this.getPlanFeatures(userId);
    return features.includes(featureKey);
  }

  /**
   * Verifica si el usuario puede realizar una acción
   */
  static async canPerformAction(userId, quotaKey) {
    const { data, error } = await supabase.rpc(
      'can_user_perform_action',
      { p_user_id: userId, p_quota_key: quotaKey }
    );

    if (error) throw error;
    return data;
  }

  /**
   * Registra el uso de una quota
   */
  static async trackUsage(userId, quotaKey, amount = 1, metadata = {}) {
    const { error } = await supabase.rpc('track_usage', {
      p_user_id: userId,
      p_quota_key: quotaKey,
      p_amount: amount,
      p_metadata: metadata
    });

    if (error) throw error;
  }

  /**
   * Obtiene el uso actual del usuario
   */
  static async getCurrentUsage(userId) {
    const { data, error } = await supabase
      .from('current_usage')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    return data.reduce((acc, usage) => {
      acc[usage.quota_key] = usage.total_used;
      return acc;
    }, {});
  }

  /**
   * Cambia el plan de un usuario
   */
  static async changePlan(userId, newPlanSlug, reason = null) {
    // 1. Obtener plan nuevo
    const { data: newPlan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('slug', newPlanSlug)
      .single();

    // 2. Obtener suscripción actual
    const currentSub = await this.getActiveSubscription(userId);

    // 3. Cancelar suscripción actual
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date(),
        cancel_reason: reason
      })
      .eq('id', currentSub.id);

    // 4. Crear nueva suscripción
    const { data: newSub, error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: newPlan.id,
        status: 'active',
        expires_at: newPlanSlug === 'trial'
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 días
          : null
      })
      .select()
      .single();

    if (error) throw error;

    // 5. Registrar en historial
    await supabase.from('subscription_history').insert({
      user_id: userId,
      subscription_id: newSub.id,
      event_type: currentSub.plan_id === newPlan.id ? 'renewed' : 'upgraded',
      from_plan_id: currentSub.plan_id,
      to_plan_id: newPlan.id,
      reason: reason
    });

    return newSub;
  }
}
```

---

## 🎯 Uso en Componentes

```javascript
// app/dashboard/research/ResearchContent.js
import { SubscriptionManager } from '@/lib/subscription';

export default function ResearchPage() {
  const [canUseAdvancedResearch, setCanUseAdvancedResearch] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState(null);

  useEffect(() => {
    async function checkAccess() {
      const userId = getCurrentUserId();

      // Verificar feature
      const hasFeature = await SubscriptionManager.hasFeature(
        userId,
        'advanced_research'
      );
      setCanUseAdvancedResearch(hasFeature);

      // Obtener info de quotas
      const limits = await SubscriptionManager.getPlanLimits(userId);
      const usage = await SubscriptionManager.getCurrentUsage(userId);

      setQuotaInfo({
        research_reports: {
          used: usage.research_reports || 0,
          limit: limits.research_reports?.limit || 0
        }
      });
    }

    checkAccess();
  }, []);

  const handleSearch = async () => {
    const userId = getCurrentUserId();

    // Verificar si puede hacer la búsqueda
    const canSearch = await SubscriptionManager.canPerformAction(
      userId,
      'research_reports'
    );

    if (!canSearch) {
      alert('Has alcanzado el límite de reportes de investigación de tu plan.');
      return;
    }

    // Realizar búsqueda...
    const results = await performSearch(query);

    // Registrar uso
    await SubscriptionManager.trackUsage(
      userId,
      'research_reports',
      1,
      { query: query, result_count: results.length }
    );
  };

  if (!canUseAdvancedResearch) {
    return <UpgradePrompt requiredFeature="advanced_research" />;
  }

  return (
    <div>
      <QuotaDisplay
        used={quotaInfo?.research_reports.used}
        limit={quotaInfo?.research_reports.limit}
      />
      {/* ... resto del componente */}
    </div>
  );
}
```

---

## 🚀 Migración desde Sistema Actual

```sql
-- Script de migración (ejecutar en orden)

-- 1. Crear nuevas tablas
\i migration_001_create_subscription_tables.sql

-- 2. Migrar usuarios existentes
INSERT INTO user_subscriptions (user_id, plan_id, status, started_at, expires_at)
SELECT
  p.id as user_id,
  (SELECT id FROM subscription_plans WHERE slug =
    CASE
      WHEN p.plan_tier = 'professional' THEN 'professional'
      WHEN p.subscription_status = 'demo' THEN 'trial'
      ELSE 'free'
    END
  ) as plan_id,
  CASE
    WHEN p.subscription_status = 'active' THEN 'active'
    WHEN p.demo_expires_at > NOW() THEN 'active'
    ELSE 'expired'
  END as status,
  p.created_at as started_at,
  CASE
    WHEN p.demo_expires_at IS NOT NULL THEN p.demo_expires_at
    WHEN p.subscription_expiry IS NOT NULL THEN p.subscription_expiry
    ELSE NULL
  END as expires_at
FROM profiles p;

-- 3. Migrar uso acumulado a tracking
INSERT INTO usage_tracking (user_id, quota_key, amount, period_start, period_end)
SELECT
  id as user_id,
  'ai_messages' as quota_key,
  ai_messages_used as amount,
  DATE_TRUNC('month', NOW()) as period_start,
  (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day')::DATE as period_end
FROM profiles
WHERE ai_messages_used > 0;

INSERT INTO usage_tracking (user_id, quota_key, amount, period_start, period_end)
SELECT
  id as user_id,
  'inquiries' as quota_key,
  inquiries_used as amount,
  DATE_TRUNC('month', NOW()) as period_start,
  (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day')::DATE as period_end
FROM profiles
WHERE inquiries_used > 0;

-- 4. (Opcional) Deprecar campos viejos de profiles
-- ALTER TABLE profiles DROP COLUMN plan_tier;
-- ALTER TABLE profiles DROP COLUMN subscription_status;
-- ALTER TABLE profiles DROP COLUMN ai_messages_used;
-- etc.
```

---

## 📊 Benefits de Esta Arquitectura

✅ **Planes configurables**: Cambiar límites desde admin panel sin deploy
✅ **Histórico completo**: Saber exactamente cuándo y por qué un usuario cambió de plan
✅ **Analytics detallados**: Reportes de uso por feature, por período, por plan
✅ **Escalabilidad**: Agregar nuevos planes en minutos
✅ **A/B Testing**: Crear planes experimentales fácilmente
✅ **Personalizaciónː Custom plans para clientes enterprise
✅ **Audit completo**: Compliance y troubleshooting simplificados
✅ **Multi-tenancy**: Preparado para planes por organización

---

## ⏱️ Estimación de Esfuerzo

- **Migración DB**: 2-3 días
- **Refactor backend**: 3-5 días
- **Refactor frontend**: 2-3 días
- **Testing**: 2-3 días
- **Total**: ~2 semanas de trabajo

---

## 🎁 Bonus: Admin Panel para Gestión de Planes

Con esta arquitectura, podrías crear un panel de admin para:
- ✏️ Crear/editar planes sin tocar código
- 📊 Ver analytics de uso por plan
- 👥 Asignar planes custom a usuarios específicos
- 🎟️ Crear cupones y promociones
- 📈 A/B testing de precios y límites
