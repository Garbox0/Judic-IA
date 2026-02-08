/**
 * EMAIL TEMPLATE GENERATOR
 * Genera HTML emails con estilo consistente
 */

export function getHtmlEmail({
    heading = '',
    bodyContent = '',
    buttonText = '',
    buttonUrl = '',
    otpCode = '',
    footerLinks = []
}) {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px; text-align: center;">
                            <h1 style="margin: 0; color: #fbbf24; font-size: 28px;">⚖️ Judic-IA</h1>
                            ${heading ? `<p style="margin: 10px 0 0 0; color: #cbd5e1;">${heading}</p>` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px; color: #334155; line-height: 1.6;">
                            ${bodyContent}
                        </td>
                    </tr>
                    ${otpCode ? `
                    <tr>
                        <td align="center" style="padding: 0 30px 30px 30px;">
                            <div style="background-color: #0f172a; border-radius: 12px; padding: 24px 40px; display: inline-block; border: 2px solid #fbbf24;">
                                <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #fbbf24; font-family: 'Courier New', monospace;">${otpCode}</span>
                            </div>
                            <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">Este código expira en 15 minutos</p>
                        </td>
                    </tr>
                    ` : ''}
                    ${buttonText && buttonUrl ? `
                    <tr>
                        <td align="center" style="padding: 0 30px 40px 30px;">
                            <a href="${buttonUrl}" style="display: inline-block; background-color: #fbbf24; color: #0f172a; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                                ${buttonText}
                            </a>
                        </td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #64748b; font-size: 13px;">© ${new Date().getFullYear()} Judic-IA</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}
