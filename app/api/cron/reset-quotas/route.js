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

    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Find all users whose quota_reset_at is older than 30 days
        const { data: profiles, error } = await supabase
            .from("profiles")
            .select("id, plan_tier, quota_reset_at")
            .or(`quota_reset_at.lt.${thirtyDaysAgo.toISOString()},quota_reset_at.is.null`);

        if (error) throw error;

        if (!profiles || profiles.length === 0) {
            return NextResponse.json({
                ok: true,
                message: "No profiles need quota reset",
                count: 0
            });
        }

        console.log(`🔄 Resetting quotas for ${profiles.length} users...`);

        // Reset quotas for all eligible users
        const results = {
            success: [],
            errors: []
        };

        for (const profile of profiles) {
            try {
                // Use the SQL function we created for atomic quota reset
                const { error: resetError } = await supabase.rpc('reset_user_quotas', {
                    p_user_id: profile.id
                });

                if (resetError) throw resetError;
                results.success.push(profile.id);
            } catch (err) {
                console.error(`Error resetting quotas for user ${profile.id}:`, err);
                results.errors.push({ id: profile.id, error: err.message });
            }
        }

        return NextResponse.json({
            ok: true,
            message: `Successfully reset quotas for ${results.success.length} users`,
            count: results.success.length,
            errors: results.errors.length > 0 ? results.errors : undefined
        });

    } catch (error) {
        console.error("Cron Job Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
