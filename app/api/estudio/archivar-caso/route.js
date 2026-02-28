import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidUUID } from '@/lib/validation';

// POST — archivar o restaurar un expediente del estudio
// Body: { case_id, restore?: boolean }
// - Archivar (restore=false): cualquier miembro de la org puede hacerlo
//   → status='archived', assigned_to=null (va al buzón central)
// - Restaurar (restore=true): solo owner o supervisor
//   → status='open', assigned_to=null (vuelve a la bandeja)
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
    const { case_id, restore = false } = body || {};

    if (!isValidUUID(case_id)) {
        return NextResponse.json({ error: 'case_id inválido' }, { status: 400 });
    }

    const { data: prof } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

    if (!prof?.org_id) {
        return NextResponse.json({ error: 'No pertenecés a ningún estudio' }, { status: 403 });
    }

    const orgId = prof.org_id;

    const { data: myMember } = await supabase
        .from('org_members')
        .select('role, org:org_id(type, verification_status)')
        .eq('user_id', user.id)
        .eq('org_id', orgId)
        .single();

    if (!myMember) return NextResponse.json({ error: 'No pertenecés a este estudio' }, { status: 403 });

    const { role: myRole, org } = myMember;

    if (!org || org.type !== 'estudio' || org.verification_status !== 'verified') {
        return NextResponse.json({ error: 'Estudio no verificado' }, { status: 403 });
    }

    // Restaurar es solo para supervisor u owner
    if (restore && myRole !== 'owner' && myRole !== 'supervisor') {
        return NextResponse.json({ error: 'Solo supervisores y el titular pueden restaurar expedientes' }, { status: 403 });
    }

    const newStatus = restore ? 'open' : 'archived';

    const { data: updated, error: updateErr } = await supabase
        .from('cases')
        .update({ status: newStatus, assigned_to: null })
        .eq('id', case_id)
        .eq('org_id', orgId)
        .select('id, title, status')
        .single();

    if (updateErr || !updated) {
        return NextResponse.json({ error: 'Expediente no encontrado en este estudio' }, { status: 404 });
    }

    return NextResponse.json({ success: true, case: updated });
}
