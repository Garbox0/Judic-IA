import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get('cid');

    if (!cid) {
        return NextResponse.json({ claimed: false });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        console.error("Missing service role key");
        return NextResponse.json({ claimed: false });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
    });

    try {
        const { data: inquiry } = await adminClient
            .from('inquiries')
            .select('claimed_by_email')
            .eq('id', cid)
            .maybeSingle();

        const isClaimed = !!inquiry?.claimed_by_email;
        console.log(`🔍 CID ${cid} claimed check: ${isClaimed}`);

        return NextResponse.json({ claimed: isClaimed });
    } catch (error) {
        console.error("Error checking CID claim:", error);
        return NextResponse.json({ claimed: false });
    }
}
