const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
    console.log("🔍 Listing All Users for Metadata Check");

    // 1. Check All Auth Users
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (users && users.length > 0) {
        users.forEach(u => {
            console.log(`\n--- User: ${u.email} ---`);
            console.log("- ID:", u.id);
            console.log("- Metadata:", JSON.stringify(u.user_metadata, null, 2));
        });
    } else {
        console.log("❌ No Auth Users found.");
    }
}

diagnose();
