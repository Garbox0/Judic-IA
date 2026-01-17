require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkConstraints() {
    console.log("🔍 Checking Database Constraints via Admin Client...");

    // We can't use pg_catalog directly via PostgREST easily without RPC, 
    // but we can try to perform a test deletion on a non-existent or fake record 
    // to see if we get a specific error message.

    // However, the best way is to try and delete a REAL inquiry and see the error.

    const { data: inquiries, error: listErr } = await supabase
        .from('inquiries')
        .select('id, contact_name')
        .limit(1);

    if (listErr) {
        console.error("❌ Error listing inquiries:", listErr);
        return;
    }

    if (inquiries.length === 0) {
        console.log("ℹ️ No inquiries found to test.");
        return;
    }

    const testId = inquiries[0].id;
    console.log(`🧪 Testing deletion of inquiry: ${testId} (${inquiries[0].contact_name})`);

    // Check if it has messages
    const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('inquiry_id', testId);

    console.log(`📩 This inquiry has ${msgCount} messages.`);

    // Try to delete (Dry run sort of, but we will actually try it)
    const { error: delErr } = await supabase
        .from('inquiries')
        .delete()
        .eq('id', testId);

    if (delErr) {
        console.error("❌ DELETION FAILED:", delErr.message);
        if (delErr.message.includes("violates foreign key constraint")) {
            console.log("🚨 CONFIRMED: Foreign key constraint is blocking deletion!");
        }
    } else {
        console.log("✅ Deletion succeeded (or record didn't exist).");
    }
}

checkConstraints();
