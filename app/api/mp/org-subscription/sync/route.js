/**
 * POST /api/mp/org-subscription/sync
 *
 * Sincroniza el estado de la suscripción enterprise con MercadoPago.
 * Se llama cuando el owner vuelve del checkout (?status=success).
 * Solo el owner puede ejecutarlo.
 *
 * Body: { orgId }
 * Returns: { ok, status }
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

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

        // 3. Verificar owner
        const { data: member } = await supabase
            .from('org_members')
            .select('role')
            .eq('user_id', user.id)
            .eq('org_id', orgId)
            .single();

        if (!member || member.role !== 'owner') {
            return NextResponse.json({ error: 'Solo el titular puede sincronizar la suscripción' }, { status: 403 });
        }

        // 4. Buscar la suscripción en MP por external_reference
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        const externalRef = `org_sub:${orgId}`;

        const searchUrl = new URL('https://api.mercadopago.com/preapproval/search');
        searchUrl.searchParams.set('status', 'authorized');
        searchUrl.searchParams.set('external_reference', externalRef);

        const r = await fetch(searchUrl.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        const searchData = await r.json();
        const sub = searchData?.results?.[0];

        if (!sub || sub.status !== 'authorized') {
            return NextResponse.json({ ok: false, status: 'not_found' });
        }

        // 5. Actualizar la org en Supabase
        const now = new Date();
        // Usar la fecha real de próximo cobro que devuelve MP (next_payment_date).
        // Fallback a +30 días si MP no la incluye aún (suscripción muy reciente).
        const mpNextPayment = sub.next_payment_date ? new Date(sub.next_payment_date) : null;
        const expiryDate = (mpNextPayment && !isNaN(mpNextPayment)) ? mpNextPayment : (() => {
            const d = new Date(now);
            d.setDate(d.getDate() + 30);
            return d;
        })();

        await supabase
            .from('organizations')
            .update({
                subscription_status: 'active',
                mp_preapproval_id: sub.id,
                mp_subscription_status: sub.status,
                subscription_started_at: now.toISOString(),
                subscription_expiry: expiryDate.toISOString(),
            })
            .eq('id', orgId);

        return NextResponse.json({ ok: true, status: 'active', subscription_expiry: expiryDate.toISOString() });

    } catch (err) {
        console.error('[org-subscription/sync] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
