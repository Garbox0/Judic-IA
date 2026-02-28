import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { sendEmail } from '@/app/lib/resend';
import { getHtmlEmail } from '@/lib/email-template';
import { randomUUID } from 'crypto';
import { isValidEmail } from '@/lib/validation';
import { checkRateLimit, getClientIP } from '@/lib/rate-limiter';

const ROLE_LABELS = { abogado: 'Abogado', supervisor: 'Supervisor' };
const VALID_ROLES = ['abogado', 'supervisor'];

export async function POST(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // Rate limit: 10 invitaciones por IP por hora
    const ip = getClientIP(request);
    const rl = checkRateLimit(`invitar:${ip}`, 10, 60 * 60 * 1000);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Demasiadas solicitudes. Intentá más tarde.' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const { email, role } = body || {};

    if (!isValidEmail(email)) return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const userId = user.id;

    const { data: prof } = await supabase
        .from('profiles')
        .select('org_id, full_name')
        .eq('id', userId)
        .single();

    if (!prof?.org_id) {
        return NextResponse.json({ error: 'No pertenecés a ningún estudio' }, { status: 403 });
    }

    const orgId = prof.org_id;

    // Verificar rol, tipo de org y estado de verificación en un solo query
    const { data: myMember } = await supabase
        .from('org_members')
        .select('role, org:org_id(razon_social, name, member_limit, type, verification_status)')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .single();

    if (myMember?.role !== 'owner') {
        return NextResponse.json({ error: 'Solo el titular puede invitar miembros' }, { status: 403 });
    }

    const org = myMember.org;

    if (!org || org.type !== 'estudio' || org.verification_status !== 'verified') {
        return NextResponse.json({ error: 'El estudio no está verificado' }, { status: 403 });
    }

    const orgName = org.razon_social || org.name || 'el estudio';

    // Verificar límite de miembros
    const { count: currentCount } = await supabase
        .from('org_members')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

    if (org.member_limit !== null && currentCount >= org.member_limit) {
        return NextResponse.json({ error: 'Se alcanzó el límite de miembros del plan' }, { status: 403 });
    }

    // Verificar que no haya invitación pendiente para ese email en esta org
    const { data: existingInvite } = await supabase
        .from('org_invitations')
        .select('id')
        .eq('org_id', orgId)
        .eq('email', email.toLowerCase())
        .eq('status', 'pending')
        .maybeSingle();

    if (existingInvite) {
        return NextResponse.json({ error: 'Ya existe una invitación pendiente para ese email' }, { status: 409 });
    }

    // Crear token de invitación (48 h)
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error: invErr } = await supabase
        .from('org_invitations')
        .insert({
            org_id: orgId,
            email: email.toLowerCase(),
            role,
            invited_by: userId,
            token,
            expires_at: expiresAt,
            status: 'pending',
        });

    if (invErr) {
        console.error('[invitar] Error creando invitación:', invErr);
        return NextResponse.json({ error: 'Error al crear la invitación' }, { status: 500 });
    }

    // Enviar email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';
    const joinLink = `${appUrl}/registro-estudio/unirse?token=${token}`;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        await sendEmail({
            resendClient: resend,
            to: email,
            from: 'Judic-IA <soporte@judic-ia.com>',
            subject: `Fuiste invitado a unirte a ${orgName} en Judic-IA`,
            html: getHtmlEmail({
                heading: 'Invitación al estudio jurídico',
                bodyContent: `
                    <p>Hola,</p>
                    <p><strong>${prof.full_name || 'El titular del estudio'}</strong> te invitó a unirte a <strong>${orgName}</strong> como <strong>${ROLE_LABELS[role] || role}</strong> en Judic-IA.</p>
                    <p>Hacé clic en el botón para completar tu registro. El link expira en 48 horas.</p>
                `,
                buttonText: 'Aceptar invitación',
                buttonUrl: joinLink,
                footerLinks: [],
            }),
        }).catch(err => console.error('[invitar] Email error:', err));
    }

    return NextResponse.json({ success: true });
}
