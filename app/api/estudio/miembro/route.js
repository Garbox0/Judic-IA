import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidUUID } from '@/lib/validation';

const VALID_ROLES = ['abogado', 'supervisor'];

function makeClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );
}

async function resolveCallerContext(supabase, authHeader) {
    if (!authHeader) return null;
    const { data: { user }, error } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
    );
    if (error || !user) return null;

    const { data: prof } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

    if (!prof?.org_id) return null;

    const { data: myMember } = await supabase
        .from('org_members')
        .select('role, org:org_id(type, verification_status)')
        .eq('user_id', user.id)
        .eq('org_id', prof.org_id)
        .single();

    if (!myMember) return null;

    return { userId: user.id, orgId: prof.org_id, myRole: myMember.role, org: myMember.org };
}

// DELETE — remover miembro del estudio
// Los casos que tenía asignados vuelven a la bandeja (assigned_to = null)
export async function DELETE(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const supabase = makeClient();
    const ctx = await resolveCallerContext(supabase, authHeader);
    if (!ctx) return NextResponse.json({ error: 'No autenticado o sin estudio' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const { target_user_id } = body || {};
    if (!isValidUUID(target_user_id)) {
        return NextResponse.json({ error: 'target_user_id inválido' }, { status: 400 });
    }
    if (ctx.userId === target_user_id) {
        return NextResponse.json({ error: 'No podés removerte a vos mismo' }, { status: 400 });
    }
    if (ctx.myRole !== 'owner') {
        return NextResponse.json({ error: 'Solo el titular puede remover miembros' }, { status: 403 });
    }
    if (!ctx.org || ctx.org.type !== 'estudio' || ctx.org.verification_status !== 'verified') {
        return NextResponse.json({ error: 'Estudio no verificado' }, { status: 403 });
    }

    const { data: targetMember } = await supabase
        .from('org_members')
        .select('role')
        .eq('user_id', target_user_id)
        .eq('org_id', ctx.orgId)
        .single();

    if (!targetMember) {
        return NextResponse.json({ error: 'El miembro no existe en este estudio' }, { status: 404 });
    }
    if (targetMember.role === 'owner') {
        return NextResponse.json({ error: 'No podés remover al titular' }, { status: 403 });
    }

    // Liberar todos los casos del miembro removido → vuelven a la bandeja
    await supabase
        .from('cases')
        .update({ assigned_to: null })
        .eq('assigned_to', target_user_id)
        .eq('org_id', ctx.orgId);

    // Remover de org_members
    await supabase
        .from('org_members')
        .delete()
        .eq('user_id', target_user_id)
        .eq('org_id', ctx.orgId);

    // Limpiar org_id y revertir plan_tier
    await supabase
        .from('profiles')
        .update({ org_id: null, plan_tier: 'starter' })
        .eq('id', target_user_id);

    return NextResponse.json({ success: true });
}

// PATCH — cambiar el rol de un miembro (owner only)
// Solo puede cambiar entre 'abogado' y 'supervisor'. No puede promover a 'owner'.
export async function PATCH(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const supabase = makeClient();
    const ctx = await resolveCallerContext(supabase, authHeader);
    if (!ctx) return NextResponse.json({ error: 'No autenticado o sin estudio' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const { target_user_id, new_role } = body || {};

    if (!isValidUUID(target_user_id)) {
        return NextResponse.json({ error: 'target_user_id inválido' }, { status: 400 });
    }
    if (!VALID_ROLES.includes(new_role)) {
        return NextResponse.json({ error: 'Rol inválido. Debe ser "abogado" o "supervisor"' }, { status: 400 });
    }
    if (ctx.userId === target_user_id) {
        return NextResponse.json({ error: 'No podés cambiar tu propio rol' }, { status: 400 });
    }
    if (ctx.myRole !== 'owner') {
        return NextResponse.json({ error: 'Solo el titular puede cambiar roles' }, { status: 403 });
    }
    if (!ctx.org || ctx.org.type !== 'estudio' || ctx.org.verification_status !== 'verified') {
        return NextResponse.json({ error: 'Estudio no verificado' }, { status: 403 });
    }

    const { data: targetMember } = await supabase
        .from('org_members')
        .select('role')
        .eq('user_id', target_user_id)
        .eq('org_id', ctx.orgId)
        .single();

    if (!targetMember) {
        return NextResponse.json({ error: 'El miembro no existe en este estudio' }, { status: 404 });
    }
    if (targetMember.role === 'owner') {
        return NextResponse.json({ error: 'No podés cambiar el rol del titular' }, { status: 403 });
    }
    if (targetMember.role === new_role) {
        return NextResponse.json({ error: 'El miembro ya tiene ese rol' }, { status: 409 });
    }

    await supabase
        .from('org_members')
        .update({ role: new_role })
        .eq('user_id', target_user_id)
        .eq('org_id', ctx.orgId);

    return NextResponse.json({ success: true });
}
