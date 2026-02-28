import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidUUID } from '@/lib/validation';

function makeClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );
}

// GET — validar token de invitación (usado por la página /registro-estudio/unirse)
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    const supabase = makeClient();

    const { data: inv, error } = await supabase
        .from('org_invitations')
        .select('id, email, role, status, expires_at, org:org_id(id, name, razon_social, plan_tier)')
        .eq('token', token)
        .single();

    if (error || !inv) {
        return NextResponse.json({ error: 'invalid' }, { status: 404 });
    }

    if (inv.status === 'accepted') {
        return NextResponse.json({ error: 'already_used' }, { status: 410 });
    }

    if (inv.status === 'cancelled' || inv.status === 'rejected') {
        return NextResponse.json({ error: 'invalid' }, { status: 404 });
    }

    if (new Date(inv.expires_at) < new Date()) {
        return NextResponse.json({ error: 'expired' }, { status: 410 });
    }

    return NextResponse.json({
        email: inv.email,
        role: inv.role,
        expires_at: inv.expires_at,
        org: {
            id: inv.org.id,
            name: inv.org.razon_social || inv.org.name,
            plan_tier: inv.org.plan_tier,
        },
    });
}

// DELETE — cancelar una invitación pendiente (owner only)
export async function DELETE(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const supabase = makeClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const { invitation_id } = body || {};
    if (!isValidUUID(invitation_id)) {
        return NextResponse.json({ error: 'invitation_id inválido' }, { status: 400 });
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

    // Verificar que el caller es owner
    const { data: myMember } = await supabase
        .from('org_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('org_id', prof.org_id)
        .single();

    if (myMember?.role !== 'owner') {
        return NextResponse.json({ error: 'Solo el titular puede cancelar invitaciones' }, { status: 403 });
    }

    // Verificar que la invitación pertenece a esta org y está pendiente
    const { data: inv } = await supabase
        .from('org_invitations')
        .select('id, status')
        .eq('id', invitation_id)
        .eq('org_id', prof.org_id)
        .single();

    if (!inv) {
        return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 });
    }
    if (inv.status !== 'pending') {
        return NextResponse.json({ error: 'La invitación ya no está pendiente' }, { status: 409 });
    }

    await supabase
        .from('org_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitation_id);

    return NextResponse.json({ success: true });
}
