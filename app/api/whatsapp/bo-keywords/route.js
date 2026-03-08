import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUser(authHeader) {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    return user || null;
}

// GET — listar keywords
export async function GET(request) {
    const user = await getUser(request.headers.get('Authorization'));
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data, error } = await supabase
        .from('whatsapp_bo_keywords')
        .select('id, keyword, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ keywords: data || [] });
}

// POST — agregar keyword
export async function POST(request) {
    const user = await getUser(request.headers.get('Authorization'));
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { keyword } = await request.json();
    if (!keyword?.trim()) return NextResponse.json({ error: 'keyword requerido' }, { status: 400 });

    // Máximo 10 keywords por usuario
    const { count } = await supabase
        .from('whatsapp_bo_keywords')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

    if (count >= 10) return NextResponse.json({ error: 'Máximo 10 keywords permitidas' }, { status: 400 });

    const { data, error } = await supabase
        .from('whatsapp_bo_keywords')
        .insert({ user_id: user.id, keyword: keyword.trim().toLowerCase() })
        .select('id, keyword')
        .single();

    if (error?.code === '23505') return NextResponse.json({ error: 'Ya tenés esa keyword' }, { status: 409 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, keyword: data });
}

// DELETE — eliminar keyword
export async function DELETE(request) {
    const user = await getUser(request.headers.get('Authorization'));
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const { error } = await supabase
        .from('whatsapp_bo_keywords')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
