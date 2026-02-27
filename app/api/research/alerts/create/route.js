import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/api-auth';

const ALLOWED_PORTALS = new Set(['PJN', 'SCBA', 'CABA', 'CSJN_SORTEOS']);
const ALLOWED_FREQUENCIES = new Set(['daily', 'weekly']);

function cleanText(value) {
    return String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function inferQueryType(query) {
    return /(\d{1,8})\s*\/\s*(\d{4})/.test(query)
        ? 'por_expediente'
        : 'por_parte';
}

async function refundOneAlertCredit(supabase, userId) {
    try {
        const { error } = await supabase.rpc('add_alert_credits', {
            p_user_id: userId,
            p_credits: 1
        });

        if (error) {
            throw error;
        }
    } catch (err) {
        console.error('[alerts/create] refund error:', err?.message || err);
    }
}

export async function POST(request) {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.response;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await request.json().catch(() => ({}));
    const portal = cleanText(body?.portal || '').toUpperCase();
    const searchQuery = cleanText(body?.search_query || body?.query || '');
    const frequency = cleanText(body?.frequency || 'daily').toLowerCase();
    const jurisdiction = cleanText(body?.jurisdiction || '');
    const fueroId = cleanText(body?.fuero_id || '');

    if (!ALLOWED_PORTALS.has(portal)) {
        return NextResponse.json({ error: 'PORTAL_INVALIDO' }, { status: 400 });
    }

    if (!ALLOWED_FREQUENCIES.has(frequency)) {
        return NextResponse.json({ error: 'FREQUENCY_INVALIDA' }, { status: 400 });
    }

    if (!searchQuery || searchQuery.length < 3) {
        return NextResponse.json({ error: 'QUERY_INVALIDA' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_status, plan_tier, alert_credits_extra')
        .eq('id', auth.user.id)
        .maybeSingle();

    if (profileError) {
        console.error('[alerts/create] profile error:', profileError.message);
        return NextResponse.json({ error: 'PROFILE_LOAD_FAILED' }, { status: 500 });
    }

    const hasActiveSub =
        profile?.subscription_status === 'active' ||
        profile?.subscription_status === 'past_due' ||
        profile?.plan_tier === 'enterprise';

    if (!hasActiveSub) {
        return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED' }, { status: 403 });
    }

    const currentAlertCredits = Number(profile?.alert_credits_extra || 0);
    if (!Number.isFinite(currentAlertCredits) || currentAlertCredits < 1) {
        return NextResponse.json({ error: 'ALERT_CREDITS_EXHAUSTED' }, { status: 403 });
    }

    const { data: consumeResult, error: debitError } = await supabase.rpc('consume_alert_credit', {
        p_user_id: auth.user.id,
        p_amount: 1
    });

    if (debitError) {
        console.error('[alerts/create] debit error:', debitError.message || debitError);
        return NextResponse.json({ error: 'ALERT_CREDIT_DEBIT_FAILED' }, { status: 500 });
    }

    if (consumeResult !== 'consumed') {
        return NextResponse.json({ error: 'ALERT_CREDITS_EXHAUSTED' }, { status: 403 });
    }

    const insertPayload = {
        user_id: auth.user.id,
        portal,
        query_type: inferQueryType(searchQuery),
        query_value: searchQuery,
        jurisdiction_id: jurisdiction || 'general',
        fuero_id: fueroId || null,
        frequency,
        is_active: true,
        search_query: searchQuery,
        jurisdiction: jurisdiction || null,
        last_new_count: 0
    };

    const { data: createdAlert, error: insertError } = await supabase
        .from('case_alerts')
        .insert(insertPayload)
        .select('id, portal, query_value, search_query, frequency, created_at')
        .single();

    if (insertError) {
        console.error('[alerts/create] insert error:', insertError.message);
        await refundOneAlertCredit(supabase, auth.user.id);
        return NextResponse.json({ error: 'CREATE_CASE_ALERT_FAILED' }, { status: 500 });
    }

    const { data: profileAfter } = await supabase
        .from('profiles')
        .select('alert_credits_extra')
        .eq('id', auth.user.id)
        .maybeSingle();

    return NextResponse.json({
        ok: true,
        alert: createdAlert,
        credits_left: Number(profileAfter?.alert_credits_extra || 0)
    });
}
