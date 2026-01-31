const { createClient } = require('@supabase/supabase-js');

// Config
const supabaseUrl = 'https://aeecmwzmarjzliwctqcx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZWNtd3ptYXJqemxpd2N0cWN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAyMTA3MywiZXhwIjoyMDgyNTk3MDczfQ.AMb83OnihJyeVFMHpCwat1BQ5qS1XXxDPk3RKbh0v1U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRolesCorrectly() {
    try {
        console.log("Restoring Raul to lawyer...");
        await supabase.from('profiles').update({ role: 'lawyer' }).eq('email', 'junio57@yahoo.com.ar');

        console.log("Setting Juan (likkledraw) to client...");
        await supabase.from('profiles').update({ role: 'client' }).eq('email', 'likkledraw@gmail.com');

        console.log("Confirming Gabriel as admin...");
        await supabase.from('profiles').update({ role: 'admin' }).eq('email', 'gbrlescalada@gmail.com');

        const { data, error } = await supabase.from('profiles').select('email, role').in('email', ['junio57@yahoo.com.ar', 'likkledraw@gmail.com', 'gbrlescalada@gmail.com']);
        console.log("Current status:", data);

    } catch (e) {
        console.error(e);
    }
}

fixRolesCorrectly();
