require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRegistrationSync() {
    console.log("🧪 Simulating Registration Sync Flow...");

    const testEmail = `test_zombie_${Date.now()}@example.com`;
    const testPassword = "Password123!";

    try {
        // 1. Create User in Auth
        console.log(`1. Creating auth user: ${testEmail}`);
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email: testEmail,
            password: testPassword,
            email_confirm: true,
            user_metadata: {
                role: 'client',
                full_name: 'Test Zombie',
                phone: '+54 9 11111111'
            }
        });

        if (authErr) {
            console.error("❌ Auth Creation Failed:", authErr.message);
            return;
        }

        const userId = authData.user.id;
        console.log(`✅ Auth user created: ${userId}`);

        // 2. Simulate the /api/chat sync call
        console.log("2. Simulating /api/chat sync...");
        const sessionId = "fake-cid-" + Date.now();
        const lawyerId = "365cd259-4f1e-4004-a677-1eda06a5147e"; // From image

        // In node, we'll just check if the profile exists
        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (profErr) {
            console.error("❌ Profile check failed:", profErr.message);
        } else if (!profile) {
            console.warn("⚠️ PROFILE WAS NOT CREATED AUTOMATICALLY. Trigger missing?");
        } else {
            console.log("✅ Profile exists:", profile);
        }

        // Cleanup
        console.log("🧹 Cleaning up test user...");
        await supabase.auth.admin.deleteUser(userId);
        console.log("✅ Cleaned up.");

    } catch (e) {
        console.error("💥 Crash:", e);
    }
}

testRegistrationSync();
