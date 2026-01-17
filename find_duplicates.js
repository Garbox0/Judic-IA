const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findDuplicates() {
    console.log("🔍 Searching for duplicate inquiries (Same Email + Same Lawyer)...");

    const { data: duplicates, error } = await supabase
        .rpc('find_duplicate_inquiries'); // I don't have this RPC, using a normal query

    const { data, error: queryError } = await supabase
        .from('inquiries')
        .select('contact_email, assigned_lawyer_id, id, created_at')
        .order('created_at', { ascending: false });

    if (queryError) {
        console.error("Error:", queryError);
        return;
    }

    const groups = {};
    data.forEach(item => {
        const key = `${item.contact_email}|${item.assigned_lawyer_id}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });

    const multiple = Object.entries(groups).filter(([k, v]) => v.length > 1);

    if (multiple.length === 0) {
        console.log("✅ No duplicates found.");
    } else {
        console.log(`⚠️ Found ${multiple.length} sets of duplicates:`);
        multiple.forEach(([key, items]) => {
            console.log(`\nEmail|Lawyer: ${key}`);
            items.forEach(i => console.log(` - ID: ${i.id}, Created: ${i.created_at}`));
        });
    }
}

findDuplicates();
