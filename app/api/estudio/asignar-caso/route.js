import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidUUID } from '@/lib/validation';

// POST — asignar o reasignar un caso a un miembro del estudio (owner o supervisor)
// También sirve para devolver a bandeja: pasar target_user_id = null
export async function POST(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const { case_id, target_user_id } = body || {};

    if (!isValidUUID(case_id)) {
        return NextResponse.json({ error: 'case_id inválido' }, { status: 400 });
    }

    // target_user_id puede ser null (devolver a bandeja) o un UUID válido
    if (target_user_id !== null && target_user_id !== undefined && !isValidUUID(target_user_id)) {
        return NextResponse.json({ error: 'target_user_id inválido' }, { status: 400 });
    }

    // Obtener org del caller
    const { data: prof } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

    if (!prof?.org_id) {
        return NextResponse.json({ error: 'No pertenecés a ningún estudio' }, { status: 403 });
    }

    const orgId = prof.org_id;

    // Verificar que el caller es owner o supervisor de un estudio verificado
    const { data: myMember } = await supabase
        .from('org_members')
        .select('role, org:org_id(type, verification_status)')
        .eq('user_id', user.id)
        .eq('org_id', orgId)
        .single();

    if (!myMember) {
        return NextResponse.json({ error: 'No pertenecés a este estudio' }, { status: 403 });
    }

    const { role: myRole, org } = myMember;

    if (myRole !== 'owner' && myRole !== 'supervisor') {
        return NextResponse.json({ error: 'Solo el titular o supervisores pueden asignar expedientes' }, { status: 403 });
    }

    if (!org || org.type !== 'estudio' || org.verification_status !== 'verified') {
        return NextResponse.json({ error: 'Estudio no verificado' }, { status: 403 });
    }

    // Si se especifica un target, verificar que sea miembro de la misma org
    if (target_user_id) {
        const { data: targetMember } = await supabase
            .from('org_members')
            .select('role')
            .eq('user_id', target_user_id)
            .eq('org_id', orgId)
            .single();

        if (!targetMember) {
            return NextResponse.json({ error: 'El abogado no pertenece a este estudio' }, { status: 404 });
        }
    }

    // Verificar que el caso pertenece a la org y actualizar assigned_to
    const { data: updated, error: updateErr } = await supabase
        .from('cases')
        .update({ assigned_to: target_user_id || null })
        .eq('id', case_id)
        .eq('org_id', orgId)
        .select('id, title, assigned_to')
        .single();

    if (updateErr || !updated) {
        return NextResponse.json({ error: 'Expediente no encontrado en este estudio' }, { status: 404 });
    }

    return NextResponse.json({ success: true, case: updated });
}
