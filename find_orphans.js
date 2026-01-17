require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findOrphanedLawyerReferences() {
    console.log("🔍 Checking for inquiries with invalid assigned_lawyer_id...");

    const { data: inqs, error } = await supabase
        .from('inquiries')
        .select('id, assigned_lawyer_id, contact_name, contact_email');

    if (error) {
        console.error("❌ Error:", error);
        return;
    }

    let found = 0;
    for (const inq of inqs) {
        if (!inq.assigned_lawyer_id) {
            console.log(`⚪ Inquiry ${inq.id} has NO lawyer assigned.`);
            continue;
        }

        const { data: lawyer } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', inq.assigned_lawyer_id)
            .maybeSingle();

        if (!lawyer) {
            console.warn(`🚨 ORPHANED LAWYER ID FOUND: Inquiry ${inq.id} references non-existent lawyer ID: ${inq.assigned_lawyer_id}`);
            console.warn(`   Inquiry details: ${inq.contact_name} (${inq.contact_email})`);
            found++;
        }
    }

    console.log(`\n✅ Audit complete. Found ${found} orphaned lawyer references.`);
}

findOrphanedLawyerReferences();
