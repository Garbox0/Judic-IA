import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendEmail } from '@/app/lib/resend';

export async function POST(request) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        // 1. Verify Requester is the unique allowed Admin (Gabriel)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user || user.email !== 'gbrlescalada@gmail.com') {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { userId, updates } = await request.json();

        if (!userId || !updates) {
            return NextResponse.json({ error: 'Missing userId or updates' }, { status: 400 });
        }

        // 🛡️ SECURITY: Prevent self-demotion or other critical role changes via this API if necessary
        // In this case, we trust the hardcoded email check above.

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        // 📧 Handle Email Notifications based on verification_status
        if (updates.verification_status && data) {
            const userEmail = data.email;
            if (userEmail) {
                if (updates.verification_status === 'verified') {
                    await sendEmail({
                        resendClient: resend,
                        to: userEmail,
                        subject: '¡Felicidades! Tu matrícula ha sido verificada con éxito',
                        html: `
                            <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
                                <h1 style="color: #fbbf24;">¡Felicidades!</h1>
                                <p>Hola <strong>${data.full_name || ''}</strong>,</p>
                                <p>Te informamos que tu matrícula profesional ha sido verificada con éxito en <strong>Judic-IA</strong>.</p>
                                <p>Ahora tienes acceso completo a las funciones exclusivas para abogados verificados.</p>
                                <br/>
                                <p>Saludos,<br/>El equipo de Judic-IA</p>
                            </div>
                        `
                    });
                } else if (updates.verification_status === 'rejected') {
                    await sendEmail({
                        resendClient: resend,
                        to: userEmail,
                        subject: 'Judic-IA: No hemos podido validar tu matrícula',
                        html: `
                            <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
                                <h2 style="color: #f43f5e;">Aviso de Verificación</h2>
                                <p>Hola <strong>${data.full_name || ''}</strong>,</p>
                                <p>Te informamos que no hemos podido validar tu matrícula profesional con los datos proporcionados.</p>
                                <p style="background: #fff1f2; padding: 15px; border-left: 4px solid #f43f5e;">
                                    <strong>Recomendación:</strong> Por favor, ingresa a tus ajustes y revisa que el colegio, tomo y folio estén escritos correctamente según tu credencial oficial.
                                </p>
                                <p>Una vez corregidos, nuestro equipo volverá a revisar tu perfil automáticamente.</p>
                                <br/>
                                <p>Saludos,<br/>El equipo de Judic-IA</p>
                            </div>
                        `
                    });
                }
            }
        }

        return NextResponse.json({ success: true, data });

    } catch (error) {
        console.error('Error in Admin Update API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
