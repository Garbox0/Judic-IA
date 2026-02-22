import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'gbrlescalada@gmail.com';
const ADMIN_ID = '365cd259-4f1e-4004-a677-1eda06a5147e';

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

async function verifyAdmin(request) {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return false;
    const token = auth.slice(7);
    const supabase = getAdminClient();
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.email === ADMIN_EMAIL && user?.id === ADMIN_ID;
}

// GET /api/admin/bans — listar todos los bans
export async function GET(request) {
    if (!await verifyAdmin(request)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('platform_bans')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ bans: data });
}

// POST /api/admin/bans — banear email
export async function POST(request) {
    if (!await verifyAdmin(request)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body;
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }

    const { email, reason } = body;
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabase = getAdminClient();

    const { data, error } = await supabase
        .from('platform_bans')
        .upsert({ email: cleanEmail, reason: reason?.trim() || null, banned_by: ADMIN_EMAIL }, { onConflict: 'email' })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ban: data });
}

// DELETE /api/admin/bans — levantar ban por email
export async function DELETE(request) {
    if (!await verifyAdmin(request)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 });

    const supabase = getAdminClient();
    const { error } = await supabase
        .from('platform_bans')
        .delete()
        .eq('email', email.toLowerCase());

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
