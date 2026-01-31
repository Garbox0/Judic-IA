const { createClient } = require('@supabase/supabase-js');

// Config
const supabaseUrl = 'https://aeecmwzmarjzliwctqcx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZWNtd3ptYXJqemxpd2N0cWN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAyMTA3MywiZXhwIjoyMDgyNTk3MDczfQ.AMb83OnihJyeVFMHpCwat1BQ5qS1XXxDPk3RKbh0v1U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    try {
        console.log("Checking columns...");
        // Fetch one row to see keys
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .limit(1);

        if (error) {
            console.error("Error fetching:", error);
            return;
        }

        if (data && data.length > 0) {
            console.log("Columns found:", Object.keys(data[0]));
        } else {
            console.log("No rows found, cannot infer columns easily via select *");
        }

    } catch (e) {
        console.error(e);
    }
}

checkSchema();
