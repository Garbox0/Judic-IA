const { createClient } = require('@supabase/supabase-js');

// Config
const supabaseUrl = 'https://aeecmwzmarjzliwctqcx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZWNtd3ptYXJqemxpd2N0cWN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAyMTA3MywiZXhwIjoyMDgyNTk3MDczfQ.AMb83OnihJyeVFMHpCwat1BQ5qS1XXxDPk3RKbh0v1U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
    try {
        const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'profiles' });
        if (error) {
            // If RPC doesn't exist, try another way
            const { data: data2, error: error2 } = await supabase.from('pg_policies').select('*').eq('tablename', 'profiles');
            console.log("Policies:", data2 || error2);
        } else {
            console.log("Policies:", data);
        }
    } catch (e) {
        console.error(e);
    }
}

checkPolicies();
