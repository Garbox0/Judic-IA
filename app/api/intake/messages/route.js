import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get('cid');

    if (!cid) {
        return NextResponse.json({ error: 'CID requerido.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    try {
        const { data: inquiry, error: inquiryError } = await supabaseAdmin
            .from('inquiries')
            .select('status, contact_name, contact_email, contact_phone')
            .eq('id', cid)
            .maybeSingle();

        if (inquiryError) throw inquiryError;

        if (!inquiry) {
            return NextResponse.json({ error: 'Consulta no encontrada.' }, { status: 404 });
        }

        const { data: messages, error: messagesError } = await supabaseAdmin
            .from('messages')
            .select('id, content, role, created_at, attachment_url, attachment_name')
            .eq('inquiry_id', cid)
            .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        // Filter out system/internal messages
        const visibleMessages = (messages || []).filter(
            m => !m.content.startsWith('[SISTEMA:') && !m.content.startsWith('[SYSTEM:')
        );

        return NextResponse.json({
            status: inquiry.status,
            contact_name: inquiry.contact_name,
            contact_email: inquiry.contact_email,
            contact_phone: inquiry.contact_phone,
            messages: visibleMessages
        });
    } catch (error) {
        console.error('Error en messages endpoint:', error);
        return NextResponse.json({ error: 'Error al obtener mensajes.' }, { status: 500 });
    }
}
