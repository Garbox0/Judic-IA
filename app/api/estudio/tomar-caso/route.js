import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidUUID } from '@/lib/validation';

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

    const userId = user.id;

    const body = await request.json().catch(() => null);
    const { case_id } = body || {};
    if (!isValidUUID(case_id)) {
        return NextResponse.json({ error: 'case_id inválido' }, { status: 400 });
    }

    // Verificar que el usuario pertenece a un estudio verificado
    const { data: prof } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userId)
        .single();

    if (!prof?.org_id) {
        return NextResponse.json({ error: 'No pertenecés a ningún estudio' }, { status: 403 });
    }

    const orgId = prof.org_id;

    // Verificar membresía y que la org es un estudio jurídico verificado
    const { data: member } = await supabase
        .from('org_members')
        .select('role, org:org_id(type, verification_status)')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .single();

    if (!member) {
        return NextResponse.json({ error: 'No pertenecés a este estudio' }, { status: 403 });
    }

    if (member.org?.type !== 'estudio' || member.org?.verification_status !== 'verified') {
        return NextResponse.json({ error: 'Estudio no verificado' }, { status: 403 });
    }

    // Tomar el expediente: solo si pertenece a la org y está sin asignar
    const { data: updated, error } = await supabase
        .from('cases')
        .update({ assigned_to: userId })
        .eq('id', case_id)
        .eq('org_id', orgId)
        .is('assigned_to', null)
        .select('id, title')
        .single();

    if (error || !updated) {
        return NextResponse.json({ error: 'El expediente ya fue tomado o no existe' }, { status: 409 });
    }

    return NextResponse.json({ success: true, case: updated });
}
