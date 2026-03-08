import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizePhone(raw) {
    // Eliminar todo excepto dígitos y el + inicial
    let phone = raw.trim().replace(/[\s\-().]/g, '');
    if (!phone.startsWith('+')) phone = '+' + phone;
    // Mínimo 10 dígitos después del +
    if (phone.replace(/\D/g, '').length < 10) throw new Error('Número inválido');
    return phone;
}

async function getUser(authHeader) {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    return user || null;
}

// POST — vincular número
export async function POST(request) {
    const user = await getUser(request.headers.get('Authorization'));
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { phone: rawPhone } = await request.json();
    if (!rawPhone) return NextResponse.json({ error: 'phone requerido' }, { status: 400 });

    let phone;
    try { phone = normalizePhone(rawPhone); }
    catch { return NextResponse.json({ error: 'Número de teléfono inválido' }, { status: 400 }); }

    // Verificar que no esté ya usado por otro usuario
    const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('whatsapp_phone', phone)
        .neq('id', user.id)
        .maybeSingle();

    if (existing) {
        return NextResponse.json({ error: 'Este número ya está vinculado a otra cuenta' }, { status: 409 });
    }

    const { error } = await supabase
        .from('profiles')
        .update({ whatsapp_phone: phone })
        .eq('id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, phone });
}

// DELETE — desvincular
export async function DELETE(request) {
    const user = await getUser(request.headers.get('Authorization'));
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { error } = await supabase
        .from('profiles')
        .update({ whatsapp_phone: null })
        .eq('id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
}
