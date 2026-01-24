// Quick check of recent user signups
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRecentUsers() {
    console.log('📋 Usuarios recientes:\n');

    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('Error:', error);
        return;
    }

    // Sort by created_at descending
    const sorted = users.users.sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
    );

    console.log('Últimos 10 usuarios registrados:');
    console.log('─'.repeat(70));

    sorted.slice(0, 10).forEach(u => {
        const created = new Date(u.created_at).toLocaleString('es-AR');
        const confirmed = u.email_confirmed_at
            ? new Date(u.email_confirmed_at).toLocaleString('es-AR')
            : '❌ NO CONFIRMADO';
        const role = u.user_metadata?.role || 'sin rol';

        console.log(`\n📧 ${u.email}`);
        console.log(`   Rol: ${role}`);
        console.log(`   Creado: ${created}`);
        console.log(`   Confirmado: ${confirmed}`);
    });
}

checkRecentUsers().catch(console.error);
