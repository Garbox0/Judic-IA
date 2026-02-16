import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase-server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { sendEmail } from '@/app/lib/resend';

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

        // Verify lawyer owns this inquiry (fetch source + contact_email for notification)
        const { data: inquiry } = await adminClient
            .from('inquiries')
            .select('assigned_lawyer_id, source, contact_email, contact_name')
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

        // Send email notification for marketplace contacts
        if (inquiry.source === 'marketplace' && inquiry.contact_email) {
            try {
                const { data: lawyerProfile } = await adminClient
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single();

                const lawyerName = lawyerProfile?.full_name || 'Un abogado';
                const resend = new Resend(process.env.RESEND_API_KEY);

                await sendEmail({
                    resendClient: resend,
                    to: inquiry.contact_email,
                    subject: `${lawyerName} respondió tu consulta en Judic-IA`,
                    html: `
                        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e293b;">
                            <div style="text-align: center; margin-bottom: 24px;">
                                <img src="https://judic-ia.com/judic-ia-mark.png" alt="Judic-IA" style="height: 36px;" />
                            </div>
                            <h2 style="color: #0f172a; font-size: 1.2rem; margin-bottom: 8px;">Nueva respuesta de ${lawyerName}</h2>
                            <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 16px;">
                                Hola ${inquiry.contact_name || ''},
                            </p>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                                <p style="color: #334155; font-size: 0.95rem; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message.trim()}</p>
                            </div>
                            <p style="color: #94a3b8; font-size: 0.8rem; text-align: center;">
                                Recibiste este email porque contactaste a ${lawyerName} a través de <a href="https://judic-ia.com/abogados" style="color: #d97706;">Judic-IA</a>.
                            </p>
                        </div>
                    `
                });
            } catch (emailErr) {
                // Don't fail the reply if email fails
                console.error('Failed to send marketplace reply email:', emailErr);
            }
        }

        return NextResponse.json({ success: true, message: msg });

    } catch (error) {
        console.error("Error in lawyer reply:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
