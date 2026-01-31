const { createClient } = require('@supabase/supabase-js');

// Config
const supabaseUrl = 'https://aeecmwzmarjzliwctqcx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZWNtd3ptYXJqemxpd2N0cWN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAyMTA3MywiZXhwIjoyMDgyNTk3MDczfQ.AMb83OnihJyeVFMHpCwat1BQ5qS1XXxDPk3RKbh0v1U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogic() {
    try {
        console.log("Fetching Raul...");
        const { data: profile } = await supabase.from('profiles').select('*').eq('email', 'junio57@yahoo.com.ar').single();

        if (!profile) { console.log('Profile NOT FOUND'); return; }

        console.log(`User: ${profile.email}`);
        console.log(`Current Tier: ${profile.plan_tier}`);
        console.log(`Current Status: ${profile.subscription_status}`);
        console.log(`Expiry DB Value: ${profile.subscription_expiry}`);

        const now = new Date();
        const expiry = profile.subscription_expiry ? new Date(profile.subscription_expiry) : null;

        console.log(`Now: ${now.toISOString()}`);
        console.log(`Expiry: ${expiry ? expiry.toISOString() : 'NULL'}`);

        const isValid = expiry && expiry > now;
        console.log(`Is Valid (> Now): ${isValid}`);

        if (profile.plan_tier === 'professional' || isValid) {
            console.log("Branch: Pro/Valid detected");
            if (isValid) {
                console.log("DECISION: STAY AGENTIC PRO");
            } else {
                console.log("DECISION: EXPIRED -> DOWNGRADE");
            }
        } else {
            console.log("Branch: Basic/Invalid");
            console.log("DECISION: STAY BASIC");
        }
    } catch (e) {
        console.error(e);
    }
}

checkLogic();
