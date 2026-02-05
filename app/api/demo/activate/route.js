import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: "missing user_id" }, { status: 400 });

    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
        .from("profiles")
        .update({
            plan_tier: "starter",
            subscription_status: "demo",
            demo_expires_at: expires,
            ai_message_quota: 20,
            ai_messages_used: 0,
            inquiry_quota: 3,
            inquiries_used: 0,
        })
        .eq("id", user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, demo_expires_at: expires });
}
