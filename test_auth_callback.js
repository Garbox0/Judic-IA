// Test para verificar que el callback puede leer el perfil
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔐 Test de RLS para Auth Callback\n');

async function testRLS() {
    // Cliente con service role para verificar datos
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar un usuario lawyer para test
    const { data: lawyers, error: lawyerErr } = await adminClient
        .from('profiles')
        .select('id, email, role, full_name')
        .eq('role', 'lawyer')
        .limit(5);

    if (lawyerErr) {
        console.error('❌ Error buscando lawyers:', lawyerErr.message);
        return;
    }

    console.log('👨‍⚖️ Abogados registrados:');
    lawyers?.forEach(l => {
        console.log(`   - ${l.full_name || 'Sin nombre'} (${l.email}) - Role: ${l.role}`);
    });

    // Buscar clientes
    const { data: clients, error: clientErr } = await adminClient
        .from('profiles')
        .select('id, email, role, full_name')
        .eq('role', 'client')
        .limit(5);

    console.log('\n👤 Clientes registrados:');
    if (clients?.length) {
        clients.forEach(c => {
            console.log(`   - ${c.full_name || 'Sin nombre'} (${c.email}) - Role: ${c.role}`);
        });
    } else {
        console.log('   (ninguno)');
    }

    // Verificar políticas RLS en profiles
    console.log('\n📋 Verificando políticas RLS en profiles...');

    const { data: policies, error: polErr } = await adminClient.rpc('get_policies_for_table', {
        table_name: 'profiles'
    });

    if (polErr) {
        // Si no existe esa función, verificamos directamente
        console.log('⚠️  No hay función custom para listar políticas.');
        console.log('\n📌 IMPORTANTE para el callback:');
        console.log('   El callback necesita poder hacer:');
        console.log('   SELECT role FROM profiles WHERE id = auth.uid()');
        console.log('\n   Asegúrate de tener esta política en Supabase:');
        console.log('   ─────────────────────────────────────────────');
        console.log('   Nombre: "Users can read own profile"');
        console.log('   Tabla: profiles');
        console.log('   Operación: SELECT');
        console.log('   Target roles: authenticated');
        console.log('   USING expression: (auth.uid() = id)');
        console.log('   ─────────────────────────────────────────────');
    }

    // Verificar si los usuarios tienen role en user_metadata
    console.log('\n🔍 Verificando user_metadata en auth.users...');

    const { data: authUsers, error: authErr } = await adminClient.auth.admin.listUsers();

    if (authErr) {
        console.log('⚠️  No se pudo acceder a auth.users:', authErr.message);
    } else {
        console.log('\n👥 Usuarios y sus roles en metadata:');
        authUsers.users?.slice(0, 10).forEach(u => {
            const role = u.user_metadata?.role || '❌ SIN ROL';
            const confirmed = u.email_confirmed_at ? '✅' : '⏳';
            console.log(`   ${confirmed} ${u.email} → role: ${role}`);
        });
    }

    console.log('\n✅ Test completado');
    console.log('\n💡 Si los usuarios NO tienen "role" en metadata, el callback');
    console.log('   necesitará consultar la tabla profiles (requiere RLS correcto)');
    console.log('   o debemos agregar el role al metadata durante el registro.');
}

testRLS().catch(console.error);
