/**
 * POST /api/mp/org-subscription/cancel
 *
 * Cancela la suscripción enterprise de una organización.
 * Solo el owner puede ejecutarlo.
 * Mantiene acceso hasta que vence la suscripción actual.
 *
 * Body: { orgId }
 * Returns: { ok }
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
        // 1. Auth
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 2. Body
        const body = await request.json().catch(() => null);
        const { orgId } = body || {};
        if (!orgId) return NextResponse.json({ error: 'Falta orgId' }, { status: 400 });

        // 3. Verificar owner + obtener datos de la org
        const { data: member } = await supabase
            .from('org_members')
            .select('role, org:org_id(id, razon_social, mp_preapproval_id, subscription_expiry, plan_tier)')
            .eq('user_id', user.id)
            .eq('org_id', orgId)
            .single();

        if (!member || member.role !== 'owner') {
            return NextResponse.json({ error: 'Solo el titular puede cancelar la suscripción' }, { status: 403 });
        }

        const org = member.org;

        // 4. Cancelar en MercadoPago (si hay preapproval_id)
        let mpCancelled = false;
        if (org?.mp_preapproval_id) {
            const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
            try {
                const mpRes = await fetch(
                    `https://api.mercadopago.com/preapproval/${org.mp_preapproval_id}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({ status: 'cancelled' }),
                    }
                );
                mpCancelled = mpRes.ok;
            } catch (err) {
                console.error('[org-subscription/cancel] MP cancel failed:', err.message);
            }
        }

        // 5. Actualizar DB (cancelado, pero mantiene acceso hasta subscription_expiry)
        await supabase
            .from('organizations')
            .update({
                subscription_status: 'cancelled',
                mp_subscription_status: mpCancelled ? 'cancelled' : 'manual_cancellation',
            })
            .eq('id', orgId);

        // 6. Email de confirmación al owner
        try {
            const expiryStr = org?.subscription_expiry
                ? new Date(org.subscription_expiry).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
                : null;

            await sendEmail({
                resendClient: resend,
                to: user.email,
                from: 'billing@judic-ia.com',
                subject: 'Confirmación de cancelación — Judic-IA Enterprise',
                html: getHtmlEmail({
                    heading: 'Suscripción cancelada',
                    bodyContent: `
                        <p>Hola,</p>
                        <p>La suscripción Enterprise del estudio <strong>${org?.razon_social || orgId}</strong> fue cancelada.</p>
                        ${expiryStr ? `<p>Tu estudio mantiene acceso completo hasta el <strong>${expiryStr}</strong>.</p>` : ''}
                        <p>Si fue un error o querés reactivarla, podés hacerlo desde el panel del estudio.</p>
                    `,
                    buttonText: 'Ir al Panel',
                    buttonUrl: `${appUrl}/dashboard/estudio/suscripcion`,
                }),
            });
        } catch (emailErr) {
            console.error('[org-subscription/cancel] Email failed:', emailErr.message);
        }

        return NextResponse.json({ ok: true });

    } catch (err) {
        console.error('[org-subscription/cancel] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
