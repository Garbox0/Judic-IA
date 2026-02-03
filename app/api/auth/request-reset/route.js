import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendEmail } from '../../../lib/resend';
import { getHtmlEmail } from '../../../../lib/email-template';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIP } from '../../../../lib/rate-limiter';

export async function POST(request) {
    // 🛡️ Rate Limiting (3 requests per minute per IP)
    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(`reset:${ip}`, 3, 60000);

    if (!rateCheck.allowed) {
        console.warn(`⚠️ Rate limit exceeded for password reset: ${ip}`);
        return NextResponse.json(
            { error: 'Demasiadas solicitudes. Intenta de nuevo en 1 minuto.' },
            { status: 429, headers: { 'Retry-After': Math.ceil(rateCheck.resetIn / 1000).toString() } }
        );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!resendApiKey) {
        return NextResponse.json({ error: "Configuration Error: Resend API Key missing" }, { status: 500 });
    }
    if (!serviceRoleKey) {
        return NextResponse.json({ error: "Configuration Error: Supabase Service Key missing" }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        const body = await request.json();
        const { email, redirectTo } = body;

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }


        // 1. Generate Recovery Link via Supabase Admin
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: {
                redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com'}/update-password`
            }
        });

        if (error) {
            console.warn("Supabase Generate Link Error (User might not exist):", error.message);
            // SECURITY: Always return success to prevent email enumeration.
            // If the user doesn't exist, we just don't send the email.
            return NextResponse.json({ success: true });
        }

        const { action_link } = data.properties;

        // 2. Send Email via Resend
        await sendEmail({
            resendClient: resend,
            to: email,
            from: 'noreply@judic-ia.com',
            subject: '🔐 Recupera tu acceso a Judic-IA',
            html: getHtmlEmail({
                heading: '🔐 Recuperar Acceso',
                bodyContent: `
                    <p>Hola,</p>
                    <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta profesional en <strong>Judic-IA</strong>.</p>
                    <p>Para crear una nueva clave y recuperar el acceso a tu estudio jurídico, haz clic en el siguiente botón:</p>
                `,
                buttonText: 'Restablecer Contraseña',
                buttonUrl: action_link,
                previewText: 'Enlace de recuperación de cuenta Judic-IA'
            })
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Link Generation/Sending Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
