const { createClient } = require('@supabase/supabase-js');

// Config
const supabaseUrl = 'https://aeecmwzmarjzliwctqcx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZWNtd3ptYXJqemxpd2N0cWN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAyMTA3MywiZXhwIjoyMDgyNTk3MDczfQ.AMb83OnihJyeVFMHpCwat1BQ5qS1XXxDPk3RKbh0v1U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllRoles() {
    try {
        const clients = ['likkledraw@gmail.com', 'junio57@yahoo.com.ar'];
        const admin = 'gbrlescalada@gmail.com';

        for (const email of clients) {
            console.log(`Setting ${email} to 'client'...`);
            const { error } = await supabase.from('profiles').update({ role: 'client' }).eq('email', email);
            if (error) console.error(`Error for ${email}:`, error);
            else console.log(`✅ ${email} is now a client.`);
        }

        console.log(`Ensuring ${admin} is 'admin'...`);
        const { error: adminErr } = await supabase.from('profiles').update({ role: 'admin' }).eq('email', admin);
        if (adminErr) console.error(`Error for ${admin}:`, adminErr);
        else console.log(`✅ ${admin} confirmed as admin.`);

    } catch (e) {
        console.error(e);
    }
}

fixAllRoles();
