const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, supabaseServiceKey);

async function checkInquiries() {
    console.log("🧐 Checking inquiries table...");

    const { data, error } = await client
        .from('inquiries')
        .select('id, contact_email, client_auth_id, assigned_lawyer_id');

    if (error) {
        console.error("❌ Error fetching inquiries:", error);
    } else {
        console.log("DATA_START");
        console.log(JSON.stringify(data, null, 2));
        console.log("DATA_END");
    }
}

checkInquiries();
