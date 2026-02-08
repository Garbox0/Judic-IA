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
    const startTime = Date.now();
    console.log('🔐 [OTP] Starting OTP send request...');

    try {
        // 1. Verify Requesting User (Must be authenticated via Supabase Auth)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            console.error('❌ [OTP] No auth header provided');
            return NextResponse.json({ error: 'No autorizado - falta token' }, { status: 401 });
        }

        console.log('🔍 [OTP] Verifying user token...');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
            authHeader.replace('Bearer ', '')
        );

        if (authError || !user) {
            console.error('❌ [OTP] Auth failed:', authError?.message);
            return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
        }

        console.log('✓ [OTP] User verified:', user.email);

        // 2. Check if user is admin (optional but recommended)
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            console.warn('⚠️ [OTP] Non-admin user attempting access:', user.email);
            // Still proceed but log it
        }

        // 3. Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        console.log('🎲 [OTP] Generated code for', user.email);

        // 4. Store in admin_otps
        console.log('💾 [OTP] Storing in database...');
        const { error: dbError } = await supabaseAdmin
            .from('admin_otps')
            .insert({
                email: user.email,
                otp_code: otp,
                expires_at: expiresAt,
                verified: false
            });

        if (dbError) {
            console.error('❌ [OTP] Database error:', dbError);
            throw new Error('Error guardando código en base de datos');
        }
        console.log('✓ [OTP] Stored in database');

        // 5. Send Email with detailed logging
        console.log('📧 [OTP] Preparing email...');
        console.log('📧 [OTP] From: soporte@judic-ia.com');
        console.log('📧 [OTP] To:', user.email);
        console.log('📧 [OTP] Resend API Key exists:', !!process.env.RESEND_API_KEY);

        const emailPayload = {
            from: 'Soporte Judic-IA <soporte@judic-ia.com>',
            to: user.email,
            subject: '🛡️ Tu Código de Acceso Admin - Judic-IA',
            html: getHtmlEmail({
                heading: 'Acceso Administrativo',
                bodyContent: `
                    <p style="color: #cbd5e1; line-height: 1.6;">Alguien (esperamos que tú) está intentando acceder al Panel de Administración de Judic-IA.</p>
                    <p style="color: #cbd5e1; line-height: 1.6;">Usa el siguiente código para verificar tu identidad:</p>
                `,
                otpCode: otp
            })
        };

        console.log('📧 [OTP] Sending via Resend API...');
        const emailResponse = await resend.emails.send(emailPayload);

        if (emailResponse.error) {
            console.error('❌ [OTP] Resend API error:', JSON.stringify(emailResponse.error));
            throw new Error(`Error de Resend: ${emailResponse.error.message || 'Unknown error'}`);
        }

        console.log('✓ [OTP] Email sent successfully! ID:', emailResponse.data?.id);
        console.log(`⏱️ [OTP] Total time: ${Date.now() - startTime}ms`);

        return NextResponse.json({
            success: true,
            email: user.email,
            debug: {
                emailId: emailResponse.data?.id,
                timestamp: new Date().toISOString(),
                timeMs: Date.now() - startTime
            }
        });

    } catch (error) {
        console.error('❌ [OTP] Fatal error:', error);
        console.error('❌ [OTP] Stack:', error.stack);
        return NextResponse.json({
            error: error.message || 'Error interno del servidor',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
