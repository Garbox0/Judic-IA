require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupOrphans() {
    console.log("🧹 Starting Cleanup of Orphaned Lawyer References...");

    // 1. Fetch all inquiries
    const { data: inqs, error } = await supabase
        .from('inquiries')
        .select('id, assigned_lawyer_id, contact_name, contact_email');

    if (error) {
        console.error("❌ Error fetching inquiries:", error);
        return;
    }

    let cleaned = 0;
    for (const inq of inqs) {
        if (!inq.assigned_lawyer_id) continue;

        // 2. Check if lawyer exists
        const { data: lawyer } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', inq.assigned_lawyer_id)
            .maybeSingle();

        if (!lawyer) {
            console.warn(`🚨 Fixing Inquiry ${inq.id}: Lawyer ${inq.assigned_lawyer_id} does not exist. Nullifying...`);

            // 3. Nullify the reference
            const { error: updateErr } = await supabase
                .from('inquiries')
                .update({ assigned_lawyer_id: null })
                .eq('id', inq.id);

            if (updateErr) {
                console.error(`   ❌ Failed to nullify ${inq.id}:`, updateErr.message);
            } else {
                console.log(`   ✅ Nullified successfully.`);
                cleaned++;
            }
        }
    }

    console.log(`\n✨ Done. Cleaned ${cleaned} orphaned references.`);
}

cleanupOrphans();
