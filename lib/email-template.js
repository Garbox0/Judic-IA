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

export function getHtmlEmail({ heading, bodyContent, buttonText, buttonUrl, otpCode, previewText }) {
    const primaryColor = "#fbbf24"; // Gold
    const backgroundColor = "#0f172a"; // Dark Slate
    const containerColor = "#1e293b"; // Slightly Lighter Dark
    const textColor = "#e2e8f0"; // Light Gray/White

    // Logo URL - Ideally hosted. Using a placeholder or potentially a base64 if needed, 
    // but standard email practice is a hosted image. 
    // For now assuming existing logo path or text.

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${heading}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: ${backgroundColor}; font-family: 'Inter', sans-serif;">
        
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${backgroundColor}; width: 100%;">
            <tr>
                <td align="center" style="padding: 40px 10px;">
                    
                    <!-- MAIN CARD -->
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: ${backgroundColor}; border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                        
                        <!-- HEADER LOGO -->
                        <tr>
                            <td align="center" style="padding: 40px 0 20px 0;">
                                <h1 style="margin: 0; font-family: 'Playfair Display', serif; color: ${primaryColor}; font-size: 32px; font-weight: 800; letter-spacing: -1px;">Judic-IA</h1>
                            </td>
                        </tr>

                        <!-- HEADING -->
                        <tr>
                            <td align="center" style="padding: 0 40px;">
                                <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${heading}</h2>
                            </td>
                        </tr>

                        <!-- BODY CONTENT -->
                        <tr>
                            <td align="left" style="padding: 30px 40px; color: ${textColor}; font-size: 16px; line-height: 1.6;">
                                ${bodyContent}
                            </td>
                        </tr>

                        <!-- OTP BOX (If provided) -->
                        ${otpCode ? `
                        <tr>
                            <td align="center" style="padding: 10px 40px 30px 40px;">
                                <div style="background-color: rgba(251, 191, 36, 0.1); border: 1px solid ${primaryColor}; border-radius: 12px; padding: 20px; display: inline-block;">
                                    <span style="font-family: monospace; font-size: 32px; font-weight: 700; color: ${primaryColor}; letter-spacing: 5px;">${otpCode}</span>
                                </div>
                            </td>
                        </tr>
                        ` : ''}

                        <!-- CTA BUTTON (If provided) -->
                        ${(buttonText && buttonUrl) ? `
                        <tr>
                            <td align="center" style="padding: 10px 40px 40px 40px;">
                                <a href="${buttonUrl}" style="background-color: ${primaryColor}; color: #0f172a; padding: 16px 32px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px rgba(251, 191, 36, 0.25);">
                                    ${buttonText}
                                </a>
                            </td>
                        </tr>
                        ` : ''}

                        <!-- DIVIDER -->
                        <tr>
                            <td style="padding: 0 40px;">
                                <div style="height: 1px; background-color: rgba(255,255,255,0.1); width: 100%;"></div>
                            </td>
                        </tr>

                        <!-- FOOTER -->
                        <tr>
                            <td align="center" style="padding: 30px 40px 40px 40px;">
                                <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px; text-align: center;">
                                    Esta conexión es privada y está protegida por encriptación avanzada de grado legal.
                                </p>
                                <p style="margin: 0; color: #475569; font-size: 12px; text-align: center;">
                                    © ${new Date().getFullYear()} Judic-IA | Tecnología Legal Avanzada
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
