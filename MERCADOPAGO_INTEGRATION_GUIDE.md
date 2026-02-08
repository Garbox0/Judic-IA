# 💳 MercadoPago Suscripciones - Guía de Integración

## 📋 Resumen

Sistema completo de suscripciones recurrentes integrado con MercadoPago, actualizado para el nuevo tier system con quotas mensuales, grace periods y manejo automático de renovaciones.

---

## 🎯 Características Implementadas

✅ **Suscripciones Recurrentes**
- Plan Profesional: $25.000 ARS/mes
- Renovación automática vía MercadoPago
- Webhooks con validación HMAC-SHA256

✅ **Sistema de Cuotas Actualizado**
- Integración con nuevo tier system (trial/free/professional/enterprise)
- Reseteo automático mensual
- Límites por tier: AI messages, inquiries, research reports

✅ **Grace Periods**
- 7 días de gracia para pagos fallidos
- Mantiene acceso profesional durante gracia
- Downgrade automático al vencimiento

✅ **CRON Jobs**
- Verificación diaria de expiraciones (02:00 AM)
- Reseteo mensual de cuotas (03:00 AM, día 1)

---

## 📁 Estructura de Archivos

### API Endpoints

```
app/api/mp/
├── subscription/
│   ├── create/route.js      # Crear checkout de suscripción
│   ├── sync/route.js         # Sincronización manual (fallback)
│   └── cancel/route.js       # Cancelar suscripción
├── plan/create/route.js      # Crear plan en MP (admin)
└── webhook/route.js          # Webhook de notificaciones MP

app/api/cron/
├── check-expiry/route.js     # Verificar expiraciones y grace periods
└── reset-quotas/route.js     # Resetear cuotas mensuales
```

### UI Components

```
app/dashboard/settings/SettingsContent.js  # Billing tab con UI de suscripción
```

---

## 🔐 Variables de Entorno Requeridas

```bash
# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxx-xxxxxx
MP_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx
MP_PREAPPROVAL_PLAN_ID=xxxxxxxxxxxxx

# Vercel CRON
CRON_SECRET=xxxxxxxxxxxxx  # Auto-generado por Vercel

# Supabase (ya existentes)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# Email (ya existente)
RESEND_API_KEY=re_xxxxx
```

---

## 🚀 Flujo de Suscripción

### 1. Usuario Inicia Suscripción

```javascript
// Frontend: app/dashboard/settings/SettingsContent.js
const response = await fetch('/api/mp/subscription/create', {
    method: 'POST',
    body: JSON.stringify({ userId: user.id })
});

const { init_point } = await response.json();
window.open(init_point, '_blank');  // Abre MercadoPago
```

### 2. MercadoPago Procesa Pago

- Usuario completa pago en ventana de MP
- MP crea preapproval (suscripción recurrente)
- MP envía webhook a `/api/mp/webhook`

### 3. Webhook Actualiza Usuario

```javascript
// Backend: app/api/mp/webhook/route.js
// Valida HMAC signature
// Consulta estado real a MP API
// Actualiza profile en Supabase:
{
  plan_tier: 'professional',
  subscription_status: 'active',
  subscription_expiry: now + 30 días,
  ai_messages_used: 0,
  inquiries_used: 0,
  research_reports_used: 0,
  quota_reset_at: now,
  grace_period_ends_at: null
}
```

### 4. Usuario Recibe Email de Confirmación

- Email transaccional vía Resend
- Se crea factura pendiente en tabla `invoices`

---

## ⚡ Estados de Suscripción

### MercadoPago Status → Judic-IA Mapping

| MP Status | subscription_status | plan_tier | Acción |
|-----------|-------------------|-----------|---------|
| `authorized` | `active` | `professional` | Acceso completo |
| `cancelled` | `cancelled` | `professional` → `free` | Mantiene hasta expiry |
| `paused` | `cancelled` | `professional` → `free` | Mantiene hasta expiry |
| `payment_required` | `past_due` | `professional` | Grace period 7 días |
| `pending` | `past_due` | `professional` | Grace period 7 días |

---

## 🔄 CRON Jobs

### 1. Check Expiry (Diario 02:00 AM)

**Endpoint:** `/api/cron/check-expiry`

**Función:**
- Verifica suscripciones profesionales expiradas
- Consulta estado real a MP API
- Renueva si MP está `authorized`
- Downgrade a `free` si cancelado/pausado
- Downgrade si grace period venció

```sql
-- Query usado
SELECT * FROM profiles
WHERE (plan_tier = 'professional' AND subscription_expiry < NOW())
   OR (subscription_status = 'past_due' AND grace_period_ends_at < NOW())
```

### 2. Reset Quotas (Mensual: Día 1, 03:00 AM)

**Endpoint:** `/api/cron/reset-quotas`

**Función:**
- Resetea cuotas de TODOS los usuarios cada 30 días
- Usa función SQL `reset_user_quotas(user_id)`
- Atómico y seguro con RLS bypass

```sql
-- Función SQL (ya creada en migration)
CREATE FUNCTION reset_user_quotas(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    ai_messages_used = 0,
    inquiries_used = 0,
    research_reports_used = 0,
    quota_reset_at = NOW()
  WHERE id = p_user_id
    AND (quota_reset_at IS NULL OR quota_reset_at < NOW() - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🛡️ Seguridad

### Webhook Signature Validation (HMAC-SHA256)

```javascript
// Validación automática en webhook
const manifest = `id:${data.id};request-id:${x-request-id};ts:${timestamp};`;
const calculatedSignature = crypto.createHmac('sha256', MP_WEBHOOK_SECRET)
                                  .update(manifest)
                                  .digest('hex');

if (signature !== calculatedSignature) {
  return 401 Unauthorized;
}
```

**⚠️ Importante:**
- Configura `MP_WEBHOOK_SECRET` en variables de entorno
- MP requiere webhook URL pública (no localhost)
- Usa ngrok para testing local

### CRON Endpoint Security

```javascript
// Authorization header requerido
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return 401 Unauthorized;
}
```

---

## 🧪 Testing Local

### 1. Configurar Ngrok

```bash
ngrok http 3000
# Copia URL: https://xxxx.ngrok.io
```

### 2. Configurar Webhook en MercadoPago

1. Ve a: https://www.mercadopago.com.ar/developers/panel
2. Aplicación → Webhooks
3. URL: `https://xxxx.ngrok.io/api/mp/webhook`
4. Eventos: `preapproval`

### 3. Crear Plan de Suscripción (Solo una vez)

```bash
curl -X POST http://localhost:3000/api/mp/plan/create \
  -H "Content-Type: application/json"

# Guarda el "id" retornado en MP_PREAPPROVAL_PLAN_ID
```

### 4. Probar Flujo Completo

1. Ir a `/dashboard/settings?tab=billing`
2. Click "Suscribirse al Plan Profesional"
3. Completar pago en sandbox de MP
4. Verificar webhook en ngrok dashboard
5. Verificar actualización en Supabase

---

## 📊 Verificación en Base de Datos

### Queries Útiles

```sql
-- Ver estado de suscripciones activas
SELECT
  id,
  full_name,
  plan_tier,
  subscription_status,
  subscription_expiry,
  mp_subscription_status,
  grace_period_ends_at
FROM profiles
WHERE plan_tier = 'professional';

-- Ver cuotas usadas
SELECT
  id,
  full_name,
  ai_messages_used,
  inquiries_used,
  research_reports_used,
  quota_reset_at
FROM profiles
WHERE plan_tier = 'professional';

-- Ver facturas pendientes
SELECT * FROM invoices
WHERE status = 'pending'
ORDER BY payment_date DESC;
```

---

## 🐛 Troubleshooting

### Problema: Webhook no se recibe

**Solución:**
1. Verifica URL pública accesible
2. Revisa logs de MP Developer Panel
3. Verifica signature validation no falle
4. Usa endpoint de sincronización manual: `/api/mp/subscription/sync`

### Problema: Usuario no upgradeado después de pagar

**Solución:**
1. Revisa logs del webhook en Vercel/Railway
2. Ejecuta sync manual:
```bash
curl -X POST /api/mp/subscription/sync \
  -H "Content-Type: application/json" \
  -d '{"userId": "xxx", "preapproval_id": "yyy"}'
```

### Problema: Grace period no funciona

**Solución:**
- Verifica que el CRON `check-expiry` corre correctamente
- Revisa logs en Vercel → Functions → Cron Jobs
- Ejecuta manualmente: `GET /api/cron/check-expiry` con header `Authorization: Bearer CRON_SECRET`

---

## 📈 Monitoring

### Métricas Clave

```sql
-- Conversión trial → professional (últimos 30 días)
SELECT COUNT(*) FROM profiles
WHERE plan_tier = 'professional'
  AND subscription_started_at > NOW() - INTERVAL '30 days';

-- Churn rate (cancelaciones)
SELECT COUNT(*) FROM profiles
WHERE subscription_status = 'cancelled'
  AND subscription_expiry > NOW();

-- Revenue mensual estimado
SELECT COUNT(*) * 25000 as revenue_ars
FROM profiles
WHERE plan_tier = 'professional'
  AND subscription_status = 'active';
```

---

## 🔄 Migración de Usuarios Existentes

Si ya tienes usuarios con plan "starter" pagando:

```sql
-- Identificar usuarios a migrar
SELECT * FROM profiles
WHERE plan_tier = 'starter'
  AND subscription_status = 'active'
  AND mp_preapproval_id IS NOT NULL;

-- Migrarlos a professional
UPDATE profiles
SET
  plan_tier = 'professional',
  ai_messages_used = 0,
  inquiries_used = 0,
  research_reports_used = 0,
  quota_reset_at = NOW()
WHERE plan_tier = 'starter'
  AND subscription_status = 'active';
```

---

## 📝 Checklist de Deploy

- [ ] Variables de entorno configuradas en producción
- [ ] `vercel.json` con CRON jobs committeado
- [ ] Plan creado en MercadoPago producción
- [ ] Webhook URL configurado en MP Dashboard
- [ ] MP_WEBHOOK_SECRET configurado
- [ ] CRON_SECRET generado por Vercel
- [ ] Testing de flujo completo en producción
- [ ] Email de confirmación funciona
- [ ] Facturas se generan correctamente
- [ ] Grace periods funcionan
- [ ] Cancelación funciona

---

## 🎓 Próximos Pasos (Fase 3 - Opcional)

- [ ] Admin dashboard para ver suscripciones activas
- [ ] Métricas de conversión trial → professional
- [ ] Emails de recordatorio antes de expiración
- [ ] Integración con AFIP para facturación electrónica
- [ ] Planes Enterprise personalizados (B2B)
- [ ] Descuentos por pago anual
- [ ] Códigos de cupón promocionales

---

## 📞 Soporte

Para issues con MercadoPago:
- Documentación: https://www.mercadopago.com.ar/developers/es/docs
- Soporte: https://www.mercadopago.com.ar/ayuda

Para issues con el sistema:
- Ver logs en Vercel Dashboard
- Revisar tabla `profiles` en Supabase
- Ejecutar sync manual si webhook falla
