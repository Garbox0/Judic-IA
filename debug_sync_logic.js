const { createClient } = require('@supabase/supabase-js');

// Config
const supabaseUrl = 'https://aeecmwzmarjzliwctqcx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZWNtd3ptYXJqemxpd2N0cWN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAyMTA3MywiZXhwIjoyMDgyNTk3MDczfQ.AMb83OnihJyeVFMHpCwat1BQ5qS1XXxDPk3RKbh0v1U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogic() {
    try {
        console.log("Fetching Raul's profile...");
        // 1. Fetch Profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', 'junio57@yahoo.com.ar')
            .single();

        if (error) {
            console.error("Error fetching profile:", error);
            return;
        }

        console.log("Profile Data:", JSON.stringify(profile, null, 2));

        // 2. Simulate Logic
        const now = new Date();
        const expiry = profile.subscription_expiry ? new Date(profile.subscription_expiry) : null;

        console.log("Now:", now.toISOString());
        console.log("Expiry Parsed:", expiry ? expiry.toISOString() : 'null');
        console.log("Expiry > Now?", expiry && expiry > now);

        let quota = 20;
        let newTier = 'basic';
        let newStatus = 'inactive';

        if (profile.plan_tier === 'professional' || (expiry && expiry > now)) {
            console.log("Condition 1: Tier is Pro OR Time is Valid");
            if (expiry && expiry > now) {
                console.log("Condition 2: Time IS Valid -> ACTIVE PRO");
                quota = 1000;
                newTier = 'professional';
                if (profile.subscription_status === 'cancelled') {
                    newStatus = 'cancelled';
                } else {
                    newStatus = 'active';
                }
            } else {
                console.log("Condition 2: Time IS EXPIRED -> Downgrade to Basic");
                quota = 20;
                newTier = 'basic';
                newStatus = 'inactive';
            }
        } else {
            console.log("Condition 1: Tier NOT Pro AND Time NOT Valid -> Basic");
            quota = 20;
            newTier = 'basic';
            newStatus = 'inactive';
        }

        console.log("Final Decision:");
        console.log({ quota, newTier, newStatus });

    } catch (e) {
        console.error(e);
    }
}

checkLogic();
