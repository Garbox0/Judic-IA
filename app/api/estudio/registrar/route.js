/**
 * POST /api/estudio/registrar
 *
 * Registro público de un nuevo Estudio Jurídico.
 * Crea el usuario (titular), su perfil, la organización y el vínculo owner.
 * El estudio queda en verification_status: 'pending' hasta aprobación manual del admin.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VALID_PLANS = ['enterprise_s', 'enterprise_m', 'enterprise_l', 'enterprise_xl'];
const MEMBER_LIMITS = { enterprise_s: 5, enterprise_m: 10, enterprise_l: 20, enterprise_xl: null };

export async function POST(request) {
    const body = await request.json().catch(() => null);

    if (!body) {
        return NextResponse.json({ error: 'Cuerpo de solicitud inválido.' }, { status: 400 });
    }

    const {
        razon_social, cuit, domicilio, phone,
        first_name, last_name, email, password,
        matriculas, plan_tier,
    } = body;

    // Validar campos obligatorios
    if (!razon_social || !cuit || !domicilio || !phone) {
        return NextResponse.json({ error: 'Faltan datos del estudio.' }, { status: 400 });
    }
    if (!first_name || !last_name || !email || !password) {
        return NextResponse.json({ error: 'Faltan datos del titular.' }, { status: 400 });
    }
    if (!Array.isArray(matriculas) || matriculas.length === 0) {
        return NextResponse.json({ error: 'El titular debe tener al menos una matrícula.' }, { status: 400 });
    }
    if (!VALID_PLANS.includes(plan_tier)) {
        return NextResponse.json({ error: 'Plan inválido.' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    // 1. Crear usuario en Supabase Auth
    const fullName = `${first_name} ${last_name}`;
    const m0 = matriculas[0];
    const finalMatricula = `T° ${m0.tomo} F° ${m0.folio}`;
    const finalJurisdiccion = m0.colegio;

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: {
            first_name,
            last_name,
            full_name: fullName,
            role: 'lawyer',
            matricula: finalMatricula,
            jurisdiccion: finalJurisdiccion,
            matriculas,
        },
    });

    if (authErr) {
        const msg = authErr.message?.toLowerCase() || '';
        if (msg.includes('already registered') || msg.includes('already exists')) {
            return NextResponse.json({ error: 'Este email ya está registrado.' }, { status: 409 });
        }
        console.error('[estudio/registrar] Auth error:', authErr);
        return NextResponse.json({ error: 'Error al crear el usuario.' }, { status: 500 });
    }

    const userId = authData.user.id;

    try {
        // 2. Actualizar perfil con datos del titular
        await supabase
            .from('profiles')
            .update({
                full_name: fullName,
                plan_tier: 'pending_enterprise',
                matricula: finalMatricula,
                jurisdiccion: finalJurisdiccion,
                matriculas,
                verification_status: 'pending',
            })
            .eq('id', userId);

        // 3. Crear la organización
        const { data: org, error: orgErr } = await supabase
            .from('organizations')
            .insert({
                name: razon_social,
                owner_id: userId,
                type: 'estudio',
                verification_status: 'pending',
                razon_social,
                cuit,
                domicilio,
                phone,
                plan_tier,
                member_limit: MEMBER_LIMITS[plan_tier],
                settings: {},
            })
            .select('id')
            .single();

        if (orgErr) throw orgErr;

        const orgId = org.id;

        // 4. Crear vínculo owner
        await supabase
            .from('org_members')
            .insert({ org_id: orgId, user_id: userId, role: 'owner' });

        // 5. Actualizar perfil con org_id
        await supabase
            .from('profiles')
            .update({ org_id: orgId })
            .eq('id', userId);

        // 6. Notificar al admin (fire-and-forget)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';
        fetch(`${appUrl}/api/admin/notify-estudio-registration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                razon_social,
                cuit,
                domicilio,
                phone,
                titular_name: fullName,
                titular_email: email,
                matriculas,
                plan_tier,
                org_id: orgId,
            }),
        }).catch(err => console.error('[estudio/registrar] Notify admin failed:', err));

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error('[estudio/registrar] Error:', err.message);
        // Intentar limpiar el usuario creado si algo falló
        await supabase.auth.admin.deleteUser(userId).catch(() => {});
        return NextResponse.json({ error: 'Error al registrar el estudio. Intentá nuevamente.' }, { status: 500 });
    }
}
