const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTable() {
    console.log("🔍 Verifying 'deletion_otps' table existence...");

    // Attempt to insert and delete a dummy record to verify structure and permissions
    // Since we are using Service Role, RLS is bypassed, but it proves table existence

    const dummyId = '00000000-0000-0000-0000-000000000000'; // Invalid user ID for constraint? 
    // Wait, user_id is NOT NULL and references auth.users. 
    // We can't insert a fake user_id.

    // Instead, let's just inspect the table definition via RPC if possible, or try a SELECT

    const { data, error } = await supabase
        .from('deletion_otps')
        .select('count')
        .limit(1);

    if (error) {
        if (error.code === '42P01') { // undefined_table
            console.error("❌ Table 'deletion_otps' DOES NOT EXIST.");
        } else {
            console.log("✅ Table exists (Query execute). Error (expected empty):", error.message);
            // If it's a permission error or empty, the table exists at least.
        }
    } else {
        console.log("✅ Table 'deletion_otps' exists and is accessible. Count result:", data);
    }
}

checkTable();
