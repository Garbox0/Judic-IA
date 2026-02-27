import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendEmail } from '../../../lib/resend';
import { getHtmlEmail } from '@/lib/email-template';
import { checkRateLimit, getClientIP } from '@/lib/rate-limiter';

const PLAN_LABELS = {
    enterprise_s:  'Enterprise S — Hasta 5 miembros ($89.000/mes)',
    enterprise_m:  'Enterprise M — Hasta 10 miembros ($149.000/mes)',
    enterprise_l:  'Enterprise L — Hasta 20 miembros ($249.000/mes)',
    enterprise_xl: 'Enterprise XL — Ilimitado ($449.000/mes)',
};

export async function POST(request) {
    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(`notify-estudio:${ip}`, 5, 60000);
    if (!rateCheck.allowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        return NextResponse.json({ error: 'Resend API Key missing' }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);

    try {
        const body = await request.json();
        const { razon_social, cuit, domicilio, phone, titular_name, titular_email, matriculas, plan_tier, org_id } = body;

        if (!razon_social || !titular_email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Tabla de matrículas del titular
        const matriculasHtml = Array.isArray(matriculas) && matriculas.length > 0
            ? `<p><strong>Matrículas del Titular (${matriculas.length}):</strong></p>
               <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:12px;">
                 <thead>
                   <tr style="background:#f1f5f9;">
                     <th style="padding:6px 10px;border:1px solid #e2e8f0;text-align:left;">Colegio</th>
                     <th style="padding:6px 10px;border:1px solid #e2e8f0;">Tomo</th>
                     <th style="padding:6px 10px;border:1px solid #e2e8f0;">Folio</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${matriculas.map(m => `<tr>
                     <td style="padding:6px 10px;border:1px solid #e2e8f0;">${m.colegio || '-'}</td>
                     <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;">${m.tomo || '-'}</td>
                     <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;">${m.folio || '-'}</td>
                   </tr>`).join('')}
                 </tbody>
               </table>`
            : '<p>Sin matrículas registradas.</p>';

        await sendEmail({
            resendClient: resend,
            to: 'gbrlescalada@gmail.com',
            from: 'Soporte Judic-IA <soporte@judic-ia.com>',
            subject: '🏛️ Nuevo Estudio Jurídico — Solicitud de verificación',
            html: getHtmlEmail({
                heading: 'Nuevo Estudio Jurídico',
                bodyContent: `
                    <p>Hola Gabriel,</p>
                    <p>Un nuevo estudio jurídico solicitó registro en Judic-IA:</p>
                    <div style="background:#f8f7f4;border-radius:10px;padding:16px;margin:12px 0;">
                      <p style="margin:0 0 6px;"><strong>Razón Social:</strong> ${razon_social}</p>
                      <p style="margin:0 0 6px;"><strong>CUIT:</strong> ${cuit || '-'}</p>
                      <p style="margin:0 0 6px;"><strong>Domicilio:</strong> ${domicilio || '-'}</p>
                      <p style="margin:0;"><strong>Teléfono:</strong> ${phone || '-'}</p>
                    </div>
                    <p><strong>Titular:</strong> ${titular_name} &lt;${titular_email}&gt;</p>
                    ${matriculasHtml}
                    <p><strong>Plan solicitado:</strong> ${PLAN_LABELS[plan_tier] || plan_tier}</p>
                    <p style="font-size:13px;color:#888;">ID de org: ${org_id || '-'}</p>
                    <p>Verificá el CUIT en ARCA y la matrícula del titular antes de aprobar.</p>
                `,
                buttonText: 'Verificar en Panel Admin',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com'}/dashboard/admin`,
                footerLinks: [],
            }),
        });

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error('[notify-estudio-registration] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
