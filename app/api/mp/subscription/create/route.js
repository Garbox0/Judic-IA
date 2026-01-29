import { NextResponse } from "next/server";

export async function POST(req) {
    const { userId } = await req.json();

    if (!userId) {
        return NextResponse.json({ error: "missing userId" }, { status: 400 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const planId =
        process.env.MP_PREAPPROVAL_PLAN_ID ||
        process.env.NEXT_PUBLIC_MP_PREAPPROVAL_PLAN_ID;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const body = {
        subscription_plan_id: planId, // NOTE: This might be ignored by 'checkout/preferences' but kept for legacy/tracking
        external_reference: userId,
        statement_descriptor: "JUDIC-IA PRO",
        notification_url: `${appUrl}/api/mp/webhook`,
        auto_return: "approved",

        // 🔑 ITEM OBLIGATORIO (dummy para validación de MP)
        items: [
            {
                id: "judic-ia-plan",
                title: "Suscripción Judic-IA – Plan Profesional",
                description: "Acceso completo a la plataforma Judic-IA",
                quantity: 1,
                unit_price: 25000,
                currency_id: "ARS",
                category_id: "services"
            },
        ],

        back_urls: {
            success: `${appUrl}/dashboard/settings?tab=billing`,
            failure: `${appUrl}/dashboard/settings?tab=billing`,
            pending: `${appUrl}/dashboard/settings?tab=billing`,
        },
    };

    try {
        console.log("Creating Subscription Preference:", JSON.stringify(body));
        const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        const data = await r.json();

        if (!r.ok) {
            console.error("MP Preference Error:", data);
            return NextResponse.json({ error: data }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            init_point: data.init_point,
        });
    } catch (error) {
        console.error("Server Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
