import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

// Initialize Supabase Admin for backend updates (bypass RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        const body = await request.json();
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
