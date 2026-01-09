// Helper puro - No lee process.env para compatibilidad con Turbopack
export async function sendEmail({ resendClient, to, subject, html, from = 'no-reply@judic-ia.com' }) {
    if (!resendClient) {
        console.warn("⚠️ Resend Client missing. Email not sent.");
        return null;
    }

    try {
        const data = await resendClient.emails.send({
            from: `Judic-IA <${from}>`,
            to,
            subject,
            html,
        });
        console.log("✅ Email sent:", data);
        return data;
    } catch (error) {
        console.error("❌ Error sending email:", error);
        return null;
    }
}
