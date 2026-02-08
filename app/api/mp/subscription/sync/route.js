import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
    try {
        const { userId, preapproval_id } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        let sub = null;

        // ESTRATEGIA 1: Buscar por ID directo si viene en la URL (back_url)
        if (preapproval_id) {
            try {
                const r = await fetch(`https://api.mercadopago.com/preapproval/${preapproval_id}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (r.ok) {
                    sub = await r.json();
                }
            } catch (e) {
                console.error("Error fetching MP subscription by ID:", e);
            }
        }

        // ESTRATEGIA 2: Si no tenemos ID o falló, buscar por external_reference (userId)
        // Esto es la "Red de Seguridad" definitiva.
        if (!sub || sub.status !== "authorized") {
            try {
                // Buscamos suscripciones autorizadas para este usuario
                const searchUrl = new URL("https://api.mercadopago.com/preapproval/search");
                searchUrl.searchParams.append("status", "authorized");
                searchUrl.searchParams.append("external_reference", userId);

                const r = await fetch(searchUrl.toString(), {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                const searchData = await r.json();
                if (searchData.results && searchData.results.length > 0) {
                    // Tomamos la más reciente
                    sub = searchData.results[0];
                }
            } catch (e) {
                console.error("Error searching MP subscription:", e);
            }
        }

        if (!sub) {
            return NextResponse.json({
                ok: false,
                message: "No active subscription found for this user."
            });
        }

        // SI ENCONTRAMOS UNA SUSCRIPCIÓN ACTIVA, ACTUALIZAMOS LA DB
        // Esto replica la lógica del Webhook para garantizar consistencia
        if (sub.status === "authorized") {
            const patch = {
                mp_preapproval_id: sub.id,
                mp_subscription_status: sub.status,
                subscription_status: "active",
                plan_tier: "professional",
            };

            // Solo seteamos fechas si no existían o si necesitamos renovar
            const now = new Date();
            // Calculamos expiración (30 días)
            const expiryDate = new Date(now);
            expiryDate.setDate(expiryDate.getDate() + 30);

            patch.subscription_expiry = expiryDate.toISOString();
            patch.subscription_started_at = now.toISOString();
            patch.quota_reset_at = now.toISOString();

            // Clear grace period if exists
            patch.grace_period_ends_at = null;

            // Solo reseteamos cuotas si están bajas (evitar resetear si el webhook ya corrió hace 1 seg)
            // Chequeamos el perfil actual primero
            const { data: currentProfile } = await supabase.from("profiles").select("plan_tier").eq("id", userId).single();

            // Si el usuario NO era pro, le damos las cuotas reseteadas
            // Professional tier gets usage counters reset (not unlimited quotas, per PLAN_LIMITS)
            if (currentProfile?.plan_tier !== 'professional') {
                patch.ai_messages_used = 0;
                patch.inquiries_used = 0;
                patch.research_reports_used = 0;
            }

            const { error } = await supabase.from("profiles").update(patch).eq("id", userId);

            if (error) throw error;

            return NextResponse.json({
                ok: true,
                message: "Subscription synced successfully.",
                data: patch
            });
        }

        return NextResponse.json({ ok: false, message: "Subscription found but not authorized." });

    } catch (error) {
        console.error("Sync Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
