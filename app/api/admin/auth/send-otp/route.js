import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getHtmlEmail } from '../../../../../lib/email-template';

// Use Service Role to write to admin_otps table (bypass RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
    try {
        // 1. Verify Requesting User (Must be authenticated via Supabase Auth)
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

        // 2. (Optional) Verify User is actually an Admin
        // For now, we assume anyone accessing this route (protected by UI) is trying to get in.
        // But better to check role if possible. 
        // We'll proceed with sending to the user's email.

        // 3. Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // 4. Store in admin_otps
        const { error: dbError } = await supabaseAdmin
            .from('admin_otps')
            .insert({
                email: user.email,
                otp_code: otp,
                expires_at: expiresAt,
                verified: false
            });

        if (dbError) throw dbError;

        // 5. Send Email
        const { error: emailError } = await resend.emails.send({
            from: 'Seguridad Judic-IA <security@judic-ia.com>',
            to: user.email,
            subject: '🛡️ Tu Código de Acceso Admin',
            html: getHtmlEmail({
                heading: 'Acceso Administrativo',
                bodyContent: `
                    <p>Alguien (esperamos que tú) está intentando acceder al Panel de Administración de Judic-IA.</p>
                    <p>Usa el siguiente código para verificar tu identidad:</p>
                `,
                otpCode: otp
            })
        });

        if (emailError) {
            console.error('Email Error:', emailError);
            throw new Error('Error enviando email');
        }

        return NextResponse.json({ success: true, email: user.email });

    } catch (error) {
        console.error('Admin OTP Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
