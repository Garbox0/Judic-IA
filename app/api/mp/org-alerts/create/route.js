/**
 * POST /api/mp/org-alerts/create
 *
 * Inicia una preferencia de pago en MercadoPago para comprar créditos
 * de Alerta para el pool del estudio.
 * Solo disponible para el owner (Titular) del estudio verificado.
 *
 * Body: { pack_id: 'alert_pack_1' | 'alert_pack_10' | 'alert_pack_100' }
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/api-auth';

const ORG_ALERT_PACKS = {
    alert_pack_1:   { credits: 1,   amount: 8900,   label: 'Pack 1 alerta (estudio)'   },
    alert_pack_10:  { credits: 10,  amount: 59000,  label: 'Pack 10 alertas (estudio)' },
    alert_pack_100: { credits: 100, amount: 429000, label: 'Pack 100 alertas (estudio)' },
};

export async function POST(request) {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.response;

    const userId = auth.user.id;
    const body = await request.json().catch(() => ({}));
    const { pack_id } = body;

    const pack = ORG_ALERT_PACKS[pack_id];
    if (!pack) {
        return NextResponse.json({ error: 'Pack inválido.' }, { status: 400 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
        return NextResponse.json({ error: 'MP no configurado.' }, { status: 500 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    // Verificar que el usuario es owner de un estudio verificado
    const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userId)
        .single();

    if (!profile?.org_id) {
        return NextResponse.json({ error: 'No pertenecés a ningún estudio.' }, { status: 403 });
    }

    const { data: member } = await supabase
        .from('org_members')
        .select('role, org:org_id(id, name, razon_social, type, verification_status)')
        .eq('user_id', userId)
        .eq('org_id', profile.org_id)
        .single();

    if (!member || member.role !== 'owner') {
        return NextResponse.json({ error: 'Solo el titular puede comprar créditos para el estudio.' }, { status: 403 });
    }

    const org = member.org;
    if (!org || org.type !== 'estudio' || org.verification_status !== 'verified') {
        return NextResponse.json({ error: 'Estudio no verificado.' }, { status: 403 });
    }

    const orgId = org.id;

    // Crear registro de compra pendiente
    const { data: purchase, error: dbError } = await supabase
        .from('org_alert_credit_purchases')
        .insert({
            org_id: orgId,
            purchased_by: userId,
            pack_id,
            credits: pack.credits,
            amount_ars: pack.amount,
            status: 'pending',
        })
        .select('id')
        .single();

    if (dbError) {
        console.error('[mp/org-alerts/create] DB error:', dbError);
        return NextResponse.json({ error: 'Error al iniciar compra.' }, { status: 500 });
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const userEmail = authUser?.user?.email;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';
    const orgName = org.razon_social || org.name;

    const preference = {
        items: [
            {
                id: pack_id,
                title: `Judic-IA — ${pack.label} — ${orgName}`,
                quantity: 1,
                unit_price: pack.amount,
                currency_id: 'ARS',
            },
        ],
        payer: userEmail ? { email: userEmail } : undefined,
        // Format: "org_alert_credits:<purchase_id>:<org_id>:<user_id>"
        external_reference: `org_alert_credits:${purchase.id}:${orgId}:${userId}`,
        back_urls: {
            success: `${appUrl}/dashboard/estudio/creditos?alert_credits=ok`,
            failure: `${appUrl}/dashboard/estudio/creditos?alert_credits=error`,
            pending: `${appUrl}/dashboard/estudio/creditos?alert_credits=pending`,
        },
        auto_return: 'approved',
        notification_url: `${appUrl}/api/mp/webhook`,
    };

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(preference),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
        console.error('[mp/org-alerts/create] MP error:', mpData);
        await supabase.from('org_alert_credit_purchases').delete().eq('id', purchase.id);
        return NextResponse.json({ error: 'Error al crear preferencia MP.' }, { status: 500 });
    }

    return NextResponse.json({
        init_point: mpData.init_point,
        purchase_id: purchase.id,
    });
}
