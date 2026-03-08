import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, PreApprovalPlan } from "mercadopago";

export const runtime = "nodejs";

function normalizeEnv(value) {
    if (typeof value !== "string") return null;
    let trimmed = value.trim();
    if (!trimmed) return null;
    if (
        (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        trimmed = trimmed.slice(1, -1).trim();
        if (!trimmed) return null;
    }
    const lowered = trimmed.toLowerCase();
    if (lowered === "undefined" || lowered === "null") return null;
    return trimmed;
}

function pickEnv(names) {
    for (const name of names) {
        const normalized = normalizeEnv(process.env[name]);
        if (normalized) return { name, value: normalized };
    }
    return null;
}

export async function POST(req) {
    // Bearer token auth pattern
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

    const userId = user.id;

    // Check if already subscribed
    const { data: profile } = await supabase
        .from('profiles')
        .select('whatsapp_sub_status')
        .eq('id', userId)
        .single();

    if (profile?.whatsapp_sub_status === 'active') {
        return NextResponse.json(
            { error: "Ya tenés el Asistente WhatsApp activo en tu cuenta." },
            { status: 400 }
        );
    }

    const accessTokenEnv = pickEnv([
        "MERCADOPAGO_ACCESS_TOKEN",
        "MERCADOPAGO_ACCESS_TOKEN_PROD",
    ]);
    if (!accessTokenEnv) {
        console.error("MP whatsapp-sub error: Missing MERCADOPAGO_ACCESS_TOKEN(_PROD)");
        return NextResponse.json(
            { error: "Server Error: Missing MercadoPago Access Token" },
            { status: 500 }
        );
    }

    const planIdEnv = pickEnv(["MP_PLAN_WHATSAPP_ID"]);
    if (!planIdEnv) {
        console.error("MP whatsapp-sub error: Missing MP_PLAN_WHATSAPP_ID");
        return NextResponse.json(
            { error: "Server Error: Missing WhatsApp Plan Configuration (set MP_PLAN_WHATSAPP_ID on Vercel and redeploy)" },
            { status: 500 }
        );
    }

    const client = new MercadoPagoConfig({ accessToken: accessTokenEnv.value });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://judic-ia.com";

    try {
        const preApprovalPlan = new PreApprovalPlan(client);
        const plan = await preApprovalPlan.get({ preApprovalPlanId: planIdEnv.value });

        if (!plan.init_point) {
            throw new Error("Plan does not have an init_point");
        }

        const checkoutUrl = new URL(plan.init_point);
        checkoutUrl.searchParams.set("external_reference", `whatsapp_sub:${userId}`);
        checkoutUrl.searchParams.set("payer_email", user.email);
        checkoutUrl.searchParams.set("back_url", `${appUrl}/dashboard/settings?whatsapp_sub=success`);

        return NextResponse.json({
            ok: true,
            checkout_url: checkoutUrl.toString(),
            plan_env: planIdEnv.name,
        });

    } catch (error) {
        console.error("WhatsApp Subscription Error:", error);
        return NextResponse.json({
            error: error.message || "Error creating WhatsApp subscription",
            details: error.cause,
            plan_env: planIdEnv?.name,
        }, { status: 500 });
    }
}
