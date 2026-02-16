import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase-server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const supabase = await createClient();
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
    });

    try {
        const { inquiryId, message } = await request.json();

        if (!inquiryId || !message?.trim()) {
            return NextResponse.json({ error: "Missing inquiryId or message" }, { status: 400 });
        }

        if (message.length > 10000) {
            return NextResponse.json({ error: "Mensaje demasiado largo (max 10.000)" }, { status: 400 });
        }

        // Verify lawyer identity
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        // Verify lawyer owns this inquiry
        const { data: inquiry } = await adminClient
            .from('inquiries')
            .select('assigned_lawyer_id')
            .eq('id', inquiryId)
            .single();

        if (!inquiry || inquiry.assigned_lawyer_id !== user.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        // Insert lawyer message
        const { data: msg, error: insertError } = await adminClient
            .from('messages')
            .insert({
                inquiry_id: inquiryId,
                role: 'lawyer',
                content: message.trim()
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // Update inquiry last_message fields
        await adminClient
            .from('inquiries')
            .update({
                last_message_at: new Date().toISOString(),
                last_message_preview: message.trim().slice(0, 120)
            })
            .eq('id', inquiryId);

        return NextResponse.json({ success: true, message: msg });

    } catch (error) {
        console.error("Error in lawyer reply:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
