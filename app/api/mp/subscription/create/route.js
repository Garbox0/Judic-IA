import { NextResponse } from "next/server";
import { verifyAuthAndOwnership } from "@/lib/api-auth";
import { MercadoPagoConfig, PreApproval, PreApprovalPlan } from 'mercadopago';

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

export async function POST(req) {
    const { userId } = await req.json();

    if (!userId) {
        return NextResponse.json({ error: "missing userId" }, { status: 400 });
    }

    // 🛡️ Verify authenticated user matches the requested userId
    const auth = await verifyAuthAndOwnership(req, userId);
    if (auth.error) return auth.response;

    const planId = process.env.MP_PREAPPROVAL_PLAN_ID;
    if (!planId) {
        return NextResponse.json({ error: "Server Error: Missing Plan Configuration" }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://judic-ia.com";

    try {
        // Fetch the Plan details to get the generic init_point
        // We do this instead of creating a specific PreApproval because the SDK/API might require card_token for direct creation,
        // whereas we want to redirect the user to the hosted checkout.
        const preApprovalPlan = new PreApprovalPlan(client);
        const plan = await preApprovalPlan.get({ id: planId });

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
            id: planId // We return planId as the reference ID since we aren't creating a preapproval instance yet
        });

    } catch (error) {
        console.error("Subscription Error:", error);
        return NextResponse.json({
            error: error.message || "Error creating subscription",
            details: error.cause
        }, { status: 500 });
    }
}
