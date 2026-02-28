/**
 * POST /api/admin/update-org
 *
 * Verifica o rechaza un Estudio Jurídico desde el panel de administración.
 * Solo accesible por el admin (gbrlescalada@gmail.com).
 *
 * Body:
 *   { action: 'verify' | 'reject', orgId: string, rejection_reason?: string }
 */
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendEmail } from '@/app/lib/resend';
import { getHtmlEmail } from '@/lib/email-template';

export async function POST(request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';

    try {
        // Verificar que sea el admin
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authErr || !user || user.email !== 'gbrlescalada@gmail.com') {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { action, orgId, rejection_reason } = body;

        if (!orgId || !action) {
            return NextResponse.json({ error: 'Missing orgId or action' }, { status: 400 });
        }

        // Obtener org con owner
        const { data: org, error: orgErr } = await supabase
            .from('organizations')
            .select('*, owner:owner_id(id, full_name, email)')
            .eq('id', orgId)
            .single();

        if (orgErr || !org) {
            return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 });
        }

        const ownerEmail = org.owner?.email;
        const ownerName  = org.owner?.full_name || 'Titular';
        const ownerId    = org.owner?.id || org.owner_id;

        if (action === 'verify') {
            // 1. Marcar org como verificada
            await supabase
                .from('organizations')
                .update({ verification_status: 'verified', rejection_reason: null })
                .eq('id', orgId);

            // 2. Actualizar plan_tier del titular a 'enterprise'
            if (ownerId) {
                await supabase
                    .from('profiles')
                    .update({
                        plan_tier: 'enterprise',
                        verification_status: 'verified',
                    })
                    .eq('id', ownerId);

                // 2b. Levantar el ban (el owner estaba bloqueado hasta aprobación)
                await supabase.auth.admin.updateUser(ownerId, { ban_duration: 'none' });
            }

            // 3. Enviar email al titular
            if (ownerEmail) {
                await sendEmail({
                    resendClient: resend,
                    to: ownerEmail,
                    from: 'noreply@judic-ia.com',
                    subject: '✅ Tu Estudio Jurídico fue verificado — Judic-IA',
                    html: getHtmlEmail({
                        heading: '¡Estudio Verificado!',
                        bodyContent: `
                            <p>Hola <strong>${ownerName}</strong>,</p>
                            <p>El estudio <strong>${org.razon_social}</strong> fue verificado con éxito en Judic-IA.</p>
                            <p>Ya podés ingresar al panel con tu <strong>email y contraseña de registro</strong>. Una vez dentro, activá tu suscripción Enterprise para comenzar a trabajar con tu equipo.</p>
                            <p style="color:#6b7280;font-size:0.85rem;">Acceso: <strong>Panel Estudio</strong> en judic-ia.com</p>
                        `,
                        buttonText: 'Ingresar a Judic-IA',
                        buttonUrl: `${appUrl}/login`,
                    }),
                });
            }

            return NextResponse.json({ success: true, action: 'verified' });
        }

        if (action === 'reject') {
            // 1. Marcar org como rechazada
            await supabase
                .from('organizations')
                .update({
                    verification_status: 'rejected',
                    rejection_reason: rejection_reason || null,
                })
                .eq('id', orgId);

            // 2. Enviar email al titular
            if (ownerEmail) {
                await sendEmail({
                    resendClient: resend,
                    to: ownerEmail,
                    from: 'hola@judic-ia.com',
                    subject: '⚠️ Necesitamos que corrijas un dato — Judic-IA',
                    html: getHtmlEmail({
                        heading: 'Corrección de datos requerida',
                        bodyContent: `
                            <p>Hola <strong>${ownerName}</strong>,</p>
                            <p>Recibimos tu solicitud para registrar el estudio <strong>${org.razon_social}</strong> pero necesitamos que corrijas la siguiente información antes de poder aprobarte:</p>
                            ${rejection_reason ? `<div style="background:#fff1f2;border-left:4px solid #f43f5e;padding:12px 16px;border-radius:6px;margin:16px 0;font-size:0.95rem;"><strong>Datos a corregir:</strong><br/><br/>${rejection_reason}</div>` : ''}
                            <p><strong>Respondé directamente a este email</strong> con los datos corregidos y procesaremos tu solicitud a la brevedad.</p>
                        `,
                        buttonText: 'Registrar otro estudio',
                        buttonUrl: `${appUrl}/registro-estudio`,
                    }),
                });
            }

            return NextResponse.json({ success: true, action: 'rejected' });
        }

        return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });

    } catch (err) {
        console.error('[admin/update-org] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
