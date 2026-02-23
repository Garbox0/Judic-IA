import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function PATCH(request) {
    const supabase = getAdminClient();

    let messageId, content, cid;
    try {
        ({ messageId, content, cid } = await request.json());
    } catch {
        return NextResponse.json({ error: 'Formato inválido' }, { status: 400 });
    }

    if (!messageId || typeof content !== 'string') {
        return NextResponse.json({ error: 'Faltan parámetros: messageId y content' }, { status: 400 });
    }

    const trimmed = content.trim();
    if (!trimmed) {
        return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 422 });
    }
    if (trimmed.length > 5000) {
        return NextResponse.json({ error: 'Mensaje demasiado largo' }, { status: 422 });
    }

    // Fetch the message to validate ownership
    const { data: msg, error: fetchErr } = await supabase
        .from('messages')
        .select('id, role, inquiry_id')
        .eq('id', messageId)
        .maybeSingle();

    if (fetchErr || !msg) {
        return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    // Determine authorization path
    const authHeader = request.headers.get('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
        // Lawyer flow: verify identity + ownership
        const token = authHeader.slice(7);
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        if (msg.role !== 'lawyer') {
            return NextResponse.json({ error: 'Solo podés editar tus propios mensajes' }, { status: 403 });
        }

        const { data: inquiry } = await supabase
            .from('inquiries')
            .select('assigned_lawyer_id')
            .eq('id', msg.inquiry_id)
            .maybeSingle();

        if (!inquiry || inquiry.assigned_lawyer_id !== user.id) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }
    } else if (cid) {
        // Client flow: validate cid matches inquiry_id
        if (msg.role !== 'user') {
            return NextResponse.json({ error: 'Solo podés editar tus propios mensajes' }, { status: 403 });
        }
        if (msg.inquiry_id !== cid) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }
    } else {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Update message
    const { data: updated, error: updateErr } = await supabase
        .from('messages')
        .update({ content: trimmed, edited_at: new Date().toISOString() })
        .eq('id', messageId)
        .select()
        .single();

    if (updateErr) {
        console.error('[edit-message]', updateErr);
        return NextResponse.json({ error: 'Error al editar el mensaje' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: updated });
}
