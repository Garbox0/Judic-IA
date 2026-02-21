import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../../../lib/resend';
import { getHtmlEmail } from '../../../../lib/email-template';
import { checkRateLimit, getClientIP } from '../../../../lib/rate-limiter';

export async function POST(request) {
    // Rate limit: 5 intentos por IP cada 5 minutos
    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(`intake:${ip}`, 5, 300000);

    if (!rateCheck.allowed) {
        return NextResponse.json(
            { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
            { status: 429, headers: { 'Retry-After': Math.ceil(rateCheck.resetIn / 1000).toString() } }
        );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!serviceRoleKey || !resendApiKey) {
        return NextResponse.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
    const resend = new Resend(resendApiKey);

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Request inválido.' }, { status: 400 });
    }

    const { lawyerId, firstName, lastName, email, phone, dni, idType } = body;

    if (!lawyerId || !firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim()) {
        return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();

    try {
        // 1. Verificar si el cliente está bloqueado por este abogado
        const { data: blocked } = await supabaseAdmin
            .from('blocked_contacts')
            .select('id')
            .eq('lawyer_id', lawyerId)
            .eq('email', emailLower)
            .maybeSingle();

        if (blocked) {
            return NextResponse.json(
                { error: 'Este abogado no está disponible para nuevas consultas en este momento.' },
                { status: 403 }
            );
        }

        // 2. Verificar si ya existe una consulta activa (evitar duplicados)
        const { data: existing } = await supabaseAdmin
            .from('inquiries')
            .select('id, status')
            .eq('assigned_lawyer_id', lawyerId)
            .eq('contact_email', emailLower)
            .neq('status', 'rejected')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Obtener perfil del abogado (nombre + email para notificación)
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name, email')
            .eq('id', lawyerId)
            .single();

        const lawyerName = profile?.full_name || 'el profesional';
        const lawyerEmail = profile?.email;

        if (existing) {
            // Recuperación de sesión: re-enviar email de acceso al cliente
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';
            const returnUrl = `${baseUrl}/consultas/${lawyerId}?cid=${existing.id}`;

            sendEmail({
                resendClient: resend,
                to: email,
                from: 'Judic-IA <noreply@judic-ia.com>',
                subject: `Tu link de acceso a la consulta con ${lawyerName}`,
                html: getHtmlEmail({
                    heading: 'Recuperá tu consulta',
                    bodyContent: `
                        <p>Hola <strong>${firstName.trim()}</strong>,</p>
                        <p>Encontramos tu consulta activa con <strong>${lawyerName}</strong>. Guardá este email para acceder desde cualquier dispositivo.</p>
                    `,
                    buttonText: 'Continuar Consulta',
                    buttonUrl: returnUrl,
                    previewText: `Tu acceso a la consulta con ${lawyerName}`
                })
            }).catch(() => {}); // Fire-and-forget, no bloquear la respuesta

            return NextResponse.json({ cid: existing.id, lawyerName, status: existing.status });
        }

        // 3. Generar nuevo CID e insertar inquiry
        const cid = crypto.randomUUID();

        const { error: insertError } = await supabaseAdmin
            .from('inquiries')
            .insert({
                id: cid,
                assigned_lawyer_id: lawyerId,
                contact_name: `${firstName.trim()} ${lastName.trim()}`,
                contact_email: emailLower,
                contact_phone: phone.trim(),
                dni: dni?.trim() || null,
                id_type: idType || null,
                status: 'pending_review',
                source: 'marketplace',
                case_type: 'Consulta Web'
            });

        if (insertError) {
            console.error('Error insertando inquiry anónima:', insertError);
            return NextResponse.json({ error: 'Error al registrar la consulta.' }, { status: 500 });
        }

        // 4. Enviar emails en paralelo: cliente + abogado
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';
        const returnUrl = `${baseUrl}/consultas/${lawyerId}?cid=${cid}`;
        const dashboardUrl = `${baseUrl}/dashboard/clients`;

        const clientDni = dni?.trim()
            ? `<tr><td style="padding:4px 0; color:#64748b; width:110px;">${idType || 'DNI'}:</td><td style="padding:4px 0;">${dni.trim()}</td></tr>`
            : '';

        await Promise.all([
            // Email al cliente con link de retorno
            sendEmail({
                resendClient: resend,
                to: email,
                from: 'Judic-IA <noreply@judic-ia.com>',
                subject: `Tu consulta con ${lawyerName} — Link de acceso`,
                html: getHtmlEmail({
                    heading: 'Tu consulta fue recibida',
                    bodyContent: `
                        <p>Hola <strong>${firstName.trim()}</strong>,</p>
                        <p>Tu solicitud de consulta con <strong>${lawyerName}</strong> fue enviada correctamente.</p>
                        <p>El profesional revisará tu caso y te habilitará el chat a la brevedad.</p>
                        <p style="margin-top: 16px;">Guardá este email: si cerrás el navegador podés volver a tu consulta usando el siguiente botón.</p>
                    `,
                    buttonText: 'Retomar Consulta',
                    buttonUrl: returnUrl,
                    previewText: `Tu acceso a la consulta con ${lawyerName}`
                })
            }),

            // Email al abogado notificando nueva consulta pendiente
            lawyerEmail ? sendEmail({
                resendClient: resend,
                to: lawyerEmail,
                from: 'Judic-IA <noreply@judic-ia.com>',
                subject: `Nueva consulta pendiente — ${firstName.trim()} ${lastName.trim()}`,
                html: getHtmlEmail({
                    heading: 'Nueva consulta pendiente de revisión',
                    bodyContent: `
                        <p>Hola <strong>${lawyerName}</strong>,</p>
                        <p>Un cliente solicitó una consulta desde tu perfil en el marketplace y está esperando tu aprobación.</p>
                        <table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:14px;">
                            <tr><td style="padding:4px 0; color:#64748b; width:110px;">Nombre:</td><td style="padding:4px 0;"><strong>${firstName.trim()} ${lastName.trim()}</strong></td></tr>
                            <tr><td style="padding:4px 0; color:#64748b;">Email:</td><td style="padding:4px 0;">${emailLower}</td></tr>
                            <tr><td style="padding:4px 0; color:#64748b;">Teléfono:</td><td style="padding:4px 0;">${phone.trim()}</td></tr>
                            ${clientDni}
                        </table>
                        <p>Entrá a tu bandeja para aceptar, rechazar o bloquear esta solicitud.</p>
                    `,
                    buttonText: 'Ir a mi Bandeja',
                    buttonUrl: dashboardUrl,
                    previewText: `Consulta pendiente de ${firstName.trim()} ${lastName.trim()} — Acción requerida`
                })
            }) : Promise.resolve()
        ]);

        return NextResponse.json({ cid, lawyerName, status: 'pending_review' });
    } catch (error) {
        console.error('Error en intake anónimo:', error);
        return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
    }
}
