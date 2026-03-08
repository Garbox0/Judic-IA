import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('whatsapp_sub_id, whatsapp_sub_status')
        .eq('id', user.id)
        .single();

    if (!profile?.whatsapp_sub_id) {
        return NextResponse.json({ error: "No hay suscripción activa." }, { status: 400 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN_PROD || process.env.MERCADOPAGO_ACCESS_TOKEN;

    // Cancel on MercadoPago
    try {
        const mpRes = await fetch(
            `https://api.mercadopago.com/preapproval/${profile.whatsapp_sub_id}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: 'cancelled' }),
            }
        );
        if (!mpRes.ok) {
            const err = await mpRes.json();
            console.error('[whatsapp-sub/cancel] MP error:', err);
            // Continue to cancel locally even if MP fails (manual cleanup)
        }
    } catch (e) {
        console.error('[whatsapp-sub/cancel] MP fetch error:', e.message);
    }

    // Update profile
    await supabase.from('profiles').update({
        whatsapp_sub_status: 'cancelled',
        whatsapp_sub_id: null,
        whatsapp_sub_expiry: null,
        whatsapp_grace_period_ends_at: null,
    }).eq('id', user.id);

    return NextResponse.json({ ok: true });
}
