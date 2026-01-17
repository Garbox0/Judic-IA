require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectInquiriesSchema() {
    console.log("🔍 Inspecting 'inquiries' table columns...");

    const { data: cols, error } = await supabase.rpc('get_table_columns', { table_name: 'inquiries' });

    if (error) {
        // Fallback: Just select one row
        const { data: row } = await supabase.from('inquiries').select('*').limit(1).maybeSingle();
        if (row) {
            console.log("📄 Inquiry keys:", Object.keys(row));
        } else {
            console.error("❌ Failed to get inquiries info.");
        }
    } else {
        console.table(cols.map(c => ({
            name: c.column_name,
            type: c.data_type
        })));
    }
}

inspectInquiriesSchema();
