import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request) {
    try {
        console.log('🧪 [Test Email] Starting diagnostic test...');
        console.log('🔑 [Test Email] API Key exists:', !!process.env.RESEND_API_KEY);
        console.log('🔑 [Test Email] API Key prefix:', process.env.RESEND_API_KEY?.substring(0, 10));

        // Test 1: Send simple test email
        const testEmail = {
            from: 'Seguridad Judic-IA <security@judic-ia.com>',
            to: 'gbrlescalada@gmail.com', // Your admin email
            subject: '🧪 Test de Configuración Resend - Judic-IA',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #fbbf24;">✅ Resend está funcionando correctamente</h2>
                    <p>Este es un email de prueba para verificar la configuración de Resend.</p>
                    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                    <p><strong>Dominio:</strong> judic-ia.com</p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">
                        Si recibiste este email, significa que la integración con Resend está funcionando.
                    </p>
                </div>
            `
        };

        console.log('📧 [Test Email] Sending test email to:', testEmail.to);
        const result = await resend.emails.send(testEmail);

        if (result.error) {
            console.error('❌ [Test Email] Resend error:', result.error);
            return NextResponse.json({
                success: false,
                error: result.error,
                message: 'Resend API returned an error'
            }, { status: 500 });
        }

        console.log('✓ [Test Email] Success! Email ID:', result.data?.id);

        return NextResponse.json({
            success: true,
            emailId: result.data?.id,
            timestamp: new Date().toISOString(),
            message: 'Test email sent successfully! Check gbrlescalada@gmail.com'
        });

    } catch (error) {
        console.error('❌ [Test Email] Fatal error:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
