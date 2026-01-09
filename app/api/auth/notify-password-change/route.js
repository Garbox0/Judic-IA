import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendEmail } from '../../../lib/resend';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
        return NextResponse.json({ error: "Resend API Key missing" }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);

    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        // Send Email
        await sendEmail({
            resendClient: resend,
            to: email,
            from: 'noreply@judic-ia.com',
            subject: '🔐 Tu contraseña de Judic-IA ha sido modificada',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
                    <h2 style="color: #d97706;">Cambio de Contraseña Exitoso</h2>
                    <p>Hola,</p>
                    <p>Te informamos que la contraseña de tu cuenta profesional en <strong>Judic-IA</strong> ha sido modificada recientemente.</p>
                    <p>Si fuiste tú, no necesitas hacer nada más.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #777; font-size: 0.9em;">
                        Si NO realizaste este cambio, por favor contacta inmediatamente a <a href="mailto:soporte@judic-ia.com">soporte@judic-ia.com</a> para proteger tu cuenta.
                    </p>
                    <p style="font-size: 0.8em; color: #999; text-align: center; margin-top: 30px;">
                        © 2026 Judic-IA - Inteligencia Artificial Jurídica
                    </p>
                </div>
            `
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error sending notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
