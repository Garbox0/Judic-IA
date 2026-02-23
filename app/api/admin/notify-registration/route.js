import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendEmail } from '../../../lib/resend';
import { getHtmlEmail } from '@/lib/email-template';
import { checkRateLimit, getClientIP } from '@/lib/rate-limiter';

export async function POST(request) {
    // 🛡️ Rate limiting (called during registration - no auth token available)
    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(`notify-reg:${ip}`, 3, 60000);
    if (!rateCheck.allowed) {
        return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429, headers: { 'Retry-After': '60' } }
        );
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
        return NextResponse.json({ error: "Resend API Key missing" }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);

    try {
        const body = await request.json();
        const { fullName, email, matricula, jurisdiccion, matriculas, date } = body;

        if (!email || !fullName) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Build matriculas table for email
        let matriculasHtml = '';
        if (Array.isArray(matriculas) && matriculas.length > 0) {
            const rows = matriculas.map(m =>
                `<tr>
                    <td style="padding:6px 10px;border:1px solid #e2e8f0;">${m.colegio || '-'}</td>
                    <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;">${m.tomo || '-'}</td>
                    <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;">${m.folio || '-'}</td>
                </tr>`
            ).join('');
            matriculasHtml = `
                <p><strong>Matrículas registradas (${matriculas.length}):</strong></p>
                <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:12px;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="padding:6px 10px;border:1px solid #e2e8f0;text-align:left;">Colegio</th>
                            <th style="padding:6px 10px;border:1px solid #e2e8f0;">Tomo</th>
                            <th style="padding:6px 10px;border:1px solid #e2e8f0;">Folio</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;
        } else {
            matriculasHtml = `<li><strong>Matrícula:</strong> ${matricula || 'No especificada'}</li>
                        <li><strong>Jurisdicción:</strong> ${jurisdiccion || 'No especificada'}</li>`;
        }

        // Send Email to Admin
        await sendEmail({
            resendClient: resend,
            to: 'gbrlescalada@gmail.com',
            from: 'Soporte Judic-IA <soporte@judic-ia.com>',
            subject: '🆕 Nuevo Abogado Registrado en Judic-IA',
            html: getHtmlEmail({
                heading: 'Nuevo Registro',
                bodyContent: `
                    <p>Hola Gabriel,</p>
                    <p>Se ha registrado un nuevo usuario profesional en la plataforma:</p>
                    <ul>
                        <li><strong>Nombre:</strong> ${fullName}</li>
                        <li><strong>Email:</strong> ${email}</li>
                        <li><strong>Fecha:</strong> ${date || new Date().toLocaleString()}</li>
                    </ul>
                    ${matriculasHtml}
                    <p>Por favor, revisa el panel de administración para verificar sus credenciales.</p>
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
