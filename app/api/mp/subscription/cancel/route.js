import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 1. Get user profile
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("mp_preapproval_id, plan_tier")
            .eq("id", userId)
            .single();

        if (profileError) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        let mpCancelled = false;
        let mpError = null;

        // 2. Try Cancel in Mercado Pago (if ID exists)
        if (profile.mp_preapproval_id) {
            try {
                const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
                const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${profile.mp_preapproval_id}`, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ status: "cancelled" }),
                });

                const mpData = await mpResponse.json();

                if (mpResponse.ok) {
                    mpCancelled = true;
                } else {
                    console.warn("MP Cancellation Warning (proceeding locally):", mpData);
                    mpError = mpData.message;
                }
            } catch (err) {
                console.error("MP Fetch Error:", err);
                mpError = err.message;
            }
        } else {
            console.log("No MP ID found for user, cancelling locally only.");
        }

        // 3. Update Profile Always (Local Cancellation)
        const { error: updateError } = await supabase
            .from("profiles")
            .update({
                subscription_status: "cancelled",
                mp_subscription_status: profile.mp_preapproval_id ? (mpCancelled ? "cancelled" : "manual_cancellation_failed") : "cancelled_no_id"
            })
            .eq("id", userId);

        if (updateError) {
            console.error("Profile Update Error:", updateError);
            return NextResponse.json({ error: "Failed to update local subscription status" }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            message: mpCancelled ? "Suscripción cancelada correctamente." : "Suscripción cancelada en plataforma (sin vínculo MP).",
            details: mpError
        });

    } catch (error) {
        console.error("Cancellation Server Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
