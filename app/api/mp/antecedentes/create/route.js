/**
 * POST /api/mp/antecedentes/create
 *
 * Inicia una preferencia de pago en MercadoPago para comprar créditos
 * de Antecedentes Judiciales. Disponible para cualquier usuario registrado
 * (no requiere suscripción activa).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/api-auth';

const ANTECEDENTES_PACKS = {
    pack_5:  { credits: 5,  amount: 25000, label: 'Pack 5 importaciones' },
    pack_15: { credits: 15, amount: 60000, label: 'Pack 15 importaciones' },
    pack_30: { credits: 30, amount: 99000, label: 'Pack 30 importaciones' },
};

export async function POST(request) {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.response;

    const userId = auth.user.id;
    const body = await request.json().catch(() => ({}));
    const { pack_id } = body;

    const pack = ANTECEDENTES_PACKS[pack_id];
    if (!pack) {
        return NextResponse.json({ error: 'Pack inválido.' }, { status: 400 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
        return NextResponse.json({ error: 'MP no configurado.' }, { status: 500 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Crear registro de compra pendiente
    const { data: purchase, error: dbError } = await supabase
        .from('antecedentes_credit_purchases')
        .insert({
            user_id: userId,
            pack_id,
            credits: pack.credits,
            amount_ars: pack.amount,
            status: 'pending',
        })
        .select('id')
        .single();

    if (dbError) {
        console.error('[mp/antecedentes/create] DB error:', dbError);
        return NextResponse.json({ error: 'Error al iniciar compra.' }, { status: 500 });
    }

    // Obtener email del usuario para MercadoPago
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const userEmail = authUser?.user?.email;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';

    const preference = {
        items: [
            {
                id: pack_id,
                title: `Judic-IA - ${pack.label}`,
                quantity: 1,
                unit_price: pack.amount,
                currency_id: 'ARS',
            },
        ],
        payer: userEmail ? { email: userEmail } : undefined,
        external_reference: `antecedentes_credits:${purchase.id}:${userId}`,
        back_urls: {
            success: `${appUrl}/dashboard/research?tab=antecedentes&credits=ok`,
            failure: `${appUrl}/dashboard/research?tab=antecedentes&credits=error`,
            pending: `${appUrl}/dashboard/research?tab=antecedentes&credits=pending`,
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
        console.error('[mp/antecedentes/create] MP error:', mpData);
        await supabase.from('antecedentes_credit_purchases').delete().eq('id', purchase.id);
        return NextResponse.json({ error: 'Error al crear preferencia MP.' }, { status: 500 });
    }

    return NextResponse.json({
        init_point: mpData.init_point,
        purchase_id: purchase.id,
    });
}
