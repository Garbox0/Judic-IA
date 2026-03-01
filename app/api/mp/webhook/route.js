import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from 'resend';
import { sendEmail } from "../../../lib/resend";
import crypto from 'crypto';

// ─── INTERNAL BILLING AUDIT NOTIFICATION ──────────────────────────────────
// Sends a structured audit email to billing@judic-ia.com on every
// successful payment event. Fire-and-forget: never throws.
async function notifyBilling(resend, { subject, rows }) {
    const BILLING = 'billing@judic-ia.com';
    const rowsHtml = rows.map(({ label, value }) => `
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;white-space:nowrap;font-size:13px;">${label}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#f1f5f9;font-size:13px;word-break:break-all;">${value ?? '—'}</td>
        </tr>`).join('');
    const html = `
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;background:#020617;color:#f8fafc;padding:32px;border-radius:10px;border:1px solid #1e293b;">
            <p style="margin:0 0 6px;font-size:18px;font-weight:bold;color:#fbbf24;">Judic-IA · Audit Trail</p>
            <p style="margin:0 0 24px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${subject}</p>
            <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.03);border-radius:6px;overflow:hidden;border:1px solid #1e293b;">
                ${rowsHtml}
            </table>
            <p style="margin-top:20px;font-size:11px;color:#475569;">Este mail es generado automáticamente. No responder.</p>
        </div>`;
    try {
        await resend.emails.send({
            from: 'billing@judic-ia.com',
            to: BILLING,
            subject: `[Judic-IA Billing] ${subject}`,
            html,
        });
    } catch (err) {
        console.error('[notifyBilling] error:', err?.message);
    }
}

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
            // - "credits:<purchase_id>:<user_id>"                             (research credits individuales)
            // - "alert_credits:<purchase_id>:<user_id>"                       (alert credits individuales)
            // - "antecedentes_credits:<purchase_id>:<user_id>"                (antecedentes individuales)
            // - "org_antecedentes_credits:<purchase_id>:<org_id>:<user_id>"   (pool antecedentes del estudio)
            // - "org_research_credits:<purchase_id>:<org_id>:<user_id>"       (pool research del estudio)
            // - "org_alert_credits:<purchase_id>:<org_id>:<user_id>"          (pool alertas del estudio)
            const extRef = payment.external_reference || '';
            const refParts = extRef.split(':');
            const purchaseType = refParts[0];
            const isResearchCredits = purchaseType === 'credits';
            const isAlertCredits = purchaseType === 'alert_credits';
            const isAntecedentesCredits = purchaseType === 'antecedentes_credits';
            const isOrgAntecedentesCredits = purchaseType === 'org_antecedentes_credits';
            const isOrgResearchCredits = purchaseType === 'org_research_credits';
            const isOrgAlertCredits = purchaseType === 'org_alert_credits';

            if (!isResearchCredits && !isAlertCredits && !isAntecedentesCredits && !isOrgAntecedentesCredits && !isOrgResearchCredits && !isOrgAlertCredits) {
                // No es un credit pack, ignorar aquí (continuará al flujo de suscripción)
                console.log('Payment is not a known credit pack, skipping.');
                return NextResponse.json({ ok: true });
            }

            // org_*_credits: [type, purchaseId, orgId, userId]
            // all others:    [type, purchaseId, userId]
            const isOrgCreditPack = isOrgAntecedentesCredits || isOrgResearchCredits || isOrgAlertCredits;
            const purchaseId = refParts[1];
            const orgId = isOrgCreditPack ? refParts[2] : null;
            const userId = isOrgCreditPack ? refParts[3] : refParts[2];

            if (!purchaseId || !userId) {
                console.warn('❌ Invalid external_reference for credit payment:', extRef);
                return NextResponse.json({ ok: true });
            }

            if (isOrgCreditPack && !orgId) {
                console.warn('❌ Missing orgId in org credit reference:', extRef);
                return NextResponse.json({ ok: true });
            }

            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            const purchasesTable = isAlertCredits
                ? 'alert_credit_purchases'
                : isAntecedentesCredits
                    ? 'antecedentes_credit_purchases'
                    : isOrgAntecedentesCredits
                        ? 'org_antecedentes_credit_purchases'
                        : isOrgResearchCredits
                            ? 'org_research_credit_purchases'
                            : isOrgAlertCredits
                                ? 'org_alert_credit_purchases'
                                : 'credit_purchases';
            const creditLabel = isAlertCredits
                ? 'alerta'
                : isAntecedentesCredits
                    ? 'antecedentes'
                    : isOrgAntecedentesCredits
                        ? 'org_antecedentes'
                        : isOrgResearchCredits
                            ? 'org_research'
                            : isOrgAlertCredits
                                ? 'org_alert'
                                : 'research';

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
                } else if (isAntecedentesCredits) {
                    const addResult = await supabase.rpc('add_antecedentes_credits', {
                        p_user_id: userId,
                        p_credits: purchase.credits
                    });

                    if (addResult.error) {
                        throw new Error(`ANTECEDENTES_CREDITS_UPDATE_FAILED: ${addResult.error.message}`);
                    }

                    const { error: purchaseStatusError } = await supabase
                        .from(purchasesTable)
                        .update({ status: 'approved', mp_payment_id: String(mpId) })
                        .eq('id', purchaseId);

                    if (purchaseStatusError) {
                        throw new Error(`ANTECEDENTES_PURCHASE_STATUS_FAILED: ${purchaseStatusError.message}`);
                    }
                } else if (isOrgAntecedentesCredits) {
                    const addResult = await supabase.rpc('add_org_antecedentes_credits', {
                        p_org_id: orgId,
                        p_credits: purchase.credits
                    });

                    if (addResult.error) {
                        throw new Error(`ORG_ANTECEDENTES_CREDITS_UPDATE_FAILED: ${addResult.error.message}`);
                    }

                    const { error: purchaseStatusError } = await supabase
                        .from(purchasesTable)
                        .update({ status: 'approved', mp_payment_id: String(mpId) })
                        .eq('id', purchaseId);

                    if (purchaseStatusError) {
                        throw new Error(`ORG_ANTECEDENTES_PURCHASE_STATUS_FAILED: ${purchaseStatusError.message}`);
                    }
                } else if (isOrgResearchCredits) {
                    const addResult = await supabase.rpc('add_org_research_credits', {
                        p_org_id: orgId,
                        p_credits: purchase.credits
                    });

                    if (addResult.error) {
                        throw new Error(`ORG_RESEARCH_CREDITS_UPDATE_FAILED: ${addResult.error.message}`);
                    }

                    const { error: purchaseStatusError } = await supabase
                        .from(purchasesTable)
                        .update({ status: 'approved', mp_payment_id: String(mpId) })
                        .eq('id', purchaseId);

                    if (purchaseStatusError) {
                        throw new Error(`ORG_RESEARCH_PURCHASE_STATUS_FAILED: ${purchaseStatusError.message}`);
                    }
                } else if (isOrgAlertCredits) {
                    const addResult = await supabase.rpc('add_org_alert_credits', {
                        p_org_id: orgId,
                        p_credits: purchase.credits
                    });

                    if (addResult.error) {
                        throw new Error(`ORG_ALERT_CREDITS_UPDATE_FAILED: ${addResult.error.message}`);
                    }

                    const { error: purchaseStatusError } = await supabase
                        .from(purchasesTable)
                        .update({ status: 'approved', mp_payment_id: String(mpId) })
                        .eq('id', purchaseId);

                    if (purchaseStatusError) {
                        throw new Error(`ORG_ALERT_PURCHASE_STATUS_FAILED: ${purchaseStatusError.message}`);
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

                // Emails: confirmación al abogado + auditoría interna
                try {
                    const [{ data: userData }, { data: profileData }] = await Promise.all([
                        supabase.auth.admin.getUserById(userId),
                        supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
                    ]);
                    const userEmail = userData?.user?.email;
                    const userName = profileData?.full_name || 'Sin nombre';
                    const creditNoun = isAlertCredits
                        ? 'créditos de alerta'
                        : isAntecedentesCredits
                            ? 'créditos de antecedentes'
                            : isOrgAntecedentesCredits
                                ? 'créditos de antecedentes (estudio)'
                                : isOrgResearchCredits
                                    ? 'créditos de investigación (estudio)'
                                    : isOrgAlertCredits
                                        ? 'créditos de alerta (estudio)'
                                        : 'créditos de estrategia';
                    const creditPlural = purchase.credits === 1
                        ? `1 ${creditNoun.slice(0, -1)}`
                        : `${purchase.credits} ${creditNoun}`;
                    const opType = isAlertCredits
                        ? 'Pack de créditos de alerta'
                        : isAntecedentesCredits
                            ? 'Pack de créditos de antecedentes'
                            : isOrgAntecedentesCredits
                                ? 'Pack de créditos de antecedentes (pool del estudio)'
                                : isOrgResearchCredits
                                    ? 'Pack de créditos de investigación (pool del estudio)'
                                    : isOrgAlertCredits
                                        ? 'Pack de créditos de alerta (pool del estudio)'
                                        : 'Pack de créditos de estrategia';

                    if (userEmail) {
                        await sendEmail({
                            resendClient: resend,
                            to: userEmail,
                            from: 'billing@judic-ia.com',
                            subject: `Judic-IA — Pago confirmado ✅`,
                            html: `
                                <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#020617;color:#f8fafc;padding:40px;border-radius:12px;border:1px solid #1e293b;">
                                    <h1 style="color:#fbbf24;margin:0 0 4px;font-size:28px;">Judic-IA</h1>
                                    <p style="color:#94a3b8;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 32px;">Confirmación de pago</p>
                                    <div style="background:rgba(255,255,255,0.03);padding:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
                                        <p style="font-size:36px;margin:0 0 16px;">✅</p>
                                        <p style="color:#cbd5e1;line-height:1.6;margin:0;">
                                            Se acreditaron <strong style="color:#f8fafc;">${creditPlural}</strong> en tu cuenta.<br>
                                            Podés usarlos de inmediato desde el módulo de Investigación.
                                        </p>
                                        <a href="https://judic-ia.com/dashboard/research" style="display:inline-block;margin-top:24px;background:#fbbf24;color:#020617;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Ir a Investigación</a>
                                    </div>
                                    <p style="margin-top:32px;font-size:12px;color:#475569;text-align:center;">© ${new Date().getFullYear()} Judic-IA. Todos los derechos reservados.</p>
                                </div>
                            `
                        });
                        console.log(`📧 Email de créditos acreditados enviado a: ${userEmail}`);
                    }

                    // Auditoría interna
                    await notifyBilling(resend, {
                        subject: `✅ Pago aprobado — ${opType}`,
                        rows: [
                            { label: 'Operación',       value: opType },
                            { label: 'Estado',          value: '✅ Aprobado' },
                            { label: 'Abogado',         value: userName },
                            { label: 'Email',           value: userEmail },
                            { label: 'User ID',         value: userId },
                            { label: 'Créditos',        value: String(purchase.credits) },
                            { label: 'Pack ID',         value: purchase.pack_id },
                            { label: 'Monto',           value: `ARS ${payment.transaction_amount ?? '—'}` },
                            { label: 'MP Payment ID',   value: String(mpId) },
                            { label: 'Purchase ID (DB)',value: purchaseId },
                            { label: 'Fecha/hora',      value: new Date().toISOString() },
                        ],
                    });
                } catch (emailErr) {
                    console.error('Error enviando emails de créditos acreditados:', emailErr?.message);
                }

            } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
                await supabase
                    .from(purchasesTable)
                    .update({ status: 'rejected', mp_payment_id: String(mpId) })
                    .eq('id', purchaseId);

                // Emails: aviso al abogado + auditoría interna
                try {
                    const [{ data: userData }, { data: profileData }] = await Promise.all([
                        supabase.auth.admin.getUserById(userId),
                        supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
                    ]);
                    const userEmail = userData?.user?.email;
                    const userName = profileData?.full_name || 'Sin nombre';
                    const creditNoun = isAlertCredits
                        ? 'créditos de alerta'
                        : isAntecedentesCredits
                            ? 'créditos de antecedentes'
                            : isOrgAntecedentesCredits
                                ? 'créditos de antecedentes (estudio)'
                                : isOrgResearchCredits
                                    ? 'créditos de investigación (estudio)'
                                    : isOrgAlertCredits
                                        ? 'créditos de alerta (estudio)'
                                        : 'créditos de estrategia';
                    const opType = isAlertCredits
                        ? 'Pack de créditos de alerta'
                        : isAntecedentesCredits
                            ? 'Pack de créditos de antecedentes'
                            : isOrgAntecedentesCredits
                                ? 'Pack de créditos de antecedentes (pool del estudio)'
                                : isOrgResearchCredits
                                    ? 'Pack de créditos de investigación (pool del estudio)'
                                    : isOrgAlertCredits
                                        ? 'Pack de créditos de alerta (pool del estudio)'
                                        : 'Pack de créditos de estrategia';

                    if (userEmail) {
                        await sendEmail({
                            resendClient: resend,
                            to: userEmail,
                            from: 'billing@judic-ia.com',
                            subject: `Judic-IA — El pago no pudo procesarse`,
                            html: `
                                <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#020617;color:#f8fafc;padding:40px;border-radius:12px;border:1px solid #1e293b;">
                                    <h1 style="color:#fbbf24;margin:0 0 4px;font-size:28px;">Judic-IA</h1>
                                    <p style="color:#94a3b8;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 32px;">Aviso de pago</p>
                                    <div style="background:rgba(255,255,255,0.03);padding:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
                                        <p style="font-size:36px;margin:0 0 16px;">❌</p>
                                        <p style="color:#cbd5e1;line-height:1.6;margin:0;">
                                            El pago para adquirir <strong style="color:#f8fafc;">${creditNoun}</strong> no pudo procesarse.<br>
                                            Podés intentarlo nuevamente desde el módulo de Investigación.
                                        </p>
                                        <a href="https://judic-ia.com/dashboard/research" style="display:inline-block;margin-top:24px;background:#fbbf24;color:#020617;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Reintentar</a>
                                    </div>
                                    <p style="margin-top:32px;font-size:12px;color:#475569;text-align:center;">© ${new Date().getFullYear()} Judic-IA. Todos los derechos reservados.</p>
                                </div>
                            `
                        });
                        console.log(`📧 Email de pago fallido enviado a: ${userEmail}`);
                    }

                    // Auditoría interna
                    await notifyBilling(resend, {
                        subject: `❌ Pago rechazado — ${opType}`,
                        rows: [
                            { label: 'Operación',       value: opType },
                            { label: 'Estado',          value: `❌ ${payment.status} / ${payment.status_detail ?? '—'}` },
                            { label: 'Abogado',         value: userName },
                            { label: 'Email',           value: userEmail },
                            { label: 'User ID',         value: userId },
                            { label: 'MP Payment ID',   value: String(mpId) },
                            { label: 'Purchase ID (DB)',value: purchaseId },
                            { label: 'Fecha/hora',      value: new Date().toISOString() },
                        ],
                    });
                } catch (emailErr) {
                    console.error('Error enviando emails de pago fallido:', emailErr?.message);
                }
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

        // 3) Detectar si es suscripción de estudio u de abogado individual
        const externalRef = sub.external_reference;
        if (!externalRef) {
            console.warn("⚠️ No external_reference in subscription");
            return NextResponse.json({ ok: true });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // ─── SUSCRIPCIÓN ENTERPRISE (org) ────────────────────────────────────────
        if (externalRef.startsWith('org_sub:')) {
            const orgId = externalRef.replace('org_sub:', '');
            console.log(`[webhook] Org subscription event — status: ${sub.status}, orgId: ${orgId}`);

            const orgPatch = {
                mp_preapproval_id: sub.id,
                mp_subscription_status: sub.status,
            };

            const now = new Date();

            if (sub.status === 'authorized') {
                const expiryDate = new Date(now);
                expiryDate.setDate(expiryDate.getDate() + 30);

                orgPatch.subscription_status = 'active';
                orgPatch.subscription_started_at = now.toISOString();
                orgPatch.subscription_expiry = expiryDate.toISOString();

                // Verificar si es primer alta (para emails y auditoría)
                const { data: currentOrg } = await supabase
                    .from('organizations')
                    .select('subscription_status, razon_social, owner_id, plan_tier')
                    .eq('id', orgId)
                    .single();

                const isFreshSubscription = currentOrg?.subscription_status !== 'active';

                await supabase.from('organizations').update(orgPatch).eq('id', orgId);

                if (isFreshSubscription && currentOrg?.owner_id) {
                    try {
                        const [{ data: ownerAuth }, { data: ownerProfile }] = await Promise.all([
                            supabase.auth.admin.getUserById(currentOrg.owner_id),
                            supabase.from('profiles').select('full_name').eq('id', currentOrg.owner_id).maybeSingle(),
                        ]);
                        const ownerEmail = ownerAuth?.user?.email;
                        const ownerName = ownerProfile?.full_name || 'Titular';
                        const amount = Math.round(sub.auto_recurring?.transaction_amount || 0);
                        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';

                        if (ownerEmail) {
                            await resend.emails.send({
                                from: 'billing@judic-ia.com',
                                to: ownerEmail,
                                subject: 'Suscripción Enterprise activada — Judic-IA ⚖️',
                                html: `
                                    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#020617;color:#f8fafc;padding:40px;border-radius:12px;border:1px solid #1e293b;">
                                        <h1 style="color:#fbbf24;margin:0 0 4px;font-size:28px;">Judic-IA</h1>
                                        <p style="color:#94a3b8;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 32px;">Confirmación de suscripción</p>
                                        <div style="background:rgba(255,255,255,0.03);padding:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);text-align:center;">
                                            <p style="font-size:48px;margin:0 0 16px;">🏛️</p>
                                            <h2 style="color:#f8fafc;margin-top:0;">¡El estudio está operativo!</h2>
                                            <p style="color:#cbd5e1;line-height:1.6;margin:0;">
                                                Hola <strong>${ownerName}</strong>, la suscripción Enterprise de <strong>${currentOrg.razon_social}</strong> fue activada correctamente.<br>
                                                Ya podés invitar a tu equipo y comenzar a operar.
                                            </p>
                                            <a href="${appUrl}/dashboard/estudio" style="display:inline-block;margin-top:24px;background:#fbbf24;color:#020617;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Ir al Panel del Estudio</a>
                                        </div>
                                        <p style="margin-top:32px;font-size:12px;color:#475569;text-align:center;">© ${new Date().getFullYear()} Judic-IA.</p>
                                    </div>
                                `,
                            });
                        }

                        await notifyBilling(resend, {
                            subject: `✅ Suscripción Enterprise activada — ${currentOrg.razon_social}`,
                            rows: [
                                { label: 'Operación',         value: 'Nueva suscripción Enterprise' },
                                { label: 'Estado',            value: '✅ Autorizado' },
                                { label: 'Estudio',           value: currentOrg.razon_social },
                                { label: 'Plan',              value: currentOrg.plan_tier },
                                { label: 'Owner email',       value: ownerEmail },
                                { label: 'Org ID',            value: orgId },
                                { label: 'Monto',             value: `ARS ${amount}` },
                                { label: 'MP Preapproval ID', value: sub.id },
                                { label: 'Próximo cobro',     value: sub.next_payment_date ?? '—' },
                                { label: 'Fecha/hora',        value: now.toISOString() },
                            ],
                        });
                    } catch (emailErr) {
                        console.error('[webhook org-sub] Email/audit error:', emailErr.message);
                    }
                }
            }

            if (sub.status === 'paused' || sub.status === 'cancelled') {
                orgPatch.subscription_status = 'cancelled';
                await supabase.from('organizations').update(orgPatch).eq('id', orgId);
                console.log(`[webhook] Org subscription cancelled: ${orgId}`);
            }

            if (sub.status === 'payment_required' || sub.status === 'pending') {
                const gracePeriod = new Date(now);
                gracePeriod.setDate(gracePeriod.getDate() + 7);
                orgPatch.subscription_status = 'past_due';
                orgPatch.subscription_expiry = gracePeriod.toISOString();
                await supabase.from('organizations').update(orgPatch).eq('id', orgId);
                console.log(`[webhook] Org subscription past_due (grace until ${gracePeriod.toISOString()}): ${orgId}`);
            }

            return NextResponse.json({ ok: true });
        }

        // ─── SUSCRIPCIÓN INDIVIDUAL (abogado) — flujo existente ────────────────
        const userId = externalRef;

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

        // 6) Emails y factura en cada pago autorizado de suscripción
        if (sub.status === "authorized") {
            const [{ data: userData }, { data: profileData }] = await Promise.all([
                supabase.auth.admin.getUserById(userId),
                supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
            ]);
            const userEmail = userData?.user?.email;
            const userName = profileData?.full_name || 'Consumidor Final';
            const amount = Math.round(sub.auto_recurring?.transaction_amount || 25000);

            // Email de bienvenida solo si es primer upgrade
            if (userEmail && isFreshUpgrade) {
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

            // Factura (solo si es primer upgrade)
            if (isFreshUpgrade) {
                const { error: invoiceError } = await supabase.from("invoices").insert({
                    user_id: userId,
                    status: 'pending',
                    description: 'Suscripción Mensual - Judic-IA Suite Pro',
                    amount,
                    payment_date: new Date().toISOString(),
                    client_name: userName,
                    invoice_type: 'C'
                });
                if (invoiceError) {
                    console.error("Error creating invoice:", invoiceError);
                } else {
                    console.log("📄 Pending invoice created for user:", userId);
                }
            }

            // Auditoría interna — SIEMPRE (primer pago o renovación mensual)
            await notifyBilling(resend, {
                subject: `✅ Suscripción autorizada — ${isFreshUpgrade ? 'Nuevo alta' : 'Renovación mensual'}`,
                rows: [
                    { label: 'Operación',           value: isFreshUpgrade ? 'Nueva suscripción Profesional' : 'Renovación mensual Profesional' },
                    { label: 'Estado',              value: '✅ Autorizado' },
                    { label: 'Abogado',             value: userName },
                    { label: 'Email',               value: userEmail },
                    { label: 'User ID',             value: userId },
                    { label: 'Monto',               value: `ARS ${amount}` },
                    { label: 'MP Preapproval ID',   value: sub.id },
                    { label: 'MP Status',           value: sub.status },
                    { label: 'Próximo cobro',       value: sub.next_payment_date ?? '—' },
                    { label: 'Fecha/hora',          value: new Date().toISOString() },
                ],
            });
        }

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error("Webhook Handler Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
