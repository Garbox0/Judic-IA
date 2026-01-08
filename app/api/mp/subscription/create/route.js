import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "missing userId" }, { status: 400 });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id,email")
        .eq("id", userId)
        .single();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "APP_USR-193565517908864-123107-2eff73d48616b0417b658dcc36e312e5-3102487914";

    const planId = process.env.MP_PREAPPROVAL_PLAN_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!planId) {
        console.error("❌ MP_PREAPPROVAL_PLAN_ID not found in environment variables.");
        return NextResponse.json({ error: "MP_PREAPPROVAL_PLAN_ID is missing. Run '/api/mp/plan/create' first." }, { status: 500 });
    }

    const body = {
        preapproval_plan_id: planId,
        payer_email: profile.email,
        back_url: `${appUrl}/dashboard/settings?tab=billing&status=pending`, // Adding status to catch it in frontend if needed
        reason: "Judic-IA Professional",
        external_reference: userId, // clave para linkear MP -> tu usuario
        auto_recurring: {
            currency_id: "ARS",
            transaction_amount: 15000,
            frequency: 1,
            frequency_type: "months"
        },
        status: "pending"
    };

    try {
        console.log("Creating Subscription with body:", JSON.stringify(body));
        const r = await fetch("https://api.mercadopago.com/preapproval", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        const data = await r.json();
        if (!r.ok) {
            console.error("MP Error:", data);
            return NextResponse.json({ error: data }, { status: 500 });
        }

        // Guardamos el id de la suscripción MP
        await supabase.from("profiles").update({
            mp_preapproval_id: data.id,
            mp_subscription_status: data.status,
        }).eq("id", userId);

        return NextResponse.json({
            ok: true,
            init_point: data.init_point, // redirigir a MP
            mp_preapproval_id: data.id,
        });
    } catch (error) {
        console.error("Server Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
