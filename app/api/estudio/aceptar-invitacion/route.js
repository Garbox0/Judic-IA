import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { sendEmail } from '@/app/lib/resend';
import { getHtmlEmail } from '@/lib/email-template';
import { isValidUUID, isValidString } from '@/lib/validation';

export async function POST(request) {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });

    const { token, first_name, last_name, password, matricula_colegio, matricula_tomo, matricula_folio } = body;

    // Validar formato de token antes de tocar la DB
    if (!isValidUUID(token)) return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    if (!isValidString(first_name, 100) || !isValidString(last_name, 100)) {
        return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    // 1. Validar token — single source of truth para email y org
    const { data: inv, error: invErr } = await supabase
        .from('org_invitations')
        .select('id, email, role, status, expires_at, org_id, org:org_id(name, razon_social, type, verification_status)')
        .eq('token', token)
        .single();

    if (invErr || !inv) return NextResponse.json({ error: 'Invitación inválida' }, { status: 404 });
    if (inv.status !== 'pending') return NextResponse.json({ error: 'Invitación ya utilizada o cancelada' }, { status: 410 });
    if (new Date(inv.expires_at) < new Date()) return NextResponse.json({ error: 'Invitación expirada' }, { status: 410 });

    // Verificar que la org sigue siendo un estudio verificado
    if (!inv.org || inv.org.type !== 'estudio' || inv.org.verification_status !== 'verified') {
        return NextResponse.json({ error: 'El estudio no está verificado' }, { status: 403 });
    }

    const { email, role, org_id } = inv;
    const fullName = `${first_name} ${last_name}`;
    const orgName = inv.org?.razon_social || inv.org?.name || 'el estudio';
    const matricula = matricula_tomo && matricula_folio ? `T° ${matricula_tomo} F° ${matricula_folio}` : null;
    const matriculas = matricula_tomo && matricula_folio
        ? [{ colegio: matricula_colegio || '', tomo: matricula_tomo, folio: matricula_folio }]
        : [];

    // 2. Buscar si el email ya tiene cuenta — búsqueda directa, no paginada
    // Supabase Admin permite filtrar por email directamente
    const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1,
        // Nota: el filtro exacto por email se hace en la app, listUsers trae ordenado por created_at
        // pero usamos una segunda estrategia: query directa a auth.users via rpc si está disponible
    });

    // Estrategia robusta: buscar via profiles (email no está en profiles, pero sí en auth.users)
    // Usamos getUserByEmail si está disponible, sino paginamos correctamente
    let existingUser = null;

    // Buscar el usuario directamente por email usando auth admin
    try {
        // Intentar query directa a auth.users via service role
        const { data: authData } = await supabase
            .rpc('get_auth_user_by_email', { p_email: email.toLowerCase() })
            .maybeSingle();

        if (authData?.id) {
            existingUser = { id: authData.id };
        }
    } catch {
        // Si el RPC no existe, fallback: paginar listUsers hasta encontrar el email
        let page = 1;
        let found = false;
        while (!found) {
            const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({
                page,
                perPage: 1000,
            });
            if (listErr || !users || users.length === 0) break;
            const match = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
            if (match) { existingUser = match; found = true; break; }
            if (users.length < 1000) break; // última página
            page++;
        }
    }

    let userId;

    if (existingUser) {
        // Usuario ya existe → agregar al estudio
        userId = existingUser.id;

        // Verificar que no sea ya miembro de esta org
        const { data: existingMember } = await supabase
            .from('org_members')
            .select('id')
            .eq('user_id', userId)
            .eq('org_id', org_id)
            .maybeSingle();

        if (existingMember) {
            return NextResponse.json({ error: 'Ya sos miembro de este estudio' }, { status: 409 });
        }
    } else {
        // Crear nuevo usuario
        if (!password || password.length < 8) {
            return NextResponse.json({ error: 'Contraseña requerida (mínimo 8 caracteres)' }, { status: 400 });
        }

        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                first_name,
                last_name,
                full_name: fullName,
                role: 'lawyer',
                matricula,
                jurisdiccion: matricula_colegio || '',
                matriculas,
            },
        });

        if (authErr) {
            console.error('[aceptar-invitacion] Auth error:', authErr);
            return NextResponse.json({ error: 'Error al crear el usuario' }, { status: 500 });
        }

        userId = authData.user.id;

        await supabase.from('profiles').update({
            full_name: fullName,
            plan_tier: 'enterprise_member',
            ...(matricula ? { matricula, jurisdiccion: matricula_colegio || '', matriculas } : {}),
        }).eq('id', userId);
    }

    // 3. Agregar a org_members
    await supabase.from('org_members').insert({ org_id, user_id: userId, role });

    // 4. Actualizar org_id en profile
    await supabase.from('profiles').update({ org_id }).eq('id', userId);

    // 5. Marcar invitación como aceptada
    await supabase.from('org_invitations').update({ status: 'accepted' }).eq('id', inv.id);

    // 6. Email de bienvenida (fire-and-forget)
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';
        sendEmail({
            resendClient: resend,
            to: email,
            from: 'Judic-IA <soporte@judic-ia.com>',
            subject: `Bienvenido/a a ${orgName} en Judic-IA`,
            html: getHtmlEmail({
                heading: 'Ya sos parte del estudio',
                bodyContent: `
                    <p>Hola ${first_name},</p>
                    <p>Tu cuenta fue configurada exitosamente. Ya podés acceder al panel de <strong>${orgName}</strong> en Judic-IA.</p>
                    <p>Usá tu email <strong>${email}</strong> para iniciar sesión.</p>
                `,
                buttonText: 'Acceder al panel',
                buttonUrl: `${appUrl}/dashboard/estudio`,
                footerLinks: [],
            }),
        }).catch(err => console.error('[aceptar-invitacion] Email error:', err));
    }

    return NextResponse.json({ success: true });
}
