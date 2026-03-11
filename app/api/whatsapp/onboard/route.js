import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { sendEmail } from '../../../lib/resend';
import { getHtmlEmail } from '../../../../lib/email-template';
import { checkRateLimit } from '../../../../lib/rate-limiter';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';

function normalizePhone(raw) {
    let phone = raw.trim().replace(/[\s\-().]/g, '');
    if (!phone.startsWith('+')) phone = '+' + phone;
    if (phone.replace(/\D/g, '').length < 10) throw new Error('Número inválido');
    return phone;
}

// Called by VPS agent to onboard a new WhatsApp user
export async function POST(request) {
    if (request.headers.get('x-agent-key') !== process.env.AGENT_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phone: rawPhone, email } = await request.json();
    if (!rawPhone || !email) {
        return NextResponse.json({ error: 'phone y email requeridos' }, { status: 400 });
    }

    // Rate limit: max 3 onboard attempts per phone per hour
    const rl = checkRateLimit(`wa_onboard:${String(rawPhone).replace(/\D/g, '').slice(-10)}`, 3, 60 * 60 * 1000);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Demasiados intentos. Esperá un momento.' }, { status: 429 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: 'email_invalido' }, { status: 400 });
    }

    let phone;
    try { phone = normalizePhone(rawPhone); }
    catch { return NextResponse.json({ error: 'phone_invalido' }, { status: 400 }); }

    // 1. Check if phone already registered
    const { data: existingByPhone } = await supabase
        .from('profiles')
        .select('id, whatsapp_sub_status')
        .eq('whatsapp_phone', phone)
        .maybeSingle();

    if (existingByPhone) {
        return NextResponse.json({
            ok: true,
            already_registered: true,
            sub_status: existingByPhone.whatsapp_sub_status,
        });
    }

    // 2. Generate magic link (creates user if doesn't exist)
    const redirectTo = `${APP_URL}/dashboard/whatsapp?ref=wa_onboard`;
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email.trim().toLowerCase(),
        options: { redirectTo },
    });

    if (linkError) {
        console.error('[WA Onboard] generateLink error:', linkError.message);
        return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    const userId = linkData?.user?.id;
    const magicLink = linkData?.properties?.action_link;

    // 3. Link phone to profile (upsert in case profile trigger hasn't run yet)
    if (userId) {
        await supabase.from('profiles').upsert({
            id: userId,
            whatsapp_phone: phone,
            whatsapp_onboarded_at: new Date().toISOString(),
        }, { onConflict: 'id' });
    }

    // 4. Send email via Resend
    if (magicLink) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const isNew = !linkData?.user?.confirmed_at;
        const html = getHtmlEmail({
            heading: isNew ? 'Bienvenido a Judic-IA' : 'Accedé a Judic-IA',
            bodyContent: `
                <p>Hacé clic en el botón para ${isNew ? 'crear tu cuenta y ' : ''}acceder a Judic-IA.</p>
                <p>Una vez adentro podrás activar tu suscripción al <strong>Asistente WhatsApp</strong> ($25.000/mes) y empezar a usar el bot.</p>
                <p style="color:#666;font-size:13px;">Este link expira en 1 hora y es de uso único.</p>
            `,
            buttonText: isNew ? 'Crear cuenta y acceder' : 'Ingresar a Judic-IA',
            buttonUrl: magicLink,
        });

        await sendEmail({
            resendClient: resend,
            to: email.trim().toLowerCase(),
            from: 'Judic-IA <no-reply@judic-ia.com>',
            subject: isNew ? 'Activá tu cuenta de Judic-IA' : 'Tu acceso a Judic-IA',
            html,
        });
    }

    return NextResponse.json({ ok: true, isNew: !linkData?.user?.confirmed_at });
}
