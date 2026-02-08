# 📘 Ejemplos de Uso - Sistema de Tiers

## 1. Verificar Acceso en API Routes

### Antes (hardcoded, inconsistente):
```javascript
// ❌ Código viejo - NO USAR
export async function POST(request) {
  const userId = await getCurrentUserId();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // Verificación hardcodeada
  if (profile.plan_tier !== 'professional' && profile.ai_messages_used >= 20) {
    return NextResponse.json({ error: 'Quota exceeded' }, { status: 403 });
  }

  // ... hacer la acción
}
```

### Después (centralizado, consistente):
```javascript
// ✅ Código nuevo - USAR ESTO
import { verifyAccess, incrementUsage } from '@/lib/tierMiddleware';

export async function POST(request) {
  const userId = await getCurrentUserId();

  // Verificar acceso (feature + quota)
  const access = await verifyAccess(
    userId,
    'advanced_research',  // Feature requerida
    'research_reports'    // Quota a verificar
  );

  if (!access.allowed) {
    return NextResponse.json(
      {
        error: access.reason,
        message: access.message,
        upgrade_required: access.upgrade_required
      },
      { status: 403 }
    );
  }

  // ✅ Tiene acceso, procesar request
  const result = await performResearch(/* ... */);

  // Incrementar contador de uso
  await incrementUsage(userId, 'research_reports', 1);

  return NextResponse.json({ result });
}
```

---

## 2. Uso en Componentes de React

### Ejemplo: Dashboard con QuotaSummary

```javascript
// app/dashboard/page.js
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { QuotaSummary } from '@/app/components/QuotaDisplay';

export default function DashboardPage() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profile);
    }

    loadProfile();
  }, []);

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      {/* Muestra todas las quotas del usuario */}
      <QuotaSummary profile={profile} />

      {/* Resto del contenido */}
    </div>
  );
}
```

### Ejemplo: Bloquear Feature por Plan

```javascript
// app/dashboard/research/ResearchContent.js
import { hasFeature } from '@/lib/planLimits';
import { UpgradePrompt } from '@/app/components/UpgradePrompt';

export default function ResearchPage() {
  const [profile, setProfile] = useState(null);

  // ... cargar profile

  // Verificar si tiene acceso a investigación avanzada
  if (!hasFeature(profile?.plan_tier, 'advanced_research')) {
    return <UpgradePrompt requiredFeature="advanced_research" />;
  }

  // ✅ Tiene acceso, mostrar contenido
  return (
    <div>
      {/* Contenido de research */}
    </div>
  );
}
```

### Ejemplo: Mostrar Quota Individual

```javascript
import { QuotaDisplay } from '@/app/components/QuotaDisplay';

export default function AIChat({ profile }) {
  return (
    <div className="ai-chat">
      <div className="chat-header">
        <h2>Chat con IA</h2>

        {/* Mostrar quota de mensajes IA */}
        <QuotaDisplay profile={profile} action="ai_messages" compact />
      </div>

      {/* Chat interface */}
    </div>
  );
}
```

---

## 3. Verificar Before Realizar Acción

### Ejemplo: Crear Inquiry

```javascript
// app/api/inquiries/route.js
import { canPerformAction } from '@/lib/planLimits';
import { incrementUsage } from '@/lib/tierMiddleware';

export async function POST(request) {
  const userId = await getCurrentUserId();
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // Verificar si puede crear más inquiries
  if (!canPerformAction(profile, 'inquiries')) {
    return NextResponse.json(
      {
        error: 'QUOTA_EXCEEDED',
        message: 'Has alcanzado el límite de consultas de tu plan',
        current: profile.inquiries_used,
        limit: getPlanLimit(profile.plan_tier, 'inquiries')
      },
      { status: 403 }
    );
  }

  // Crear inquiry
  const inquiry = await createInquiry(/* ... */);

  // Incrementar contador
  await incrementUsage(userId, 'inquiries', 1);

  return NextResponse.json({ inquiry });
}
```

---

## 4. Comparar Planes (Pricing Page)

### Ejemplo: Mostrar Beneficios de Upgrade

```javascript
// app/pricing/page.js
import { comparePlans, PLAN_LIMITS, getPlanPrice } from '@/lib/planLimits';

export default function PricingPage({ currentPlan = 'free' }) {
  // Obtener diferencias entre plan actual y professional
  const { quotaImprovements, newFeatures } = comparePlans(currentPlan, 'professional');

  return (
    <div className="pricing">
      <h1>Actualizar a Profesional</h1>
      <p className="price">${getPlanPrice('professional').toLocaleString()} / mes</p>

      <div className="improvements">
        <h3>Mejoras de Quotas:</h3>
        <ul>
          {quotaImprovements.map(imp => (
            <li key={imp.name}>
              {imp.name}: {imp.from} → {imp.to === -1 ? 'Ilimitado' : imp.to}
              ({imp.improvement})
            </li>
          ))}
        </ul>

        <h3>Nuevas Features:</h3>
        <ul>
          {newFeatures.map(feature => (
            <li key={feature}>✓ {feature}</li>
          ))}
        </ul>
      </div>

      <button onClick={() => handleUpgrade()}>Actualizar Ahora</button>
    </div>
  );
}
```

---

## 5. CRON Job para Reset de Quotas

### Ejemplo: Vercel Cron (vercel.json)

```json
{
  "crons": [{
    "path": "/api/cron/reset-quotas",
    "schedule": "0 0 * * *"
  }]
}
```

### API Route:

```javascript
// app/api/cron/reset-quotas/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  // Verificar auth token de Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Llamar a función SQL que resetea quotas
    const { data, error } = await supabase.rpc('reset_all_monthly_quotas');

    if (error) throw error;

    console.log('✅ Quotas reseteadas para todos los usuarios');

    return NextResponse.json({ success: true, count: data });
  } catch (error) {
    console.error('❌ Error resetting quotas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Función SQL:

```sql
CREATE OR REPLACE FUNCTION reset_all_monthly_quotas()
RETURNS INTEGER AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE profiles
  SET
    ai_messages_used = 0,
    inquiries_used = 0,
    quota_reset_at = NOW()
  WHERE DATE_TRUNC('month', quota_reset_at) < DATE_TRUNC('month', NOW());

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Mostrar Alertas de Quota

### Ejemplo: Alert cuando está cerca del límite

```javascript
// app/components/QuotaAlert.js
import { isNearingQuotaLimit, getUsageInfo } from '@/lib/planLimits';
import { AlertCircle } from 'lucide-react';

export function QuotaAlert({ profile, action }) {
  const isNearing = isNearingQuotaLimit(profile, action);

  if (!isNearing) return null;

  const usage = getUsageInfo(profile, action);

  return (
    <div className="alert warning">
      <AlertCircle size={16} />
      <span>
        ⚠️ Quedan solo {usage.remaining} {action} este mes.
        <a href="/dashboard/settings">Actualizar plan</a>
      </span>
    </div>
  );
}
```

Uso:
```javascript
<QuotaAlert profile={profile} action="ai_messages" />
```

---

## 7. Feature Flags Dinámicos

### Ejemplo: Habilitar/Deshabilitar Features desde Admin

```javascript
// app/api/admin/toggle-feature/route.js
export async function POST(request) {
  const { userId, featureName, enabled } = await request.json();

  // Guardar override de feature en metadata del usuario
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  const metadata = profile.metadata || {};
  metadata.feature_overrides = metadata.feature_overrides || {};
  metadata.feature_overrides[featureName] = enabled;

  await supabase
    .from('profiles')
    .update({ metadata })
    .eq('id', userId);

  return NextResponse.json({ success: true });
}
```

Verificar feature con override:
```javascript
function hasFeatureWithOverride(profile, featureName) {
  // Primero verificar si hay override
  if (profile.metadata?.feature_overrides?.[featureName] !== undefined) {
    return profile.metadata.feature_overrides[featureName];
  }

  // Si no, usar lógica normal de plan
  return hasFeature(profile.plan_tier, featureName);
}
```

---

## 8. Tracking de Uso para Analytics

### Ejemplo: Guardar histórico de uso

```javascript
// app/api/track-usage/route.js
export async function POST(request) {
  const { userId, action, metadata } = await request.json();

  // Incrementar quota
  await incrementUsage(userId, action, 1);

  // Guardar en tabla de analytics (opcional)
  await supabase.from('usage_logs').insert({
    user_id: userId,
    action: action,
    metadata: metadata,
    created_at: new Date()
  });

  return NextResponse.json({ success: true });
}
```

Dashboard de analytics:
```javascript
// Obtener uso del último mes
const { data: usageLogs } = await supabase
  .from('usage_logs')
  .select('*')
  .eq('user_id', userId)
  .gte('created_at', startOfMonth())
  .lte('created_at', endOfMonth());

// Agrupar por acción
const usageByAction = usageLogs.reduce((acc, log) => {
  acc[log.action] = (acc[log.action] || 0) + 1;
  return acc;
}, {});

console.log('Uso del mes:', usageByAction);
```

---

## 🎯 Checklist de Implementación

### Fase 1 (Ahora):
- [ ] Ejecutar migración SQL (`supabase/migrations/20260208_phase1_cleanup.sql`)
- [ ] Reemplazar imports de `isTrialExpired` por versión actualizada
- [ ] Agregar `QuotaSummary` al dashboard
- [ ] Reemplazar verificaciones hardcodeadas por `verifyAccess`

### Fase 2 (Esta semana):
- [ ] Implementar suscripciones de MercadoPago (ver `MERCADOPAGO_SUBSCRIPTIONS.md`)
- [ ] Crear CRON job para reset mensual de quotas
- [ ] Testing completo

### Fase 3 (Futuro):
- [ ] Tabla de `usage_logs` para analytics
- [ ] Admin panel para gestionar planes
- [ ] Feature flags dinámicos
