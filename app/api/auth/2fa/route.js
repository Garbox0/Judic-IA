import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getHtmlEmail } from '../../../../../lib/email-template';
import { checkRateLimit, getClientIP } from '../../../../lib/rate-limiter';

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

async function getAuthUser(request) {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    const supabase = getAdminClient();
    const { data: { user } } = await supabase.auth.getUser(auth.slice(7));
    return user || null;
}

// POST /api/auth/2fa — enviar OTP al email del usuario
export async function POST(request) {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(`2fa-send:${user.id}:${ip}`, 3, 60000);
    if (!rateCheck.allowed) {
        return NextResponse.json(
            { error: 'Demasiados intentos. Esperá 1 minuto.' },
            { status: 429, headers: { 'Retry-After': '60' } }
        );
    }

    let purpose = 'login';
    try {
        const body = await request.json().catch(() => ({}));
        if (['login', 'enable_2fa', 'disable_2fa'].includes(body.purpose)) {
            purpose = body.purpose;
        }
    } catch { /* no body */ }

    const supabase = getAdminClient();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    const { error: dbError } = await supabase.from('user_otps').insert({
        user_id: user.id,
        email: user.email,
        otp_code: otp,
        purpose,
        expires_at: expiresAt,
        verified: false
    });

    if (dbError) {
        console.error('[2FA] DB error:', dbError);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }

    const purposeLabels = {
        login: 'iniciar sesión',
        enable_2fa: 'activar la verificación en dos pasos',
        disable_2fa: 'desactivar la verificación en dos pasos'
    };

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: emailError } = await resend.emails.send({
        from: 'Judic-IA <noreply@judic-ia.com>',
        to: user.email,
        subject: `Tu código de verificación — Judic-IA`,
        html: getHtmlEmail({
            heading: 'Verificación en dos pasos',
            bodyContent: `
                <p>Hola,</p>
                <p>Usá el siguiente código para ${purposeLabels[purpose]}. Expira en <strong>10 minutos</strong>.</p>
                <p style="font-size:12px; color:#64748b;">Si no fuiste vos, ignorá este mensaje.</p>
            `,
            otpCode: otp
        })
    });

    if (emailError) {
        console.error('[2FA] Email error:', emailError);
        return NextResponse.json({ error: 'Error al enviar el código' }, { status: 500 });
    }

    return NextResponse.json({ success: true, email: user.email });
}

// PUT /api/auth/2fa — verificar OTP (+ acción opcional: enable/disable)
export async function PUT(request) {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(`2fa-verify:${user.id}:${ip}`, 5, 60000);
    if (!rateCheck.allowed) {
        return NextResponse.json(
            { error: 'Demasiados intentos. Esperá 1 minuto.' },
            { status: 429, headers: { 'Retry-After': '60' } }
        );
    }

    let body;
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }

    const { otp, purpose } = body;
    if (!otp || !purpose) {
        return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: record, error } = await supabase
        .from('user_otps')
        .select('*')
        .eq('user_id', user.id)
        .eq('otp_code', otp)
        .eq('purpose', purpose)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !record) {
        return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 401 });
    }

    // Marcar como usado
    await supabase.from('user_otps').update({ verified: true }).eq('id', record.id);

    // Aplicar cambio de configuración si corresponde
    if (purpose === 'enable_2fa') {
        await supabase.from('profiles').update({ two_factor_email: true }).eq('id', user.id);
    } else if (purpose === 'disable_2fa') {
        await supabase.from('profiles').update({ two_factor_email: false }).eq('id', user.id);
    } else if (purpose === 'login') {
        // Registrar verificación 2FA en app_metadata (JWT firmado, no manipulable desde el browser)
        await supabase.auth.admin.updateUserById(user.id, {
            app_metadata: { two_fa_verified_at: Date.now() }
        });
    }

    return NextResponse.json({ success: true });
}
