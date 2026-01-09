import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendEmail } from '../../../lib/resend';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!resendApiKey) {
        return NextResponse.json({ error: "Configuration Error: Resend API Key missing" }, { status: 500 });
    }
    if (!serviceRoleKey) {
        return NextResponse.json({ error: "Configuration Error: Supabase Service Key missing" }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        const body = await request.json();
        const { email, redirectTo } = body;

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        // 1. Generate Recovery Link via Supabase Admin
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: {
                redirectTo: redirectTo || 'http://localhost:3000/update-password'
            }
        });

        if (error) {
            console.warn("Supabase Generate Link Error (User might not exist):", error.message);
            // SECURITY: Always return success to prevent email enumeration.
            // If the user doesn't exist, we just don't send the email.
            return NextResponse.json({ success: true });
        }

        const { action_link } = data.properties;

        // 2. Send Email via Resend
        await sendEmail({
            resendClient: resend,
            to: email,
            from: 'noreply@judic-ia.com',
            subject: '🔐 Recupera tu acceso a Judic-IA',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background: #f8fafc; border-radius: 12px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #d97706; margin-bottom: 5px;">Recuperación de Contraseña</h2>
                        <p style="color: #64748b;">Judic-IA Acceso Profesional</p>
                    </div>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <p>Hola,</p>
                        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta asociada a <strong>${email}</strong>.</p>
                        <p>Haz clic en el siguiente botón para crear una nueva clave:</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${action_link}" style="background: linear-gradient(135deg, #fbbf24, #d97706); color: #020617; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Restablecer Contraseña</a>
                        </div>
                        
                        <p style="font-size: 0.9em; color: #64748b;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                        <p style="font-size: 0.8em; color: #94a3b8; word-break: break-all;">${action_link}</p>
                    </div>

                    <p style="font-size: 0.8em; color: #999; text-align: center; margin-top: 30px;">
                        Si no solicitaste este cambio, puedes ignorar este correo. Tu cuenta sigue segura.<br>
                        © 2026 Judic-IA
                    </p>
                </div>
            `
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Link Generation/Sending Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
