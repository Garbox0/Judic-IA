import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
    // 1) Recibir notificación
    const body = await req.json().catch(() => ({}));
    console.log("🔔 Webhook received:", body);

    // OJO: el formato exacto del payload depende del tipo de notificación configurada en tu cuenta.
    // En general vas a recibir un "id" para consultar a MP.
    const mpId = body?.data?.id || body?.id || body?.data?.id; // Try multiple paths

    if (!mpId) {
        console.log("⚠️ No ID found in webhook body");
        return NextResponse.json({ ok: true });
    }

    // 2) Consultar a MP el estado REAL de la suscripción (fuente de verdad)
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "APP_USR-193565517908864-123107-2eff73d48616b0417b658dcc36e312e5-3102487914";

    try {
        const r = await fetch(`https://api.mercadopago.com/preapproval/${mpId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const sub = await r.json();

        if (!r.ok) {
            console.error("Error fetching subscription:", sub);
            return NextResponse.json({ error: sub }, { status: 500 });
        }

        console.log("✅ Subscription details:", sub);

        // 3) Linkear con tu usuario
        const userId = sub.external_reference; // lo seteamos al crearla
        if (!userId) {
            console.warn("⚠️ No external_reference (userId) in subscription");
            return NextResponse.json({ ok: true });
        }

        // 4) Actualizar Supabase según status
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const patch = {
            mp_preapproval_id: sub.id,
            mp_subscription_status: sub.status,
        };

        if (sub.status === "authorized") {
            patch.subscription_status = "active";
            patch.plan_tier = "professional";
            patch.subscription_started_at = new Date().toISOString();
            // Reset quotas for new pro user
            patch.ai_message_quota = 1000;
            patch.inquiry_quota = 100;
        }

        if (["paused", "cancelled"].includes(sub.status)) {
            patch.subscription_status = "cancelled";
            patch.plan_tier = "starter"; // Downgrade logic could be here or manual
        }

        const { error } = await supabase.from("profiles").update(patch).eq("id", userId);

        if (error) console.error("Database update error:", error);
        else console.log("Database updated for user:", userId);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Webhook Handler Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
