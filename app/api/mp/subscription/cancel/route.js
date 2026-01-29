import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from 'resend';
import { sendEmail } from "../../../lib/resend";

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

        // 4. Send Cancellation Email (Fire & Forget)
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        const userEmail = userData?.user?.email;

        if (userEmail) {
            await sendEmail({
                resendClient: resend,
                to: userEmail,
                from: "billing@judic-ia.com",
                subject: "Confirmación de Cancelación - Judic-IA",
                html: `
                    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #020617; color: #f8fafc; padding: 40px; border-radius: 12px; border: 1px solid #1e293b;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #fbbf24; margin: 0; font-family: 'Playfair Display', serif; font-size: 32px;">Judic-IA</h1>
                            <p style="color: #94a3b8; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px;">Cancelación de Suscripción</p>
                        </div>
                        
                        <div style="background-color: rgba(255,255,255,0.03); padding: 30px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 20px;">👋</div>
                            <h2 style="color: #f8fafc; margin-top: 0;">Lamentamos verte partir</h2>
                            <p style="color: #cbd5e1; line-height: 1.6;">
                                Tu suscripción ha sido cancelada correctamente. No se realizarán más cobros en tu tarjeta.
                            </p>
                            <p style="color: #cbd5e1; line-height: 1.6; margin-top: 15px;">
                                Mantendrás acceso a las funciones Profesionales hasta el final de tu período de facturación actual.
                            </p>
                            <a href="https://judic-ia.com/dashboard/settings" style="display: inline-block; background-color: rgba(255, 255, 255, 0.1); color: #f8fafc; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; border: 1px solid rgba(255, 255, 255, 0.2);">Gestionar Suscripción</a>
                        </div>

                        <div style="margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
                            <p>Esperamos verte de nuevo pronto.</p>
                            <p>© ${new Date().getFullYear()} Judic-IA.</p>
                        </div>
                    </div>
                `
            });
            console.log("📧 Cancellation Email sent to:", userEmail);
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
