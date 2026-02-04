import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Use the standard JS client for service role
import { Resend } from 'resend';
import { sendEmail } from '../../lib/resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
    try {
        const { email } = await request.json();

        if (!email || !email.includes('@')) {
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
            await sendEmail({
                resendClient: resend,
                from: 'hola@judic-ia.com',
                to: 'hola@judic-ia.com',
                subject: '🚀 Nuevo Lead: Inscripción a Newsletter',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #0f172a;">
                        <h2 style="color: #fbbf24;">¡Nuevo Interesado!</h2>
                        <p>Se ha registrado un nuevo email en la lista de espera:</p>
                        <div style="background: #f1f5f9; padding: 15px; border-radius: 10px; font-size: 1.1rem; font-weight: bold;">
                            ${email}
                        </div>
                    </div>
                `
            });
        } catch (mailError) {
            console.error('Internal Notification Error:', mailError);
        }

        // 3. Email de Bienvenida al Suscriptor
        try {
            const unsubscribeUrl = `https://judic-ia.com/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;

            await sendEmail({
                resendClient: resend,
                from: 'hola@judic-ia.com',
                to: email,
                subject: '¡Bienvenido a la evolución de tu estudio jurídico! ⚖️',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0f172a; line-height: 1.6;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <img src="https://judic-ia.com/judic-ia-mark.png" alt="Judic-IA" style="width: 60px;">
                            <h1 style="color: #fbbf24; margin-top: 10px;">¡Gracias por sumarte!</h1>
                        </div>
                        
                        <p>Hola,</p>
                        <p>Es un gusto saludarte. Te has suscrito correctamente a las novedades de <b>Judic-IA</b>.</p>
                        <p>Muy pronto recibirás actualizaciones exclusivas sobre nuestras nuevas herramientas de IA jurídica, consejos para automatizar tu estudio y tendencias en LegalTech en Argentina.</p>
                        
                        <div style="background: #fffbeb; border-left: 4px solid #fbbf24; padding: 15px; margin: 25px 0;">
                            <b>Próximamente:</b> Te enviaremos un acceso exclusivo para probar nuestras calculadoras de plazos y modelos de escritos inteligentes.
                        </div>
                        
                        <p>Si tienes alguna consulta, puedes responder directamente a este correo.</p>
                        
                        <p>Saludos,<br><b>El equipo de Judic-IA</b></p>
                        
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 40px 0 20px;">
                        
                        <div style="text-align: center; font-size: 0.75rem; color: #94a3b8;">
                            Este correo fue enviado a ${email} porque te suscribiste en Judic-IA.com<br>
                            <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Darme de baja de la lista</a>
                        </div>
                    </div>
                `
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
