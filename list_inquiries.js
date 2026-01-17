const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const lawyerId = 'd77e2d5f-4307-4e13-b53f-d6d490236cea';

    console.log(`Listing inquiries for lawyer: ${lawyerId}`);

    const { data, error } = await supabase
        .from('inquiries')
        .select('id, contact_email, client_auth_id, status, created_at')
        .eq('assigned_lawyer_id', lawyerId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error:", error);
    } else {
        console.table(data);
    }
}

check();
