/**
 * EMAIL TEMPLATE GENERATOR
 * Genera HTML emails con estilo consistente
 */

/**
 * Sanitize user-provided strings to prevent XSS in HTML emails.
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function getHtmlEmail({
    heading = '',
    bodyContent = '',
    buttonText = '',
    buttonUrl = '',
    otpCode = '',
    footerLinks = []
}) {
    const safeHeading = escapeHtml(heading);
    const safeButtonText = escapeHtml(buttonText);
    const safeOtpCode = escapeHtml(otpCode);

    const footerLinksHtml = footerLinks.length > 0
        ? `<p style="margin: 8px 0 0 0; font-size: 12px;">${footerLinks.map(
            link => `<a href="${escapeHtml(link.url)}" style="color: #94a3b8; text-decoration: underline; margin: 0 8px;">${escapeHtml(link.label)}</a>`
        ).join(' | ')}</p>`
        : '';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeHeading}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px; text-align: center;">
                            <img src="https://judic-ia.com/judic-ia-mark.png" alt="Judic-IA" style="height: 48px; width: auto; display: block; margin: 0 auto 12px auto;" />
                            <span style="color: #fbbf24; font-size: 22px; font-weight: 700; letter-spacing: 0.02em;">Judic-IA</span>
                            ${safeHeading ? `<p style="margin: 10px 0 0 0; color: #cbd5e1; font-size: 15px;">${safeHeading}</p>` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px; color: #334155; line-height: 1.6;">
                            ${bodyContent}
                        </td>
                    </tr>
                    ${safeOtpCode ? `
                    <tr>
                        <td align="center" style="padding: 0 30px 30px 30px;">
                            <div style="background-color: #0f172a; border-radius: 12px; padding: 24px 40px; display: inline-block; border: 2px solid #fbbf24;">
                                <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #fbbf24; font-family: 'Courier New', monospace;">${safeOtpCode}</span>
                            </div>
                            <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">Este código expira en 15 minutos</p>
                        </td>
                    </tr>
                    ` : ''}
                    ${safeButtonText && buttonUrl ? `
                    <tr>
                        <td align="center" style="padding: 0 30px 40px 30px;">
                            <a href="${escapeHtml(buttonUrl)}" style="display: inline-block; background-color: #fbbf24; color: #0f172a; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                                ${safeButtonText}
                            </a>
                        </td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #64748b; font-size: 13px;">© ${new Date().getFullYear()} Judic-IA</p>
                            ${footerLinksHtml}
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

