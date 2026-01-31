const { createClient } = require('@supabase/supabase-js');

// Config
const supabaseUrl = 'https://aeecmwzmarjzliwctqcx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZWNtd3ptYXJqemxpd2N0cWN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAyMTA3MywiZXhwIjoyMDgyNTk3MDczfQ.AMb83OnihJyeVFMHpCwat1BQ5qS1XXxDPk3RKbh0v1U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRole() {
    try {
        console.log("Testing role 'client' in profiles table...");
        const { data, error } = await supabase
            .from('profiles')
            .insert({
                id: '00000000-0000-0000-0000-000000000000',
                email: 'test_role@example.com',
                role: 'client',
                full_name: 'Test Role'
            })
            .select();

        if (error) {
            console.error("EXPECTED ERROR (if constraint exists):", error.message);
        } else {
            console.log("SUCCESS! 'client' is a valid role.");
            // Cleanup
            await supabase.from('profiles').delete().eq('email', 'test_role@example.com');
        }

    } catch (e) {
        console.error(e);
    }
}

testRole();
