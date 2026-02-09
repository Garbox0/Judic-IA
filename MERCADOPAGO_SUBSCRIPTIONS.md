# 💳 MercadoPago: Suscripciones Recurrentes Reales

## Problema Actual

Según el handoff, actualmente solo manejan **pagos únicos de 30 días**, no suscripciones recurrentes automáticas. Esto significa:

❌ El usuario debe pagar manualmente cada mes
❌ No hay renovación automática
❌ Más churn (usuarios que olvidan pagar y se van)
❌ Más trabajo de soporte (recordatorios, reactivaciones)

---

## Solución: Preapproval API (Suscripciones)

MercadoPago tiene una API específica para suscripciones recurrentes llamada **Preapproval**.

### Diferencias Clave

| Característica | Payment (Actual) | Preapproval (Recomendado) |
|----------------|------------------|---------------------------|
| **Tipo** | Pago único | Suscripción recurrente |
| **Renovación** | Manual | Automática |
| **Cobro** | Una vez | Mensual/Anual |
| **Cancelación** | No aplica | Usuario puede cancelar |
| **Webhooks** | `payment` | `preapproval` |
| **ID** | `payment_id` | `preapproval_id` |

---

## 🏗️ Implementación de Suscripciones Reales

### Paso 1: Crear Plan de Suscripción en MercadoPago

Primero debes crear un **Preapproval Plan** (lo hacés una vez):

```javascript
// lib/mercadopago/plans.js
import { MercadoPagoConfig, PreApprovalPlan } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

const preApprovalPlan = new PreApprovalPlan(client);

// Crear plan para tier Professional
export async function createProfessionalPlan() {
  const plan = await preApprovalPlan.create({
    body: {
      reason: "Suscripción Mensual - Judic-IA Suite Pro",
      auto_recurring: {
        frequency: 1, // Cada cuánto cobrar
        frequency_type: "months", // "days", "months"
        transaction_amount: 25000, // ARS
        currency_id: "ARS",
        free_trial: {
          frequency: 14,
          frequency_type: "days"
        }
      },
      back_url: "https://judic-ia.com/dashboard",
      payment_methods_allowed: {
        payment_types: [
          { id: "credit_card" },
          { id: "debit_card" }
        ],
        payment_methods: []
      }
    }
  });

  console.log('Plan creado:', plan);
  // Guardar plan.id en tu DB o .env
  // Ej: MERCADOPAGO_PLAN_PROFESSIONAL=abc123
  return plan;
}

// Crear plan anual (con descuento)
export async function createProfessionalAnnualPlan() {
  const plan = await preApprovalPlan.create({
    body: {
      reason: "Suscripción Anual - Judic-IA Suite Pro (2 meses gratis)",
      auto_recurring: {
        frequency: 12,
        frequency_type: "months",
        transaction_amount: 250000, // 10 meses de precio
        currency_id: "ARS",
        free_trial: {
          frequency: 14,
          frequency_type: "days"
        }
      },
      back_url: "https://judic-ia.com/dashboard",
      payment_methods_allowed: {
        payment_types: [
          { id: "credit_card" },
          { id: "debit_card" }
        ]
      }
    }
  });

  return plan;
}
```

**Ejecutar una vez para crear los planes:**
```bash
node scripts/create-mp-plans.js
```

---

### Paso 2: Crear Suscripción para Usuario

Cuando el usuario hace click en "Suscribirse":

```javascript
// app/api/subscriptions/create/route.js
import { NextResponse } from 'next/server';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { supabase } from '@/lib/supabase';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

const preApproval = new PreApproval(client);

export async function POST(request) {
  try {
    const { userId, planType } = await request.json(); // 'monthly' o 'annual'

    // Obtener usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name, mp_customer_id')
      .eq('id', userId)
      .single();

    // Seleccionar plan según tipo
    const planId = planType === 'annual'
      ? process.env.MERCADOPAGO_PLAN_PROFESSIONAL_ANNUAL
      : process.env.MERCADOPAGO_PLAN_PROFESSIONAL;

    // Crear suscripción
    const subscription = await preApproval.create({
      body: {
        preapproval_plan_id: planId,
        reason: planType === 'annual'
          ? "Suscripción Anual - Judic-IA Suite Pro"
          : "Suscripción Mensual - Judic-IA Suite Pro",
        external_reference: userId, // TU ID interno
        payer_email: profile.email,
        card_token_id: null, // El usuario ingresa tarjeta en checkout
        auto_recurring: {
          start_date: new Date().toISOString(),
          end_date: null, // Sin fecha de fin (hasta que cancele)
          transaction_amount: planType === 'annual' ? 250000 : 25000,
          currency_id: "ARS"
        },
        back_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscription=success`,
        status: "pending" // Cambiará a 'authorized' tras pago exitoso
      }
    });

    // Guardar en DB (temporal, hasta que webhook confirme)
    await supabase.from('profiles').update({
      mp_preapproval_id: subscription.id,
      mp_subscription_status: 'pending'
    }).eq('id', userId);

    // Retornar URL de checkout
    return NextResponse.json({
      subscription_id: subscription.id,
      init_point: subscription.init_point // URL donde el usuario paga
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

### Paso 3: Webhook para Procesar Eventos

MercadoPago enviará notificaciones cuando:
- ✅ Suscripción es autorizada (primer pago exitoso)
- 💳 Cobro mensual exitoso
- ❌ Cobro mensual fallido
- 🚫 Usuario cancela suscripción

```javascript
// app/api/webhooks/mercadopago/route.js
import { NextResponse } from 'next/server';
import { MercadoPagoConfig, PreApproval, Payment } from 'mercadopago';
import { supabaseAdmin } from '@/lib/supabase-admin';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('🔔 Webhook recibido:', body);

    // MercadoPago envía diferentes tipos de notificaciones
    const { type, data } = body;

    // --- SUSCRIPCIONES ---
    if (type === 'preapproval') {
      await handlePreapprovalEvent(data.id);
    }

    // --- PAGOS RECURRENTES ---
    if (type === 'payment') {
      await handlePaymentEvent(data.id);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Procesar evento de suscripción
async function handlePreapprovalEvent(preapprovalId) {
  const preApproval = new PreApproval(client);
  const subscription = await preApproval.get({ id: preapprovalId });

  console.log('📋 Preapproval status:', subscription.status);

  const userId = subscription.external_reference; // El user_id que guardamos

  switch (subscription.status) {
    case 'authorized':
      // ✅ Suscripción activa (primer pago exitoso)
      await supabaseAdmin.from('profiles').update({
        plan_tier: 'professional',
        subscription_status: 'active',
        mp_subscription_status: 'authorized',
        mp_preapproval_id: preapprovalId,
        subscription_started_at: new Date(),
        subscription_expiry: null // Ya no necesitamos fecha de expiry con suscripciones
      }).eq('id', userId);

      // Registrar evento en historial
      await supabaseAdmin.from('subscription_history').insert({
        user_id: userId,
        event_type: 'upgraded',
        to_plan_id: (await supabaseAdmin.from('subscription_plans').select('id').eq('slug', 'professional').single()).data.id,
        reason: 'MercadoPago preapproval authorized'
      });

      console.log('✅ Usuario activado como Professional:', userId);
      break;

    case 'paused':
      // ⏸️ Suscripción pausada (por el usuario)
      await supabaseAdmin.from('profiles').update({
        subscription_status: 'inactive',
        mp_subscription_status: 'paused'
      }).eq('id', userId);
      break;

    case 'cancelled':
      // 🚫 Suscripción cancelada
      await supabaseAdmin.from('profiles').update({
        plan_tier: 'free', // Downgrade a free
        subscription_status: 'cancelled',
        mp_subscription_status: 'cancelled'
      }).eq('id', userId);

      await supabaseAdmin.from('subscription_history').insert({
        user_id: userId,
        event_type: 'downgraded',
        to_plan_id: (await supabaseAdmin.from('subscription_plans').select('id').eq('slug', 'free').single()).data.id,
        reason: 'User cancelled subscription'
      });

      console.log('🚫 Suscripción cancelada:', userId);
      break;

    default:
      console.log('⚠️ Preapproval status desconocido:', subscription.status);
  }
}

// Procesar evento de pago recurrente
async function handlePaymentEvent(paymentId) {
  const payment = new Payment(client);
  const paymentData = await payment.get({ id: paymentId });

  console.log('💳 Payment status:', paymentData.status);

  // Solo procesar si es parte de una suscripción
  if (!paymentData.preapproval_id) {
    console.log('⏭️ Payment no es de suscripción, ignorando');
    return;
  }

  const userId = paymentData.external_reference;

  switch (paymentData.status) {
    case 'approved':
      // ✅ Cobro mensual exitoso
      console.log('✅ Cobro recurrente exitoso:', userId);

      // Crear factura
      await supabaseAdmin.from('invoices').insert({
        user_id: userId,
        status: 'issued',
        amount: paymentData.transaction_amount,
        description: `Renovación mensual - ${new Date().toLocaleDateString()}`,
        payment_date: new Date(),
        invoice_date: new Date(),
        // ... otros campos de facturación si tenés AFIP integrado
      });

      // Actualizar última fecha de pago
      await supabaseAdmin.from('profiles').update({
        subscription_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 días
      }).eq('id', userId);

      break;

    case 'rejected':
    case 'cancelled':
      // ❌ Cobro fallido (tarjeta sin fondos, vencida, etc.)
      console.error('❌ Cobro recurrente fallido:', userId);

      await supabaseAdmin.from('profiles').update({
        subscription_status: 'past_due', // Estado "pago vencido"
        mp_subscription_status: 'past_due'
      }).eq('id', userId);

      // TODO: Enviar email notificando del problema
      // TODO: Dar gracia period de 7 días antes de suspender cuenta

      break;

    default:
      console.log('⚠️ Payment status desconocido:', paymentData.status);
  }
}
```

---

### Paso 4: Frontend (Botón de Suscripción)

```javascript
// app/dashboard/settings/SubscriptionSection.js
'use client';

import { useState } from 'react';

export default function SubscriptionSection({ profile }) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (planType) => {
    setLoading(true);

    try {
      const res = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          planType: planType // 'monthly' o 'annual'
        })
      });

      const data = await res.json();

      // Redirigir a checkout de MercadoPago
      window.location.href = data.init_point;

    } catch (error) {
      console.error('Error al crear suscripción:', error);
      alert('Error al procesar la suscripción');
    } finally {
      setLoading(false);
    }
  };

  // Si ya tiene suscripción activa
  if (profile.subscription_status === 'active') {
    return (
      <div className="subscription-active">
        <h3>✅ Suscripción Activa</h3>
        <p>Plan: Professional</p>
        <p>Estado: {profile.mp_subscription_status}</p>

        <button
          onClick={() => handleCancelSubscription()}
          className="btn-cancel"
        >
          Cancelar Suscripción
        </button>
      </div>
    );
  }

  // Si no tiene suscripción
  return (
    <div className="subscription-plans">
      <h3>Elegí tu plan</h3>

      <div className="plans-grid">
        <div className="plan-card">
          <h4>Plan Mensual</h4>
          <p className="price">$25.000/mes</p>
          <ul>
            <li>✅ 1000 mensajes IA/mes</li>
            <li>✅ 100 consultas/mes</li>
            <li>✅ 50 reportes de investigación</li>
            <li>✅ Soporte prioritario</li>
          </ul>
          <button
            onClick={() => handleSubscribe('monthly')}
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Suscribirse Mensualmente'}
          </button>
        </div>

        <div className="plan-card featured">
          <div className="badge">🔥 Más Popular</div>
          <h4>Plan Anual</h4>
          <p className="price">$250.000/año</p>
          <p className="savings">Ahorrás $50.000 (2 meses gratis)</p>
          <ul>
            <li>✅ Todo lo del plan mensual</li>
            <li>✅ 2 meses gratis</li>
            <li>✅ Sin aumento por 12 meses</li>
          </ul>
          <button
            onClick={() => handleSubscribe('annual')}
            disabled={loading}
            className="btn-featured"
          >
            {loading ? 'Procesando...' : 'Suscribirse Anualmente'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Paso 5: Cancelación de Suscripción

```javascript
// app/api/subscriptions/cancel/route.js
import { NextResponse } from 'next/server';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { supabaseAdmin } from '@/lib/supabase-admin';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

export async function POST(request) {
  try {
    const { userId } = await request.json();

    // Obtener preapproval_id del usuario
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('mp_preapproval_id')
      .eq('id', userId)
      .single();

    if (!profile.mp_preapproval_id) {
      return NextResponse.json(
        { error: 'No hay suscripción activa' },
        { status: 400 }
      );
    }

    // Cancelar en MercadoPago
    const preApproval = new PreApproval(client);
    await preApproval.update({
      id: profile.mp_preapproval_id,
      body: {
        status: 'cancelled'
      }
    });

    // Actualizar en DB (el webhook se encargará del downgrade)
    await supabaseAdmin.from('profiles').update({
      mp_subscription_status: 'cancelled'
    }).eq('id', userId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 🎯 Manejo de Cobros Fallidos

Cuando un cobro mensual falla (tarjeta sin fondos, vencida, etc.):

### Estrategia de Gracia Period

```javascript
// lib/subscription/gracePeriod.js
export const GRACE_PERIOD_DAYS = 7;

export async function handleFailedPayment(userId) {
  const gracePeriodEnd = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  // Marcar cuenta como "past_due" pero mantener acceso
  await supabaseAdmin.from('profiles').update({
    subscription_status: 'past_due',
    grace_period_ends_at: gracePeriodEnd
  }).eq('id', userId);

  // Enviar email notificando
  await sendEmail({
    to: userEmail,
    subject: 'Problema con tu suscripción - Judic-IA',
    template: 'payment-failed',
    data: {
      userName: userName,
      gracePeriodEnd: gracePeriodEnd,
      updatePaymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?update_payment=true`
    }
  });
}

// CRON job diario para verificar cuentas vencidas
export async function checkExpiredGracePeriods() {
  const { data: expiredUsers } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name')
    .eq('subscription_status', 'past_due')
    .lt('grace_period_ends_at', new Date());

  for (const user of expiredUsers) {
    // Downgrade a free
    await supabaseAdmin.from('profiles').update({
      plan_tier: 'free',
      subscription_status: 'cancelled'
    }).eq('id', user.id);

    // Enviar email final
    await sendEmail({
      to: user.email,
      subject: 'Tu suscripción ha sido suspendida - Judic-IA',
      template: 'subscription-suspended'
    });
  }
}
```

---

## 📊 Dashboard de Métricas

Con suscripciones reales, podés trackear:

```javascript
// app/api/admin/metrics/route.js
export async function GET() {
  // MRR (Monthly Recurring Revenue)
  const { data: activeSubscriptions } = await supabaseAdmin
    .from('profiles')
    .select('plan_tier')
    .eq('subscription_status', 'active');

  const mrr = activeSubscriptions.reduce((total, sub) => {
    return total + (sub.plan_tier === 'professional' ? 25000 : 0);
  }, 0);

  // Churn Rate (usuarios que cancelaron este mes)
  const { data: churned } = await supabaseAdmin
    .from('subscription_history')
    .select('user_id')
    .eq('event_type', 'downgraded')
    .gte('created_at', startOfMonth());

  const churnRate = (churned.length / activeSubscriptions.length) * 100;

  return NextResponse.json({
    mrr: mrr,
    active_subscriptions: activeSubscriptions.length,
    churn_rate: churnRate,
    // ... más métricas
  });
}
```

---

## ✅ Checklist de Implementación

- [ ] Crear Preapproval Plans en MercadoPago (mensual + anual)
- [ ] Guardar plan IDs en `.env`
- [ ] Crear endpoint `/api/subscriptions/create`
- [ ] Crear endpoint `/api/subscriptions/cancel`
- [ ] Actualizar webhook para manejar `preapproval` y `payment` events
- [ ] Agregar campos a DB: `mp_preapproval_id`, `grace_period_ends_at`
- [ ] Implementar lógica de gracia period (7 días)
- [ ] CRON job para verificar suscripciones expiradas
- [ ] Frontend: botones de suscripción mensual/anual
- [ ] Frontend: botón de cancelación
- [ ] Email templates (pago fallido, cancelación, suspensión)
- [ ] Testing en sandbox de MercadoPago
- [ ] Migrar usuarios actuales a suscripciones reales
- [ ] Monitoreo de webhooks (logs, alertas)

---

## 🔒 Seguridad

### Verificar Webhooks de MercadoPago

```javascript
// lib/mercadopago/verifyWebhook.js
import crypto from 'crypto';

export function verifyMercadoPagoSignature(request, body) {
  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');

  if (!xSignature || !xRequestId) {
    throw new Error('Missing MercadoPago signature headers');
  }

  // Extraer ts y hash de x-signature
  // Formato: "ts=1234567890,v1=hash_aqui"
  const parts = {};
  xSignature.split(',').forEach(part => {
    const [key, value] = part.split('=');
    parts[key] = value;
  });

  const ts = parts.ts;
  const hash = parts.v1;

  // Construir string a verificar
  const manifest = `id:${body.data.id};request-id:${xRequestId};ts:${ts};`;

  // Calcular HMAC
  const hmac = crypto.createHmac('sha256', process.env.MERCADOPAGO_WEBHOOK_SECRET);
  hmac.update(manifest);
  const calculatedHash = hmac.digest('hex');

  if (calculatedHash !== hash) {
    throw new Error('Invalid MercadoPago signature');
  }

  return true;
}
```

**Uso en webhook:**
```javascript
export async function POST(request) {
  const body = await request.json();

  // Verificar firma
  try {
    verifyMercadoPagoSignature(request, body);
  } catch (error) {
    console.error('❌ Webhook verification failed:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Procesar evento...
}
```

---

## 📚 Recursos

- [MercadoPago Preapproval Docs](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-configuration/subscription-creation)
- [MercadoPago SDK Node.js](https://github.com/mercadopago/sdk-nodejs)
- [Webhook Security](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks)
