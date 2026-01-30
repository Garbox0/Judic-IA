import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getHtmlEmail } from '../../../../lib/email-template';
import { checkRateLimit } from '../../../../lib/rate-limiter';

// Use Service Role for Admin actions
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
    try {
        // 1. Verify User Session
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
            authHeader.replace('Bearer ', '')
        );

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 🛡️ Rate Limiting (2 requests per minute per user)
        const rateCheck = checkRateLimit(`deletion:${user.id}`, 2, 60000);

        if (!rateCheck.allowed) {
            console.warn(`⚠️ Rate limit exceeded for deletion OTP: ${user.id}`);
            return NextResponse.json(
                { error: 'Demasiadas solicitudes. Intenta de nuevo en 1 minuto.' },
                { status: 429, headers: { 'Retry-After': Math.ceil(rateCheck.resetIn / 1000).toString() } }
            );
        }


        // 2. Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // 3. Store OTP
        const { error: dbError } = await supabaseAdmin
            .from('deletion_otps')
            .insert({
                user_id: user.id,
                otp_code: otp,
                expires_at: expiresAt
            });

        if (dbError) throw dbError;

        // 4. Send Email
        const { data: emailData, error: emailError } = await resend.emails.send({
            from: 'Soporte Judic-IA <soporte@judic-ia.com>',
            to: user.email,
            subject: '🚨 CÓDIGO DE ELIMINACIÓN DE CUENTA - Judic-IA',
            html: getHtmlEmail({
                heading: '🚨 Eliminación de Cuenta',
                bodyContent: `
                    <p>Has solicitado eliminar permanentemente tu cuenta de Judic-IA y todos sus datos.</p>
                    <p>Este código expira en 10 minutos.</p>
                    <p><strong>Si no fuiste tú, cambia tu contraseña inmediatamente.</strong></p>
                `,
                otpCode: otp
            })
        });

        if (emailError) {
            console.error('Email Error:', emailError);
            throw new Error('Error enviando email');
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Deletion Request Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
