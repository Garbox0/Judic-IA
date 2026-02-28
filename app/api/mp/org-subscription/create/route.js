/**
 * POST /api/mp/org-subscription/create
 *
 * Inicia la suscripción mensual Enterprise para una organización.
 * Solo el owner puede ejecutarlo. Devuelve un init_point de MercadoPago.
 *
 * Body: { orgId }
 * Returns: { init_point, plan_tier }
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MercadoPagoConfig, PreApprovalPlan } from 'mercadopago';

// Plan IDs de MercadoPago por tier (crear en el dashboard de MP con los precios correctos)
const PLAN_ENV_KEYS = {
    enterprise_s:  'MP_PLAN_ORG_S_ID',
    enterprise_m:  'MP_PLAN_ORG_M_ID',
    enterprise_l:  'MP_PLAN_ORG_L_ID',
    enterprise_xl: 'MP_PLAN_ORG_XL_ID',
};

const PLAN_LABELS = {
    enterprise_s:  'Enterprise S — Hasta 5 miembros',
    enterprise_m:  'Enterprise M — Hasta 10 miembros',
    enterprise_l:  'Enterprise L — Hasta 20 miembros',
    enterprise_xl: 'Enterprise XL — Miembros ilimitados',
};

export async function POST(request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';

    try {
        // 1. Autenticación
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 2. Obtener orgId del body
        const body = await request.json().catch(() => null);
        const { orgId } = body || {};
        if (!orgId) return NextResponse.json({ error: 'Falta orgId' }, { status: 400 });

        // 3. Verificar que el usuario es owner de esa org verificada
        const { data: member } = await supabase
            .from('org_members')
            .select('role, org:org_id(id, plan_tier, verification_status, razon_social, subscription_status)')
            .eq('user_id', user.id)
            .eq('org_id', orgId)
            .single();

        if (!member || member.role !== 'owner') {
            return NextResponse.json({ error: 'Solo el titular puede gestionar la suscripción' }, { status: 403 });
        }

        const org = member.org;

        if (org?.verification_status !== 'verified') {
            return NextResponse.json({ error: 'El estudio no está verificado' }, { status: 403 });
        }

        if (org?.subscription_status === 'active') {
            return NextResponse.json({ error: 'La suscripción ya está activa' }, { status: 409 });
        }

        // 4. Obtener el plan ID de MP según el tier de la org
        const planTier = org.plan_tier || 'enterprise_s';
        const planEnvKey = PLAN_ENV_KEYS[planTier];
        if (!planEnvKey) {
            return NextResponse.json({ error: `Plan inválido: ${planTier}` }, { status: 400 });
        }

        const planId = process.env[planEnvKey];
        if (!planId) {
            console.error(`[org-subscription/create] Missing env var: ${planEnvKey}`);
            return NextResponse.json({ error: `Plan ${planTier} no configurado. Contactá al administrador.` }, { status: 503 });
        }

        // 5. Construir la URL de checkout de MercadoPago
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        const client = new MercadoPagoConfig({ accessToken });
        const preApprovalPlan = new PreApprovalPlan(client);
        const plan = await preApprovalPlan.get({ preApprovalPlanId: planId });

        if (!plan?.init_point) {
            return NextResponse.json({ error: 'No se pudo obtener el link de pago' }, { status: 500 });
        }

        // external_reference = 'org_sub:{orgId}' para distinguirlo de suscripciones individuales
        const checkoutUrl = new URL(plan.init_point);
        checkoutUrl.searchParams.set('external_reference', `org_sub:${orgId}`);
        checkoutUrl.searchParams.set('payer_email', user.email);
        checkoutUrl.searchParams.set('back_url', `${appUrl}/dashboard/estudio/suscripcion?status=success`);

        return NextResponse.json({
            ok: true,
            init_point: checkoutUrl.toString(),
            plan_tier: planTier,
            plan_label: PLAN_LABELS[planTier] || planTier,
        });

    } catch (err) {
        console.error('[org-subscription/create] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
