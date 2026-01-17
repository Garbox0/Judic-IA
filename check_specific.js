const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, supabaseServiceKey);

async function checkSpecificInquiry() {
    const cid = 'cbd40f23-ab42-4cf4-bce5-2000437a0ce4';
    console.log(`🧐 Checking inquiry ${cid}...`);

    const { data, error } = await client
        .from('inquiries')
        .select('*')
        .eq('id', cid)
        .maybeSingle();

    if (error) {
        console.error("❌ Error fetching inquiry:", error);
    } else if (!data) {
        console.log("❌ Inquiry NOT FOUND in database.");
    } else {
        console.log("✅ Inquiry FOUND:");
        console.log(JSON.stringify(data, null, 2));
    }
}

checkSpecificInquiry();
