# 🚀 Guía de Instalación - Sistema de Tiers Mejorado

## 📋 Archivos Creados

```
✅ supabase/migrations/20260208_phase1_cleanup.sql  # Migración SQL
✅ lib/planLimits.js                                # Configuración de límites
✅ lib/tierMiddleware.js                            # Middleware de verificación
✅ app/components/QuotaDisplay.js                   # Componente de quotas
✅ app/components/QuotaDisplay.css                  # Estilos
✅ app/lib/subscription.js (actualizado)            # Funciones de trial
✅ USAGE_EXAMPLES.md                                # Ejemplos de uso
✅ TIER_IMPROVEMENTS_INCREMENTAL.md                 # Doc de mejoras
✅ TIER_IMPROVEMENTS_COMPLETE.md                    # Doc de refactorización
✅ MERCADOPAGO_SUBSCRIPTIONS.md                     # Doc de MP
✅ TIER_SPECIFIC_RECOMMENDATIONS.md                 # Recomendaciones
```

---

## ⚡ Instalación Rápida (Paso a Paso)

### PASO 1: Backup de Base de Datos (Importante!)

Antes de ejecutar migraciones, hacé un backup:

```bash
# Si usás Supabase CLI:
supabase db dump > backup_$(date +%Y%m%d).sql

# O desde el dashboard de Supabase:
# Settings → Database → Backups → Create Manual Backup
```

---

### PASO 2: Ejecutar Migración SQL

**Opción A: Desde Supabase Dashboard (Recomendado)**

1. Andá a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. SQL Editor → New Query
3. Copiá el contenido de `supabase/migrations/20260208_phase1_cleanup.sql`
4. Pegalo en el editor
5. Click en "Run" (o Ctrl+Enter)
6. Verificá que no haya errores en el output

**Opción B: Desde Supabase CLI**

```bash
# Si tenés Supabase CLI instalado
supabase db push
```

---

### PASO 3: Verificar Migración

Ejecutá estos queries para verificar que todo se migró correctamente:

```sql
-- 1. Verificar que el campo quota_reset_at existe
SELECT quota_reset_at FROM profiles LIMIT 1;

-- 2. Verificar que trial_ends_at existe (renombrado de demo_expires_at)
SELECT trial_ends_at FROM profiles LIMIT 1;

-- 3. Verificar que los tiers se actualizaron
SELECT plan_tier, COUNT(*) as count
FROM profiles
GROUP BY plan_tier;
-- Deberías ver: trial, free, professional (NO más 'starter')

-- 4. Verificar que las funciones SQL existen
SELECT proname FROM pg_proc WHERE proname IN ('reset_user_quotas', 'increment_quota');
-- Deberías ver ambas funciones

-- 5. Verificar índices creados
SELECT indexname FROM pg_indexes WHERE tablename = 'profiles';
-- Deberías ver: idx_profiles_plan_tier, idx_profiles_subscription_status, etc.
```

**Resultados esperados:**
- ✅ No hay errores
- ✅ Campos nuevos existen
- ✅ Tiers actualizados (no más "starter")
- ✅ Funciones SQL creadas
- ✅ Índices creados

---

### PASO 4: Actualizar Código Existente

#### 4.1 Actualizar ResearchContent.js

Busca este import:
```javascript
import { isTrialExpired } from '../../lib/subscription';
```

Cambialo por:
```javascript
import { isTrialExpired } from '@/app/lib/subscription';
```

#### 4.2 Actualizar Otros Archivos

Buscá todos los archivos que usan `isTrialExpired`:

```bash
# Windows:
findstr /s /i "isTrialExpired" app\**\*.js

# Mac/Linux:
grep -r "isTrialExpired" app/
```

Y actualizá los imports para usar la versión actualizada.

#### 4.3 Agregar QuotaSummary al Dashboard

En `app/dashboard/page.js` (o donde esté tu dashboard principal):

```javascript
import { QuotaSummary } from '@/app/components/QuotaDisplay';

export default function DashboardPage() {
  const [profile, setProfile] = useState(null);

  // ... código existente para cargar profile

  return (
    <div className="dashboard">
      {/* Agregar esto al inicio del dashboard */}
      <QuotaSummary profile={profile} />

      {/* Resto del contenido */}
    </div>
  );
}
```

---

### PASO 5: Actualizar API Routes

**Antes:**
```javascript
// ❌ Código viejo
export async function POST(request) {
  const userId = await getCurrentUserId();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profile.plan_tier !== 'professional' && profile.ai_messages_used >= 20) {
    return NextResponse.json({ error: 'Quota exceeded' }, { status: 403 });
  }

  // hacer algo...
}
```

**Después:**
```javascript
// ✅ Código nuevo
import { verifyAccess, incrementUsage } from '@/lib/tierMiddleware';

export async function POST(request) {
  const userId = await getCurrentUserId();

  // Verificar acceso
  const access = await verifyAccess(userId, 'advanced_research', 'research_reports');

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

  // Hacer algo...
  const result = await performAction();

  // Incrementar contador
  await incrementUsage(userId, 'research_reports', 1);

  return NextResponse.json({ result });
}
```

**Archivos a actualizar:**
- `app/api/research/route.js`
- `app/api/inquiries/route.js`
- Cualquier otro endpoint que verifique quotas

---

### PASO 6: Testing Local

#### 6.1 Test de Quotas

```javascript
// En la consola del navegador (DevTools):

// 1. Obtener tu perfil
const { data: profile } = await supabase.from('profiles').select('*').eq('id', 'tu-user-id').single();

// 2. Verificar plan_tier
console.log('Plan:', profile.plan_tier); // Debería ser 'trial', 'free', o 'professional'

// 3. Verificar quotas
console.log('IA Messages:', profile.ai_messages_used, '/', getPlanLimit(profile.plan_tier, 'ai_messages'));
console.log('Inquiries:', profile.inquiries_used, '/', getPlanLimit(profile.plan_tier, 'inquiries'));
```

#### 6.2 Test de Reset Mensual

```sql
-- En SQL Editor de Supabase, ejecutar:
SELECT reset_user_quotas('tu-user-id');

-- Luego verificar que las quotas se resetearon:
SELECT ai_messages_used, inquiries_used, quota_reset_at
FROM profiles
WHERE id = 'tu-user-id';
-- Deberías ver valores en 0 y quota_reset_at actualizado
```

#### 6.3 Test de Increment

```sql
-- Incrementar quota de AI messages
SELECT increment_quota('tu-user-id', 'ai_messages', 5);

-- Verificar que incrementó
SELECT ai_messages_used FROM profiles WHERE id = 'tu-user-id';
```

---

### PASO 7: Configurar CRON Job (Opcional)

#### Para Vercel:

1. Crear `vercel.json` en la raíz:

```json
{
  "crons": [{
    "path": "/api/cron/reset-quotas",
    "schedule": "0 0 1 * *"
  }]
}
```

2. Crear variable de entorno `CRON_SECRET`:

```bash
# En Vercel Dashboard → Settings → Environment Variables
CRON_SECRET=tu_secreto_aleatorio_aqui
```

3. Crear endpoint `app/api/cron/reset-quotas/route.js`:

```javascript
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('reset_all_monthly_quotas');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: data });
}
```

4. Agregar función SQL:

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

## ✅ Checklist Final

Antes de deployar a producción:

- [ ] ✅ Backup de base de datos creado
- [ ] ✅ Migración SQL ejecutada sin errores
- [ ] ✅ Queries de verificación pasaron
- [ ] ✅ Imports actualizados en todos los archivos
- [ ] ✅ QuotaSummary agregado al dashboard
- [ ] ✅ API routes actualizados con verifyAccess
- [ ] ✅ Testing local completado
- [ ] ✅ CRON job configurado (opcional)
- [ ] ✅ Variables de entorno correctas (.env)

---

## 🐛 Troubleshooting

### Problema 1: Error "column trial_ends_at does not exist"

**Solución:**
```sql
-- Verificar si el rename se ejecutó
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name IN ('demo_expires_at', 'trial_ends_at');

-- Si demo_expires_at todavía existe, ejecutar manualmente:
ALTER TABLE profiles RENAME COLUMN demo_expires_at TO trial_ends_at;
```

### Problema 2: Función reset_user_quotas no existe

**Solución:**
```sql
-- Re-crear la función manualmente
-- (copiar desde la migración SQL)
```

### Problema 3: isTrialExpired retorna valores incorrectos

**Solución:**
```javascript
// Verificar que estás usando el import correcto:
import { isTrialExpired } from '@/app/lib/subscription';

// NO:
import { isTrialExpired } from '../../lib/subscription';
```

### Problema 4: QuotaDisplay no se ve correctamente

**Solución:**
```javascript
// Verificar que el CSS está importado:
import './QuotaDisplay.css';

// Y que las variables CSS existen en globals.css:
// --glass-soft, --glass-border, --foreground, --muted, --primary
```

---

## 📚 Próximos Pasos

Después de completar esta instalación:

1. **Esta semana**: Implementar suscripciones de MercadoPago (ver `MERCADOPAGO_SUBSCRIPTIONS.md`)
2. **Próximo mes**: Considerar refactorización completa (ver `TIER_IMPROVEMENTS_COMPLETE.md`)
3. **Futuro**: Preparar para multi-organización (estudios jurídicos)

---

## 🆘 Soporte

Si tenés problemas:
1. Revisar `USAGE_EXAMPLES.md` para ejemplos
2. Revisar console logs del navegador
3. Revisar logs de Supabase SQL Editor
4. Preguntarme (Claude) en el chat

---

**¡Éxito con la implementación!** 🚀
