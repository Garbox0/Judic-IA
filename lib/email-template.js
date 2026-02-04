/**
 * JUDIC-IA GLOBAL EMAIL TEMPLATE
 * Reusable HTML template for transactional emails.
 * 
 * Usage:
 * const html = getHtmlEmail({
 *   heading: "Bienvenido Colega",
 *   bodyContent: "<p>Hola...</p>",
 *   buttonText: "Activar Cuenta", // Optional
 *   buttonUrl: "https://...",      // Optional
 *   otpCode: "123456"              // Optional (Mutually exclusive with button usually, but can exist together)
 * });
 */

export function getHtmlEmail({ heading, bodyContent, buttonText, buttonUrl, otpCode, footerLinks }) {
    const primaryColor = "#fbbf24"; // Gold
    const backgroundColor = "#0f172a"; // Dark Slate
    const containerColor = "#1e293b"; // Slightly Lighter Dark
    const textColor = "#e2e8f0"; // Light Gray/White
    const logoUrl = "https://judic-ia.com/judic-ia-mark.png";

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${heading}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: ${backgroundColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${backgroundColor}; width: 100%;">
            <tr>
                <td align="center" style="padding: 40px 10px;">
                    
                    <!-- MAIN CARD -->
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: ${backgroundColor}; border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
                        
                        <!-- HEADER LOGO -->
                        <tr>
                            <td align="center" style="padding: 45px 0 25px 0;">
                                <img src="${logoUrl}" alt="Judic-IA" width="50" style="display: block; margin-bottom: 15px;">
                                <h1 style="margin: 0; color: ${primaryColor}; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">Judic-IA</h1>
                            </td>
                        </tr>

                        <!-- HEADING -->
                        <tr>
                            <td align="center" style="padding: 0 40px;">
                                <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; line-height: 1.2;">${heading}</h2>
                            </td>
                        </tr>

                        <!-- BODY CONTENT -->
                        <tr>
                            <td align="left" style="padding: 30px 40px; color: ${textColor}; font-size: 16px; line-height: 1.7;">
                                ${bodyContent}
                            </td>
                        </tr>

                        <!-- OTP BOX (If provided) -->
                        ${otpCode ? `
                        <tr>
                            <td align="center" style="padding: 10px 40px 30px 40px;">
                                <div style="background-color: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 25px; display: inline-block;">
                                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 700; color: ${primaryColor}; letter-spacing: 8px;">${otpCode}</span>
                                </div>
                            </td>
                        </tr>
                        ` : ''}

                        <!-- CTA BUTTON (If provided) -->
                        ${(buttonText && buttonUrl) ? `
                        <tr>
                            <td align="center" style="padding: 10px 40px 40px 40px;">
                                <a href="${buttonUrl}" style="background-color: ${primaryColor}; color: #0f172a; padding: 18px 36px; border-radius: 10px; font-weight: 800; text-decoration: none; display: inline-block; font-size: 16px; box-shadow: 0 8px 15px rgba(251, 191, 36, 0.2);">
                                    ${buttonText}
                                </a>
                            </td>
                        </tr>
                        ` : ''}

                        <!-- DIVIDER -->
                        <tr>
                            <td style="padding: 0 40px;">
                                <div style="height: 1px; background-color: rgba(255,255,255,0.08); width: 100%;"></div>
                            </td>
                        </tr>

                        <!-- FOOTER -->
                        <tr>
                            <td align="center" style="padding: 30px 40px 40px 40px;">
                                <p style="margin: 0 0 15px 0; color: #94a3b8; font-size: 13px; text-align: center; line-height: 1.5;">
                                    Plataforma líder en Inteligencia Jurídica para abogados modernos.
                                </p>
                                
                                <div style="margin-bottom: 20px;">
                                    ${footerLinks ? footerLinks.map(link => `
                                        <a href="${link.url}" style="color: ${primaryColor}; text-decoration: none; font-size: 12px; font-weight: 700; margin: 0 10px; text-transform: uppercase;">${link.label}</a>
                                    `).join('') : ''}
                                </div>

                                <p style="margin: 0; color: #475569; font-size: 11px; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
                                    © ${new Date().getFullYear()} Judic-IA | Corrientes, Argentina
                                </p>
                            </td>
                        </tr>

                    </table>
                    
                </td>
            </tr>
        </table>
        
    </body>
    </html>
    `;
}
