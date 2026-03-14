import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/api-auth';

const ALLOWED_PORTALS = new Set(['PJN', 'SCBA', 'CSJN_SORTEOS', 'CABA']);
const COMING_SOON_PORTALS = new Set();
const ALLOWED_FREQUENCIES = new Set(['daily', 'weekly']);

function isFutureDate(value) {
    if (!value) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed > new Date();
}

function hasActivePaidSubscription(profile) {
    if (!profile) return false;
    if (profile.role === 'admin') return true;       // admin siempre habilitado
    if (profile.plan_tier === 'enterprise') return true;
    if (profile.plan_tier !== 'professional') return false;

    if (profile.subscription_status === 'active') {
        return isFutureDate(profile.subscription_expiry);
    }

    if (profile.subscription_status === 'past_due') {
        return isFutureDate(profile.grace_period_ends_at);
    }

    return false;
}

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

    if (COMING_SOON_PORTALS.has(portal)) {
        return NextResponse.json({ error: 'PORTAL_PROXIMAMENTE' }, { status: 400 });
    }

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
        .select('role, subscription_status, plan_tier, subscription_expiry, grace_period_ends_at, alert_credits_extra, org_id')
        .eq('id', auth.user.id)
        .maybeSingle();

    if (profileError) {
        console.error('[alerts/create] profile error:', profileError.message);
        return NextResponse.json({ error: 'PROFILE_LOAD_FAILED' }, { status: 500 });
    }

    const hasActiveSub = hasActivePaidSubscription(profile);

    if (!hasActiveSub) {
        return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED' }, { status: 403 });
    }

    // ─── ORG ALERT POOL CHECK ───────────────────────────────────────────────
    let useOrgAlertPool = false;
    let orgIdForAlert = null;

    if (profile.org_id) {
        const { data: orgData } = await supabase
            .from('organizations')
            .select('type, verification_status, alert_credits_pool')
            .eq('id', profile.org_id)
            .maybeSingle();

        if (orgData?.type === 'estudio' && orgData?.verification_status === 'verified') {
            useOrgAlertPool = true;
            orgIdForAlert = profile.org_id;
            if ((orgData.alert_credits_pool ?? 0) <= 0) {
                return NextResponse.json({ error: 'ALERT_CREDITS_EXHAUSTED' }, { status: 403 });
            }
        }
    }

    // ─── CONSUME CREDIT ─────────────────────────────────────────────────────
    if (useOrgAlertPool) {
        const { data: consumeResult, error: debitError } = await supabase.rpc('consume_org_alert_credit', {
            p_org_id: orgIdForAlert,
        });
        if (debitError) {
            console.error('[alerts/create] org debit error:', debitError.message);
            return NextResponse.json({ error: 'ALERT_CREDIT_DEBIT_FAILED' }, { status: 500 });
        }
        if (consumeResult !== 'ok') {
            return NextResponse.json({ error: 'ALERT_CREDITS_EXHAUSTED' }, { status: 403 });
        }
    } else {
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
        if (useOrgAlertPool) {
            await supabase.rpc('add_org_alert_credits', { p_org_id: orgIdForAlert, p_credits: 1 });
        } else {
            await refundOneAlertCredit(supabase, auth.user.id);
        }
        return NextResponse.json({ error: 'CREATE_CASE_ALERT_FAILED' }, { status: 500 });
    }

    // Log usage for org pool
    if (useOrgAlertPool && orgIdForAlert) {
        await supabase.from('org_alert_credit_usage').insert({
            org_id: orgIdForAlert,
            used_by: auth.user.id,
            alert_id: createdAlert.id,
        });
    }

    let creditsLeft = 0;
    if (useOrgAlertPool) {
        const { data: orgAfter } = await supabase
            .from('organizations').select('alert_credits_pool').eq('id', orgIdForAlert).single();
        creditsLeft = orgAfter?.alert_credits_pool ?? 0;
    } else {
        const { data: profileAfter } = await supabase
            .from('profiles').select('alert_credits_extra').eq('id', auth.user.id).maybeSingle();
        creditsLeft = Number(profileAfter?.alert_credits_extra || 0);
    }

    return NextResponse.json({
        ok: true,
        alert: createdAlert,
        credits_left: creditsLeft,
    });
}
