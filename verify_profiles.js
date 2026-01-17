const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, supabaseServiceKey);

async function verifyProfiles() {
    console.log("🧐 Verifying public.profiles data...");

    const { data, error } = await client
        .from('profiles')
        .select('id, full_name, email, role, assigned_lawyer_id')
        .limit(10);

    if (error) {
        console.error("❌ Error fetching profiles:", error);
    } else {
        console.log("DATA_START");
        console.log(JSON.stringify(data, null, 2));
        console.log("DATA_END");
    }
}

verifyProfiles();
