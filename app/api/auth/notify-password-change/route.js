import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendEmail } from '../../../lib/resend';
import { getHtmlEmail } from '../../../../lib/email-template';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/api-auth';

export async function POST(request) {
    // 🛡️ Auth required (prevents abuse for email spamming)
    const auth = await verifyAuth(request);
    if (auth.error) return auth.response;

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
            from: 'Soporte Judic-IA <soporte@judic-ia.com>',
            subject: '🔐 Tu contraseña de Judic-IA ha sido modificada',
            html: getHtmlEmail({
                heading: '🔐 Clave Modificada',
                bodyContent: `
                    <p>Hola estimado/a,</p>
                    <p>Le informamos que la contraseña de su cuenta profesional en <strong>Judic-IA</strong> ha sido modificada exitosamente.</p>
                    <p>Si usted realizó este cambio, puede ignorar este mensaje.</p>
                    <p style="color: #ef4444; margin-top: 20px;"><strong>¿No fue usted?</strong> Contacte a soporte inmediatamente.</p>
                `
            })
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error sending notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
