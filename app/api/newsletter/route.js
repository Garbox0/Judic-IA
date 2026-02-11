import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getHtmlEmail } from '@/lib/email-template';
import { checkRateLimit, getClientIP } from '@/lib/rate-limiter';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
    // 🛡️ Rate limiting: 3 requests per minute per IP (anti-spam)
    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(`newsletter:${ip}`, 3, 60000);
    if (!rateCheck.allowed) {
        return NextResponse.json(
            { error: 'Demasiadas solicitudes. Intenta de nuevo en 1 minuto.' },
            { status: 429, headers: { 'Retry-After': '60' } }
        );
    }

    try {
        const { email } = await request.json();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
        }

        // Initialize Supabase with Service Role to bypass RLS (Crucial for Public Admin endpoints)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

        // 1. Verificar si ya está suscrito
        const { data: existing } = await supabase
            .from('leads_newsletter')
            .select('status')
            .eq('email', email)
            .single();

        if (existing && existing.status === 'active') {
            return NextResponse.json({ success: true, already_active: true });
        }

        // 2. Almacenar o actualizar en la base de datos
        const { error: dbError } = await supabase
            .from('leads_newsletter')
            .upsert({ email, source: 'landing_waitlist', status: 'active' }, { onConflict: 'email' });

        if (dbError) {
            console.error('Newsletter DB Error:', dbError);
        }

        // 2. Notificación interna (Hola@judic-ia.com)
        try {
            await resend.emails.send({
                from: 'Judic-IA <hola@judic-ia.com>',
                to: 'hola@judic-ia.com',
                subject: '🚀 Nuevo Interesado en Newsletter',
                html: getHtmlEmail({
                    heading: '¡Nuevo Lead Registrado!',
                    bodyContent: `
                        <p>Se ha registrado un nuevo email interesado en la Newsletter de Judic-IA:</p>
                        <div style="background: rgba(251,191,36,0.1); padding: 15px; border-radius: 10px; font-size: 1.1rem; color: #fbbf24; text-align: center; border: 1px dashed #fbbf24;">
                            <strong>${email}</strong>
                        </div>
                        <p>El contacto ha sido guardado exitosamente en Supabase (status: active).</p>
                    `
                })
            });
        } catch (mailError) {
            console.error('Internal Notification Error:', mailError);
        }

        // 3. Email de Bienvenida al Suscriptor
        try {
            const unsubscribeUrl = `https://judic-ia.com/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;

            await resend.emails.send({
                from: 'Judic-IA <hola@judic-ia.com>',
                to: email,
                subject: '¡Bienvenido a la evolución de tu estudio jurídico! ⚖️',
                html: getHtmlEmail({
                    heading: '¡Gracias por sumarte!',
                    bodyContent: `
                        <p>Es un gusto saludarte. Te has unido correctamente a la comunidad de <strong>Judic-IA</strong>.</p>
                        <p>Muy pronto recibirás actualizaciones exclusivas sobre nuestras herramientas de IA jurídica, consejos para automatizar tu estudio y novedades de Judic-IA.</p>
                        <div style="background: rgba(255,255,255,0.03); border-left: 4px solid #fbbf24; padding: 20px; margin: 25px 0; border-radius: 0 10px 10px 0;">
                            <strong>Siguiente paso:</strong> Te avisaremos apenas habilitemos el acceso exclusivo para probar nuestras calculadoras de plazos y modelos de escritos inteligentes.
                        </div>
                        <p>Si tienes alguna consulta, puedes responder directamente a este correo. Estamos para ayudarte.</p>
                        <p>Saludos,<br><strong>El equipo de Judic-IA</strong></p>
                    `,
                    footerLinks: [
                        { label: 'Darme de baja', url: unsubscribeUrl },
                        { label: 'Seguridad', url: 'https://judic-ia.com/legal?tab=seguridad' }
                    ]
                })
            });
        } catch (welcomeError) {
            console.error('Welcome Email Error:', welcomeError);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Newsletter API Error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
