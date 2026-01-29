import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getHtmlEmail } from '../../../../lib/email-template';

// Use Service Role for Admin actions
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
    try {
        // 1. Verify User Session (Standard Client)
        // We verify the user initiating the request actually owns the session
        // However, we can't trust the client-side user object alone for sensitive deletes.
        // We rely on the session token passed in headers/cookies if we used createServerClient
        // For simplicity and security, we'll assume the client is authenticated via middleware
        // and we get the user ID from the request body or re-verify.

        // BETTER: Get user from auth header token to ensure identity
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
