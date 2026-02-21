import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/app/lib/supabase-server';
import { Resend } from 'resend';
import { sendEmail } from '@/app/lib/resend';
import { getHtmlEmail } from '@/lib/email-template';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/abogados/contact
 * Client sends a contact request from the marketplace (no auth required)
 */
export async function POST(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
    });

    try {
        const { lawyerId, name, email, message } = await request.json();

        // Validate required fields
        if (!lawyerId || !name?.trim() || !email?.trim() || !message?.trim()) {
            return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
        }

        if (!EMAIL_REGEX.test(email.trim())) {
            return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
        }

        if (message.trim().length > 2000) {
            return NextResponse.json({ error: 'El mensaje es demasiado largo (máx. 2000 caracteres)' }, { status: 400 });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanName = name.trim();
        const cleanMessage = message.trim();

        // Check if lawyer exists and is public
        const { data: lawyer } = await adminClient
            .from('profiles')
            .select('id, full_name, is_public, verification_status')
            .eq('id', lawyerId)
            .single();

        if (!lawyer || !lawyer.is_public || lawyer.verification_status !== 'verified') {
            return NextResponse.json({ error: 'Abogado no disponible' }, { status: 404 });
        }

        // Check if this email is blocked by this lawyer
        const { data: blocked } = await adminClient
            .from('blocked_contacts')
            .select('id')
            .eq('lawyer_id', lawyerId)
            .eq('email', cleanEmail)
            .maybeSingle();

        if (blocked) {
            return NextResponse.json({ error: 'No es posible enviar tu consulta a este profesional' }, { status: 403 });
        }

        // Check if there's already a pending/active inquiry from this email to this lawyer
        const { data: existing } = await adminClient
            .from('inquiries')
            .select('id, status')
            .eq('assigned_lawyer_id', lawyerId)
            .eq('contact_email', cleanEmail)
            .in('status', ['pending_review', 'Nuevo'])
            .maybeSingle();

        if (existing) {
            return NextResponse.json({
                error: existing.status === 'pending_review'
                    ? 'Ya tenés una consulta pendiente con este profesional'
                    : 'Ya tenés una conversación activa con este profesional'
            }, { status: 409 });
        }

        // Create inquiry
        const inquiryId = crypto.randomUUID();
        const { error: inquiryError } = await adminClient
            .from('inquiries')
            .insert({
                id: inquiryId,
                assigned_lawyer_id: lawyerId,
                contact_name: cleanName,
                contact_email: cleanEmail,
                case_type: 'Consulta Marketplace',
                status: 'pending_review',
                source: 'marketplace',
                last_message_at: new Date().toISOString(),
                last_message_preview: cleanMessage.slice(0, 120)
            });

        if (inquiryError) throw inquiryError;

        // Insert initial message
        const { error: msgError } = await adminClient
            .from('messages')
            .insert({
                inquiry_id: inquiryId,
                role: 'user',
                content: cleanMessage
            });

        if (msgError) throw msgError;

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error in /api/abogados/contact POST:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/abogados/contact
 * Lawyer accepts, rejects, or blocks a marketplace contact (requires auth)
 */
export async function PATCH(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    const supabase = await createAuthClient();
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
    });

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const { inquiryId, action } = await request.json();

        if (!inquiryId || !['accept', 'reject', 'block'].includes(action)) {
            return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
        }

        // Verify lawyer owns this inquiry
        const { data: inquiry } = await adminClient
            .from('inquiries')
            .select('id, assigned_lawyer_id, contact_email, contact_name, status')
            .eq('id', inquiryId)
            .single();

        if (!inquiry || inquiry.assigned_lawyer_id !== user.id) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        if (inquiry.status !== 'pending_review') {
            return NextResponse.json({ error: 'Esta consulta ya fue procesada' }, { status: 400 });
        }

        if (action === 'accept') {
            await adminClient
                .from('inquiries')
                .update({ status: 'Nuevo' })
                .eq('id', inquiryId);

            // Notificar al cliente que el abogado aceptó su consulta
            const resendApiKey = process.env.RESEND_API_KEY;
            if (resendApiKey && inquiry.contact_email) {
                try {
                    const resend = new Resend(resendApiKey);
                    const { data: lawyerProfile } = await adminClient
                        .from('profiles')
                        .select('full_name')
                        .eq('id', user.id)
                        .single();

                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';
                    const chatUrl = `${baseUrl}/consultas/${user.id}?cid=${inquiryId}`;
                    const lawyerName = lawyerProfile?.full_name || 'El profesional';

                    await sendEmail({
                        resendClient: resend,
                        to: inquiry.contact_email,
                        from: 'Judic-IA <noreply@judic-ia.com>',
                        subject: `${lawyerName} aceptó tu consulta — Podés empezar a chatear`,
                        html: getHtmlEmail({
                            heading: '¡Tu consulta fue aceptada!',
                            bodyContent: `
                                <p>Hola <strong>${inquiry.contact_name || ''}</strong>,</p>
                                <p><strong>${lawyerName}</strong> aceptó tu solicitud de consulta y está disponible para atenderte.</p>
                                <p>Hacé clic en el botón para comenzar la conversación:</p>
                            `,
                            buttonText: 'Ir al Chat',
                            buttonUrl: chatUrl,
                            previewText: `${lawyerName} aceptó tu consulta — Es tu turno`
                        })
                    });
                } catch (emailErr) {
                    // No fallar si el email falla
                    console.warn('⚠️ Error enviando email de aceptación:', emailErr);
                }
            }

            return NextResponse.json({ success: true, status: 'Nuevo' });
        }

        if (action === 'reject') {
            await adminClient
                .from('inquiries')
                .update({ status: 'rejected' })
                .eq('id', inquiryId);

            return NextResponse.json({ success: true, status: 'rejected' });
        }

        if (action === 'block') {
            // Update inquiry status
            await adminClient
                .from('inquiries')
                .update({ status: 'blocked' })
                .eq('id', inquiryId);

            // Add email to blocked_contacts
            if (inquiry.contact_email) {
                await adminClient
                    .from('blocked_contacts')
                    .upsert({
                        lawyer_id: user.id,
                        email: inquiry.contact_email.toLowerCase()
                    }, { onConflict: 'lawyer_id,email' });
            }

            return NextResponse.json({ success: true, status: 'blocked' });
        }

    } catch (error) {
        console.error('Error in /api/abogados/contact PATCH:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
