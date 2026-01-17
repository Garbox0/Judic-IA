const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing env variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function check() {
    const lawyerId = 'd77e2d5f-4307-4e13-b53f-d6d490236cea';
    const cid = 'dd07b623-b2c0-43d5-af83-db1e89f1f154';

    console.log(`Checking Inquiry: ${cid} for Lawyer: ${lawyerId}`);

    const { data: inquiry, error } = await supabase
        .from('inquiries')
        .select('*')
        .eq('id', cid)
        .maybeSingle();

    if (error) {
        console.error("Error fetching inquiry:", error);
    } else if (!inquiry) {
        console.log("❌ Inquiry NOT FOUND");
    } else {
        console.log("✅ Inquiry FOUND:", JSON.stringify(inquiry, null, 2));
    }

    // Check profiles too
    const { data: lawyer, error: lawyerError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', lawyerId)
        .maybeSingle();

    console.log("Lawyer Profile:", lawyer || lawyerError || "Not found");
}

check();
