const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
    console.log("🔍 DIAGNOSING DELETE-REBIRTH ISSUE...\n");

    // 1. Check Triggers on Inquiries
    console.log("1. Checking Triggers on 'inquiries'...");
    const { data: triggers, error: trigErr } = await supabase.rpc('get_table_triggers', { table_name: 'inquiries' });
    if (trigErr) {
        // Fallback: Try a raw query if RPC fails
        const { data: rawTriggers } = await supabase.from('pg_trigger').select('tgname').limit(5);
        console.log("   (RPC failed, checking raw triggers...) Found:", rawTriggers ? rawTriggers.length : 0);
    } else {
        console.log("   Triggers:", triggers);
    }

    // 2. Check current inquiries for current test lawyer (if known)
    console.log("\n2. Counting current inquiries...");
    const { count, error: countErr } = await supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true });

    console.log(`   Total inquiries: ${count}`);

    // 3. Check for specific orphaned inquiries (logged in auth, no profile)
    console.log("\n3. Checking for orphaned inquiries (ID but no Profile)...");
    const { data: orphans } = await supabase
        .from('inquiries')
        .select('id, client_auth_id')
        .not('client_auth_id', 'is', null);

    if (orphans) {
        for (const o of orphans) {
            const { data: prof } = await supabase.from('profiles').select('id').eq('id', o.client_auth_id).maybeSingle();
            if (!prof) {
                console.warn(`   ❗ Orphan found: Inquiry ${o.id} links to missing Profile ${o.client_auth_id}`);
            }
        }
    }

    // 4. Check RLS for DELETE
    console.log("\n4. Checking RLS Policies for 'inquiries'...");
    // Since we can't easily query pg_policies via REST without a custom RPC, let's just list the table info
    console.log("   (Verify manually in SQL editor if possible)");

    console.log("\n✅ Diagnosis complete.");
}

diagnose();
