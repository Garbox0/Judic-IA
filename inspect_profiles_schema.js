require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectProfilesSchema() {
    console.log("🔍 Inspecting 'profiles' table columns...");

    const { data: cols, error } = await supabase.rpc('get_table_columns', { table_name: 'profiles' });

    if (error) {
        // Fallback: Just select one row from profiles and check keys
        const { data: row } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
        if (row) {
            console.log("📄 Profile keys:", Object.keys(row));
        } else {
            console.error("❌ Failed to get profile info.");
        }
    } else {
        console.table(cols.map(c => ({
            name: c.column_name,
            type: c.data_type,
            nullable: c.is_nullable,
            default: c.column_default
        })));
    }
}

inspectProfilesSchema();
