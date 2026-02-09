import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuthAndOwnership } from "@/lib/api-auth";

export async function POST(req) {
    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: "missing user_id" }, { status: 400 });

    // 🛡️ Verify authenticated user matches the requested user_id
    const auth = await verifyAuthAndOwnership(req, user_id);
    if (auth.error) return auth.response;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
        .from("profiles")
        .update({
            plan_tier: "trial",
            subscription_status: "active",
            trial_ends_at: expires,
            ai_messages_used: 0,
            inquiries_used: 0,
            quota_reset_at: new Date().toISOString()
        })
        .eq("id", user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, trial_ends_at: expires, demo_expires_at: expires });
}
