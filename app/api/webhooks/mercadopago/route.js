import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

// Initialize Supabase Admin for backend updates (bypass RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔐 HMAC Signature Validation for MercadoPago Webhooks
function validateMPSignature(req, body) {
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');
    const secret = process.env.MP_WEBHOOK_SECRET;

    if (!secret) {
        console.warn("⚠️ MP_WEBHOOK_SECRET not configured. Signature validation skipped.");
        return { valid: true, reason: 'no_secret_configured' };
    }

    if (!xSignature) {
        return { valid: false, reason: 'missing_signature' };
    }

    const parts = xSignature.split(',');
    const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
    const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1];

    if (!ts || !v1) {
        return { valid: false, reason: 'invalid_signature_format' };
    }

    const dataId = body?.data?.id || body?.id;
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(manifest);
    const calculatedSignature = hmac.digest('hex');

    try {
        const isValid = crypto.timingSafeEqual(
            Buffer.from(v1, 'hex'),
            Buffer.from(calculatedSignature, 'hex')
        );
        return { valid: isValid, reason: isValid ? 'valid' : 'signature_mismatch' };
    } catch {
        return { valid: false, reason: 'signature_comparison_error' };
    }
}

export async function POST(request) {
    try {
        const body = await request.json();

        // 🔐 VALIDATE SIGNATURE
        const signatureCheck = validateMPSignature(request, body);
        if (!signatureCheck.valid) {
            console.warn(`🚫 Legacy webhook signature REJECTED: ${signatureCheck.reason}`);
            return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
        }

        const { type, data } = body;

        // Solo nos interesan las notificaciones de pagos
        if (type === 'payment') {
            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: data.id });

            if (paymentInfo.status === 'approved') {
                const userId = paymentInfo.external_reference;

                // Calculamos la fecha de expiración (30 días desde hoy)
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 30);

                // Actualizamos el perfil del abogado en Supabase
                const { error } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        plan_tier: 'professional',
                        subscription_status: 'active',
                        subscription_expiry: expiryDate,
                        updated_at: new Date()
                    })
                    .eq('id', userId);

                if (error) throw error;
                console.log(`✅ Pago aprobado para usuario: ${userId}`);
            }
        }

        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('Webhook Error:', error);
        return new Response(error.message, { status: 500 });
    }
}
