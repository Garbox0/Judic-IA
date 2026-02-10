import { NextResponse } from "next/server";
import { verifyAuthAndOwnership } from "@/lib/api-auth";
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
    const { userId } = await req.json();

    if (!userId) {
        return NextResponse.json({ error: "missing userId" }, { status: 400 });
    }

    // 🛡️ Verify authenticated user matches the requested userId
    const auth = await verifyAuthAndOwnership(req, userId);
    if (auth.error) return auth.response;

    const accessTokenEnv = pickEnv([
        "MERCADOPAGO_ACCESS_TOKEN",
        "MERCADOPAGO_ACCESS_TOKEN_PROD",
    ]);
    if (!accessTokenEnv) {
        console.error("MP subscription error: Missing MERCADOPAGO_ACCESS_TOKEN(_PROD)");
        return NextResponse.json(
            {
                error: "Server Error: Missing MercadoPago Access Token (set MERCADOPAGO_ACCESS_TOKEN or MERCADOPAGO_ACCESS_TOKEN_PROD on Vercel and redeploy)",
            },
            { status: 500 }
        );
    }

    const planIdEnv = pickEnv([
        "MP_PREAPPROVAL_PLAN_ID",
        "MP_PLAN_PRO_MONTHLY",
        "NEXT_PUBLIC_MP_PREAPPROVAL_PLAN_ID",
    ]);
    if (!planIdEnv) {
        const raw = process.env.MP_PREAPPROVAL_PLAN_ID;
        console.error("MP subscription error: Missing/invalid plan id env var", {
            mp_preapproval_plan_id_raw: raw,
            vercel_env: process.env.VERCEL_ENV,
        });
        return NextResponse.json({
            error: "Server Error: Missing Plan Configuration (set MP_PREAPPROVAL_PLAN_ID or MP_PLAN_PRO_MONTHLY on Vercel; avoid the literal string 'undefined'; then redeploy)",
        }, { status: 500 });
    }

    const client = new MercadoPagoConfig({ accessToken: accessTokenEnv.value });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://judic-ia.com";

    try {
        // Fetch the Plan details to get the generic init_point
        // We do this instead of creating a specific PreApproval because the SDK/API might require card_token for direct creation,
        // whereas we want to redirect the user to the hosted checkout.
        const preApprovalPlan = new PreApprovalPlan(client);
        const plan = await preApprovalPlan.get({ id: planIdEnv.value });

        if (!plan.init_point) {
            throw new Error("Plan does not have an init_point");
        }

        // Construct the final URL with user context
        // MercadoPago allows appending external_reference to the init_point
        const checkoutUrl = new URL(plan.init_point);
        checkoutUrl.searchParams.set("external_reference", userId);
        checkoutUrl.searchParams.set("payer_email", auth.user.email);
        checkoutUrl.searchParams.set("back_url", `${appUrl}/dashboard/settings?status=success`);

        return NextResponse.json({
            ok: true,
            init_point: checkoutUrl.toString(),
            id: planIdEnv.value, // We return planId as the reference ID since we aren't creating a preapproval instance yet
            plan_env: planIdEnv.name,
        });

    } catch (error) {
        console.error("Subscription Error:", error);
        return NextResponse.json({
            error: error.message || "Error creating subscription",
            details: error.cause,
            plan_env: planIdEnv.name,
        }, { status: 500 });
    }
}
