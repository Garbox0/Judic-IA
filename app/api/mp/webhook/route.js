import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from 'resend';
import { sendEmail } from "../../../lib/resend";
import crypto from 'crypto';

// 🔐 HMAC Signature Validation for MercadoPago Webhooks
function validateMPSignature(req, body) {
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');
    const secret = process.env.MP_WEBHOOK_SECRET;

    // If no secret configured, log warning but allow (for backwards compatibility)
    if (!secret) {
        console.warn("⚠️ MP_WEBHOOK_SECRET not configured. Signature validation skipped.");
        return { valid: true, reason: 'no_secret_configured' };
    }

    if (!xSignature) {
        return { valid: false, reason: 'missing_signature' };
    }

    // Parse x-signature header: "ts=1704908010,v1=abc123..."
    const parts = xSignature.split(',');
    const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
    const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1];

    if (!ts || !v1) {
        return { valid: false, reason: 'invalid_signature_format' };
    }

    // Build the manifest string (as per MP docs)
    // Format: "id:[data.id];request-id:[x-request-id];ts:[timestamp];"
    const dataId = body?.data?.id || body?.id;
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    // Calculate HMAC-SHA256
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(manifest);
    const calculatedSignature = hmac.digest('hex');

    // Timing-safe comparison
    const isValid = crypto.timingSafeEqual(
        Buffer.from(v1, 'hex'),
        Buffer.from(calculatedSignature, 'hex')
    );

    return { valid: isValid, reason: isValid ? 'valid' : 'signature_mismatch' };
}

export async function POST(req) {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // 1) Recibir notificación
    const body = await req.json().catch(() => ({}));

    // 🔐 VALIDATE SIGNATURE FIRST
    const signatureCheck = validateMPSignature(req, body);
    if (!signatureCheck.valid) {
        console.warn(`🚫 WEBHOOK SIGNATURE REJECTED: ${signatureCheck.reason}`);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const mpId = body?.data?.id || body?.id;
    const topic = body?.type || body?.topic;

    if (!mpId) {
        console.log("⚠️ No ID found in webhook body");
        return NextResponse.json({ ok: true });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    // ─── CREDIT PACK PAYMENT (pago único) ─────────────────────────────────────
    if (topic === 'payment') {
        // Skip test/invalid payment IDs
        if (String(mpId).length < 6 || String(mpId) === '123456') {
            console.log(`ℹ️ Test payment ID, skipping: ${mpId}`);
            return NextResponse.json({ ok: true, test: true });
        }

        try {
            const r = await fetch(`https://api.mercadopago.com/v1/payments/${mpId}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const payment = await r.json();

            if (!r.ok) {
                console.error("Error fetching payment:", payment);
                return NextResponse.json({ error: payment }, { status: 500 });
            }

            // external_reference format:
            // - "credits:<purchase_id>:<user_id>"       (research credits)
            // - "alert_credits:<purchase_id>:<user_id>" (alert credits)
            const extRef = payment.external_reference || '';
            const [purchaseType, purchaseId, userId] = extRef.split(':');
            const isResearchCredits = purchaseType === 'credits';
            const isAlertCredits = purchaseType === 'alert_credits';

            if (!isResearchCredits && !isAlertCredits) {
                // No es un credit pack, ignorar aquí (continuará al flujo de suscripción)
                console.log('Payment is not a known credit pack, skipping.');
                return NextResponse.json({ ok: true });
            }

            if (!purchaseId || !userId) {
                console.warn('❌ Invalid external_reference for credit payment:', extRef);
                return NextResponse.json({ ok: true });
            }

            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            const purchasesTable = isAlertCredits ? 'alert_credit_purchases' : 'credit_purchases';
            const creditLabel = isAlertCredits ? 'alerta' : 'research';

            if (payment.status === 'approved') {
                // 1. Obtener el pack para saber cuántos credits
                const { data: purchase } = await supabase
                    .from(purchasesTable)
                    .select('credits, status, pack_id')
                    .eq('id', purchaseId)
                    .single();

                if (!purchase || purchase.status === 'approved') {
                    // Ya procesado (idempotencia)
                    return NextResponse.json({ ok: true });
                }

                // 2. Acreditar credits + registrar payment ID
                if (isAlertCredits) {
                    const addAlertCreditsResult = await supabase.rpc('add_alert_credits', {
                        p_user_id: userId,
                        p_credits: purchase.credits
                    });

                    if (addAlertCreditsResult.error) {
                        throw new Error(`ALERT_CREDITS_UPDATE_FAILED: ${addAlertCreditsResult.error.message}`);
                    }

                    const { error: purchaseStatusError } = await supabase
                        .from(purchasesTable)
                        .update({ status: 'approved', mp_payment_id: String(mpId) })
                        .eq('id', purchaseId);

                    if (purchaseStatusError) {
                        throw new Error(`ALERT_PURCHASE_STATUS_FAILED: ${purchaseStatusError.message}`);
                    }
                } else {
                    const addResearchCreditsResult = await supabase.rpc('add_research_credits', {
                        p_user_id: userId,
                        p_credits: purchase.credits
                    });

                    if (addResearchCreditsResult.error) {
                        throw new Error(`RESEARCH_CREDITS_UPDATE_FAILED: ${addResearchCreditsResult.error.message}`);
                    }

                    const { error: purchaseStatusError } = await supabase
                        .from(purchasesTable)
                        .update({ status: 'approved', mp_payment_id: String(mpId) })
                        .eq('id', purchaseId);

                    if (purchaseStatusError) {
                        throw new Error(`RESEARCH_PURCHASE_STATUS_FAILED: ${purchaseStatusError.message}`);
                    }
                }

                console.log(`✅ Credits ${creditLabel} acreditados: ${purchase.credits} para user ${userId}`);
            } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
                await supabase
                    .from(purchasesTable)
                    .update({ status: 'rejected', mp_payment_id: String(mpId) })
                    .eq('id', purchaseId);
            }

            return NextResponse.json({ ok: true });

        } catch (err) {
            console.error("Credit payment webhook error:", err);
            return NextResponse.json({ error: err.message }, { status: 500 });
        }
    }

    // ─── SUBSCRIPTION (preapproval) ────────────────────────────────────────────

    // 🧪 GUARD: Skip test/invalid IDs (real preapproval IDs are long strings)
    const mpIdStr = String(mpId);
    if (mpIdStr.length < 15 || mpIdStr === '123456') {
        console.log(`ℹ️ Test/invalid preapproval ID, skipping fetch: ${mpIdStr}`);
        return NextResponse.json({ ok: true, test: true });
    }

    // 2) Consultar a MP el estado REAL de la suscripción


    try {
        const r = await fetch(`https://api.mercadopago.com/preapproval/${mpId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const sub = await r.json();

        if (!r.ok) {
            console.error("Error fetching subscription:", sub);
            return NextResponse.json({ error: sub }, { status: 500 });
        }

        // console.log("✅ Subscription details:", sub);

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
        const { data: currentProfile } = await supabase.from("profiles").select("plan_tier, subscription_expiry, quota_reset_at").eq("id", userId).single();
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

            // Reset monthly quota timestamp
            patch.quota_reset_at = now.toISOString();

            // Reset usage counters for new billing cycle (professional gets unlimited = -1 or high limits)
            // Per PLAN_LIMITS: professional has 1000 AI messages, 100 inquiries, 50 research reports
            patch.ai_messages_used = 0;
            patch.inquiries_used = 0;
            patch.research_reports_used = 0;

            // Clear any grace period if they were in one
            patch.grace_period_ends_at = null;
        }

        if (sub.status === "paused" || sub.status === "cancelled") {
            patch.subscription_status = "cancelled";

            // Logic to prevent premature downgrade:
            // Only downgrade to free tier if the expiry date has passed.
            // If the user paid for the month, they keep 'professional' until expiry.

            const now = new Date();
            const storedExpiry = currentProfile?.subscription_expiry ? new Date(currentProfile.subscription_expiry) : null;

            // If expiry is in the future, we KEEP professional tier.
            // The CRON job will downgrade them when the date passes.
            if (storedExpiry && storedExpiry > now) {
                console.log(`User ${userId} cancelled but has time remaining until ${storedExpiry.toISOString()}`);
                // patch.plan_tier remains untouched (or ensures it stays professional)
            } else {
                // Downgrade to free tier (not trial, since they were paying customers)
                patch.plan_tier = "free";
                // Reset to free tier limits (20 AI messages, 5 inquiries, 5 research reports)
                patch.ai_messages_used = 0;
                patch.inquiries_used = 0;
                patch.research_reports_used = 0;
                patch.quota_reset_at = now.toISOString();
            }
        }

        // Handle payment failure (MP sends status updates)
        if (sub.status === "payment_required" || sub.status === "pending") {
            // Set grace period (7 days to fix payment)
            const gracePeriod = new Date();
            gracePeriod.setDate(gracePeriod.getDate() + 7);
            patch.grace_period_ends_at = gracePeriod.toISOString();
            patch.subscription_status = "past_due";
            // Keep professional tier during grace period
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
                    from: "billing@judic-ia.com",
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
                                <p>Tu factura estará disponible en tu panel en las próximas horas.</p>
                                <p>© ${new Date().getFullYear()} Judic-IA. Todos los derechos reservados.</p>
                            </div>
                        </div>
                    `
                });
                console.log("📧 Welcome Email sent to:", userEmail);
            }

            // 7) Crear factura pendiente para el usuario
            // Obtener nombre del perfil para la factura
            const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', userId)
                .single();

            const { error: invoiceError } = await supabase.from("invoices").insert({
                user_id: userId,
                status: 'pending',
                description: 'Suscripción Mensual - Judic-IA Suite Pro',
                amount: Math.round(sub.auto_recurring?.transaction_amount || 25000),
                payment_date: new Date().toISOString(),
                client_name: profileData?.full_name || 'Consumidor Final',
                invoice_type: 'C' // Factura C (monotributista)
            });

            if (invoiceError) {
                console.error("Error creating invoice:", invoiceError);
            } else {
                console.log("📄 Pending invoice created for user:", userId);
            }
        }

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error("Webhook Handler Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
