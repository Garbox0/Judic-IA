require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditPolicies() {
    console.log("🔍 Auditing RLS Policies for 'inquiries'...");

    // We can query pg_policies if we have service_role
    const { data: policies, error } = await supabase.rpc('get_policies', { table_name: 'inquiries' });

    if (error) {
        // Fallback: Use raw SQL via a known RPC or just try to delete an inquiry as a lawyer
        console.warn("⚠️ RPC get_policies failed. Trying to check policies via raw query...");

        const { data: rawPolicies, error: rawErr } = await supabase.from('pg_policies').select('*').eq('tablename', 'inquiries');
        if (rawErr) {
            console.error("❌ Failed to query pg_policies. RLS audit aborted.");
            return;
        }
        console.log("📄 Policies found:", rawPolicies.map(p => ({
            name: p.policyname,
            cmd: p.cmd,
            qual: p.qual,
            with_check: p.with_check
        })));
    } else {
        console.log("📄 Policies found:", policies);
    }
}

auditPolicies();
