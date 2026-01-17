require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findZombies() {
    console.log("🔍 Looking for ZOMBIE users (Auth exists, Profile missing)...");

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error("❌ Error listing users:", error);
        return;
    }

    console.log(`👤 Total users in Auth: ${users.length}`);

    for (const user of users) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', user.id)
            .maybeSingle();

        if (!profile) {
            console.warn(`🧟 ZOMBIE FOUND: ID=${user.id} | Email=${user.email} | Phone=${user.phone || 'N/A'}`);
            console.log(`   Metadata:`, user.user_metadata);
        }
    }

    console.log("\n✅ Search complete.");
}

findZombies();
