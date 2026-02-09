import { NextResponse } from "next/server";
import { verifyAuthAndOwnership } from "@/lib/api-auth";
import { MercadoPagoConfig, PreApproval } from 'mercadopago';

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
        // Create a Preapproval (Subscription) Request linked to the Plan
        // Documentation: https://www.mercadopago.com.ar/developers/en/reference/preapproval/create

        // However, since we already have a Plan ID (preapproval_plan_id), 
        // the most robust way to subscribe a user is often to just send them to the Plan's "init_point" 
        // OR create a specific preapproval for them if we want to track external_reference (userId).

        const preapproval = new PreApproval(client);

        const subscriptionData = {
            body: {
                preapproval_plan_id: planId,
                payer_email: auth.user.email, // Email from auth token
                external_reference: userId,
                back_url: `${appUrl}/dashboard/settings?status=success`,
                status: "pending"
            }
        };

        console.log("Creating Subscription for Plan:", planId);
        const result = await preapproval.create(subscriptionData);

        return NextResponse.json({
            ok: true,
            init_point: result.init_point, // URL where user approves the subscription
            id: result.id
        });

    } catch (error) {
        console.error("Subscription Error:", error);
        return NextResponse.json({
            error: error.message || "Error creating subscription",
            details: error.cause
        }, { status: 500 });
    }
}
