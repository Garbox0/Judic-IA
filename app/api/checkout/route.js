import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, userEmail } = body;
        console.log('📦 Checkout Body:', { userId, userEmail });

        if (!userId) {
            return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const webhookUrl = process.env.WEBHOOK_URL || siteUrl;

        const preference = new Preference(client);

        const preferenceData = {
            body: {
                items: [
                    {
                        id: 'plan-pro-mensual',
                        title: 'Judic-IA Suite Pro - Subscripción Mensual',
                        unit_price: 15000,
                        quantity: 1,
                        currency_id: 'ARS',
                    }
                ],
                payer: {
                    email: siteUrl.includes('localhost') ? 'test_user_666@testuser.com' : userEmail,
                },
                back_urls: {
                    success: `${siteUrl}/dashboard/settings?status=success`,
                    failure: `${siteUrl}/dashboard/settings?status=failure`,
                    pending: `${siteUrl}/dashboard/settings?status=pending`,
                },
                auto_return: siteUrl.includes('localhost') ? undefined : 'approved',
                notification_url: `${webhookUrl}/api/webhooks/mercadopago`,
                external_reference: userId,
            }
        };

        const result = await preference.create(preferenceData);

        console.log('✅ Preference Created:', result.id);
        return new Response(JSON.stringify({ id: result.id, init_point: result.init_point }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('❌ Preference Error:', error);
        return new Response(JSON.stringify({
            error: error.message,
            details: error.cause || null
        }), { status: 500 });
    }
}
