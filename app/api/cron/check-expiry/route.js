import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
    // Secure this endpoint (Vercel automatically injects CRON_SECRET)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const results = {
        renewed: [],
        downgraded: [],
        errors: []
    };

    try {
        const now = new Date();

        // 1. Get ALL users with plan_tier = 'professional' whom expiry is in the past
        // Also check for users in grace period whose grace period has ended
        const { data: profiles, error } = await supabase
            .from("profiles")
            .select("*")
            .or(`and(plan_tier.eq.professional,subscription_expiry.lt.${now.toISOString()}),and(subscription_status.eq.past_due,grace_period_ends_at.lt.${now.toISOString()})`);

        if (error) throw error;
        if (!profiles || profiles.length === 0) {
            return NextResponse.json({ message: "No expired subscriptions or grace periods found" });
        }

        console.log(`Checking ${profiles.length} expired subscriptions/grace periods...`);

        for (const profile of profiles) {
            try {
                // CASE A: Local status is cancelled -> Downgrade immediately
                if (profile.subscription_status === 'cancelled') {
                    await downgradeUser(supabase, profile.id);
                    results.downgraded.push(profile.id);
                    continue;
                }

                // CASE B: Local status is active -> Check MP
                if (!profile.mp_preapproval_id) {
                    // No MP ID but marked as pro? Weird. Downgrade safety.
                    await downgradeUser(supabase, profile.id);
                    results.downgraded.push(profile.id);
                    continue;
                }

                const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${profile.mp_preapproval_id}`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                const mpData = await mpRes.json();

                if (!mpRes.ok) {
                    console.error(`Error fetching MP for ${profile.id}:`, mpData);
                    results.errors.push({ id: profile.id, error: mpData });
                    continue;
                }

                // MP Status Mapping
                if (mpData.status === 'authorized') {
                    // It renewed! Update expiry.
                    // MP 'next_payment_date' is usually the FUTURE date.
                    // We can also assume +30 days if date is missing.
                    const nextPayment = mpData.next_payment_date ? new Date(mpData.next_payment_date) : null;
                    let newExpiry = nextPayment;

                    if (!newExpiry || newExpiry < now) {
                        // Fallback: Add 30 days to NOW
                        newExpiry = new Date();
                        newExpiry.setDate(newExpiry.getDate() + 30);
                    }

                    await supabase.from("profiles").update({
                        subscription_expiry: newExpiry.toISOString(),
                        subscription_status: 'active',
                        quota_reset_at: now.toISOString(),
                        grace_period_ends_at: null,
                        // Reset usage counters for new billing cycle
                        ai_messages_used: 0,
                        inquiries_used: 0,
                        research_reports_used: 0
                    }).eq("id", profile.id);

                    results.renewed.push(profile.id);

                } else if (['cancelled', 'paused'].includes(mpData.status)) {
                    // MP says it's over.
                    await downgradeUser(supabase, profile.id);
                    results.downgraded.push(profile.id);
                } else {
                    // Other status (pending, etc). Leave it for now or check payment attempts?
                    // Verify if 'status' is 'pending' might mean payment failed.
                    // For now, let's log it.
                    console.log(`Profile ${profile.id} has weird MP status: ${mpData.status}`);
                }

            } catch (err) {
                console.error(`Error processing profile ${profile.id}:`, err);
                results.errors.push({ id: profile.id, error: err.message });
            }
        }

        return NextResponse.json({ ok: true, results });

    } catch (error) {
        console.error("Cron Job Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function downgradeUser(supabase, userId) {
    const now = new Date();
    await supabase.from("profiles").update({
        plan_tier: 'free',
        subscription_status: 'inactive',
        quota_reset_at: now.toISOString(),
        grace_period_ends_at: null,
        // Reset to free tier limits (20 AI messages, 5 inquiries, 5 research reports)
        ai_messages_used: 0,
        inquiries_used: 0,
        research_reports_used: 0,
        mp_subscription_status: 'cancelled_by_system'
    }).eq("id", userId);
    console.log(`Downgraded user ${userId} to free tier.`);
}
