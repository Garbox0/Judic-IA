import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendEmail } from '../../../lib/resend';
import { getHtmlEmail } from '../../../lib/email-template';

export async function POST(request) {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
        return NextResponse.json({ error: "Resend API Key missing" }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);

    try {
        const body = await request.json();
        const { fullName, email, matricula, jurisdiccion, date } = body;

        if (!email || !fullName) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Send Email to Admin
        await sendEmail({
            resendClient: resend,
            to: 'gbrlescalada@gmail.com',
            from: 'noreply@judic-ia.com',
            subject: '🆕 Nuevo Abogado Registrado en Judic-IA',
            html: getHtmlEmail({
                heading: 'Nuevo Registro',
                bodyContent: `
                    <p>Hola Gabriel,</p>
                    <p>Se ha registrado un nuevo usuario profesional en la plataforma:</p>
                    <ul>
                        <li><strong>Nombre:</strong> ${fullName}</li>
                        <li><strong>Email:</strong> ${email}</li>
                        <li><strong>Matrícula:</strong> ${matricula || 'No especificada'}</li>
                        <li><strong>Jurisdicción:</strong> ${jurisdiccion || 'No especificada'}</li>
                        <li><strong>Fecha:</strong> ${date || new Date().toLocaleString()}</li>
                    </ul>
                    <p>Por favor, revisa el panel de administración para verificar sus credenciales si es necesario.</p>
                `,
                buttonText: 'Ir al Panel Admin',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com'}/dashboard/admin`,
                footerLinks: []
            })
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error sending admin notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
