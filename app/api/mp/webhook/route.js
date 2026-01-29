import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from 'resend';
import { sendEmail } from "../../../lib/resend";

export async function POST(req) {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // 1) Recibir notificación
    const body = await req.json().catch(() => ({}));
    console.log("🔔 Webhook received:", body);

    const mpId = body?.data?.id || body?.id || body?.data?.id;

    if (!mpId) {
        console.log("⚠️ No ID found in webhook body");
        return NextResponse.json({ ok: true });
    }

    // 2) Consultar a MP el estado REAL de la suscripción
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

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
        const userId = sub.external_reference;
        if (!userId) {
            console.warn("⚠️ No external_reference (userId) in subscription");
            return NextResponse.json({ ok: true });
        }

        // 4) Inicializar Supabase y Patch
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const patch = {
            mp_preapproval_id: sub.id,
            mp_subscription_status: sub.status,
        };

        // Check current status for Idempotency (Prevent duplicate emails)
        const { data: currentProfile } = await supabase.from("profiles").select("plan_tier, subscription_expiry").eq("id", userId).single();
        const isFreshUpgrade = currentProfile?.plan_tier !== 'professional';

        // Lógica de Estado
        if (sub.status === "authorized") {
            patch.subscription_status = "active";
            patch.plan_tier = "professional";

            const now = new Date();
            patch.subscription_started_at = now.toISOString();

            // Calculate expiry (30 days from now)
            const expiryDate = new Date(now);
            expiryDate.setDate(expiryDate.getDate() + 30);
            patch.subscription_expiry = expiryDate.toISOString();

            // Reset quotas for new pro user
            patch.ai_message_quota = 1000;
            patch.inquiry_quota = 100;
        }

        if (sub.status === "paused" || sub.status === "cancelled") {
            patch.subscription_status = "cancelled";

            // Logic to prevent premature downgrade:
            // Only downgrade to starter if the expiry date has passed.
            // If the user paid for the month, they keep 'professional' until expiry.

            const now = new Date();
            const storedExpiry = currentProfile?.subscription_expiry ? new Date(currentProfile.subscription_expiry) : null;

            // If expiry is in the future, we KEEP professional tier.
            // The CRON job will downgrade them when the date passes.
            if (storedExpiry && storedExpiry > now) {
                console.log(`User ${userId} cancelled but has time remaining until ${storedExpiry.toISOString()}`);
                // patch.plan_tier remains untouched (or ensures it stays professional)
            } else {
                patch.plan_tier = "starter";
            }
        }

        // 5) Actualizar Base de Datos
        const { error } = await supabase.from("profiles").update(patch).eq("id", userId);

        if (error) {
            console.error("Database update error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log("Database updated for user:", userId);

        // 6) Enviar Email SOLO si es authorized y el usuario NO era pro antes
        if (sub.status === "authorized" && isFreshUpgrade) {
            const { data: userData } = await supabase.auth.admin.getUserById(userId);
            const userEmail = userData?.user?.email;

            if (userEmail) {
                await sendEmail({
                    resendClient: resend,
                    to: userEmail,
                    from: "billing@judic-ia.com", // Usando el remitente configurado en resend.js si este parámetro se omite usa no-reply
                    subject: "Bienvenido a Judic-IA Profesional ⚖️",
                    html: `
                        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #020617; color: #f8fafc; padding: 40px; border-radius: 12px; border: 1px solid #1e293b;">
                            <div style="text-align: center; margin-bottom: 30px;">
                                <h1 style="color: #fbbf24; margin: 0; font-family: 'Playfair Display', serif; font-size: 32px;">Judic-IA</h1>
                                <p style="color: #94a3b8; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px;">Confirmación de Suscripción</p>
                            </div>
                            
                            <div style="background-color: rgba(255,255,255,0.03); padding: 30px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); text-align: center;">
                                <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
                                <h2 style="color: #f8fafc; margin-top: 0;">¡Tu cuenta ha sido mejorada!</h2>
                                <p style="color: #cbd5e1; line-height: 1.6;">
                                    El pago de tu suscripción <strong>Profesional</strong> se ha procesado correctamente.
                                    Ya tienes acceso ilimitado a todas las herramientas de IA.
                                </p>
                                <a href="https://judic-ia.com/dashboard" style="display: inline-block; background-color: #fbbf24; color: #020617; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px;">Ir a mi Panel</a>
                            </div>

                            <div style="margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
                                <p>Si necesitas tu factura, escríbenos a <a href="mailto:billing@judic-ia.com" style="color: #fbbf24;">billing@judic-ia.com</a></p>
                                <p>© ${new Date().getFullYear()} Judic-IA. Todos los derechos reservados.</p>
                            </div>
                        </div>
                    `
                });
                console.log("📧 Welcome Email sent to:", userEmail);
            }
        }

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error("Webhook Handler Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
