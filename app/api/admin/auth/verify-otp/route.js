import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIP } from '@/lib/rate-limiter';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        // 🛡️ Require auth header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'No autorizado — falta token' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
            authHeader.replace('Bearer ', '')
        );
        if (authError || !user) {
            return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
        }

        const { email, otp } = await request.json();

        if (!email || !otp) {
            return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
        }

        // 🛡️ Email in token must match email in OTP request
        if (user.email !== email) {
            console.warn(`⚠️ OTP email mismatch: token=${user.email}, request=${email}`);
            return NextResponse.json({ error: 'Email no coincide con sesión activa' }, { status: 403 });
        }

        // 🛡️ Rate limiting: 5 attempts per minute per IP (brute-force protection)
        const ip = getClientIP(request);
        const rateCheck = checkRateLimit(`verify-otp:${ip}`, 5, 60000);
        if (!rateCheck.allowed) {
            console.warn(`⚠️ OTP brute-force attempt blocked: ${ip}`);
            return NextResponse.json(
                { error: 'Demasiados intentos. Esperá 1 minuto.' },
                { status: 429, headers: { 'Retry-After': '60' } }
            );
        }

        // 1. Verify OTP in DB
        const { data: record, error } = await supabaseAdmin
            .from('admin_otps')
            .select('*')
            .eq('email', email)
            .eq('otp_code', otp)
            .eq('verified', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !record) {
            return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 401 });
        }

        // 2. Mark as verified (prevent reuse)
        await supabaseAdmin
            .from('admin_otps')
            .update({ verified: true })
            .eq('id', record.id);

        // 3. Return Success with timestamp for AdminGuard
        const verifiedAt = Date.now();
        return NextResponse.json({ success: true, verifiedAt });

    } catch (error) {
        console.error('Verify OTP Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
