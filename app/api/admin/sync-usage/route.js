import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Service Role to access all data and update profiles
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        // 1. Verify User Session (Security Check)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify token (although AdminGuard protects UI, API needs protection too)
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
            authHeader.replace('Bearer ', '')
        );

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch all profiles
        const { data: profiles, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, plan_tier, subscription_expiry, email');

        if (profileError) throw profileError;

        let stats = { updated: 0, errors: 0 };

        // 3. Iterate and Sync
        for (const profile of profiles) {
            // A. Count actual messages in history
            // usage is linked via inquiries: messages -> inquiry -> assigned_lawyer_id
            const { count, error: countError } = await supabaseAdmin
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'assistant') // Count only AI replies? Or user messages too? Usually usage is AI responses.
            // We need to join with inquiries to filter by lawyer. 
            // Since Supabase simple join in count might be tricky, we might need a workaround or RPC if dataset is huge.
            // For MVP/small scale: Fetch inquiry IDs for this lawyer, then count messages in those inquiries.

            /* status: complex join needed. 
               Alternative: Create a view or RPC. 
               Let's try a direct approach: 
               We need to count messages where inquiry.assigned_lawyer_id == profile.id
            */

            // Step 3.1: Get all inquiry IDs for this lawyer
            const { data: inquiries } = await supabaseAdmin
                .from('inquiries')
                .select('id')
                .eq('assigned_lawyer_id', profile.id);

            const inquiryIds = inquiries?.map(i => i.id) || [];

            let realUsage = 0;
            if (inquiryIds.length > 0) {
                const { count: msgCount } = await supabaseAdmin
                    .from('messages')
                    .select('id', { count: 'exact', head: true })
                    .in('inquiry_id', inquiryIds)
                    .eq('role', 'assistant'); // Charging for AI responses
                realUsage += (msgCount || 0);
            }

            // Step 3.1.5: Count Research Reports
            const { count: researchCount } = await supabaseAdmin
                .from('research_reports')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', profile.id);

            realUsage += (researchCount || 0);

            // Step 3.2: Update Usage ONLY (Safety First)
            // We do NOT touch subscription fields here to avoid accidental upgrades/downgrades.
            // Billing reconciliation handles status changes.
            const updatePayload = {
                ai_messages_used: realUsage
                // Removed: Quota/Tier/Status updates (Dangerous without MP validation)
            };

            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update(updatePayload)
                .eq('id', profile.id);

            if (!updateError) stats.updated++;
            else stats.errors++;
        }

        return NextResponse.json({ success: true, stats });

    } catch (error) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
