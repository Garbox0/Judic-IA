// Script para listar todas las políticas RLS de Supabase
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 URL:', supabaseUrl ? '✅ Encontrada' : '❌ No encontrada');
console.log('🔑 Service Key:', supabaseServiceKey ? '✅ Encontrada' : '❌ No encontrada');

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('\n❌ Faltan variables de entorno.');
    console.log('Asegúrate de que .env.local tenga:');
    console.log('  NEXT_PUBLIC_SUPABASE_URL=...');
    console.log('  SUPABASE_SERVICE_KEY=...');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listRLSPolicies() {
    console.log('🔐 Listando políticas RLS...\n');

    const { data, error } = await supabase.rpc('exec_sql', {
        query: `
            SELECT 
                tablename AS tabla,
                policyname AS politica,
                cmd AS operacion,
                roles::text,
                qual AS condicion
            FROM pg_policies 
            WHERE schemaname = 'public'
            ORDER BY tablename, policyname
        `
    });

    if (error) {
        // Si no existe la función exec_sql, usamos un approach alternativo
        console.log('⚠️  No existe función exec_sql, probando método alternativo...\n');

        // Listar tablas que podemos consultar para verificar acceso
        const tables = ['profiles', 'inquiries', 'messages', 'cases', 'deadlines', 'attachments'];

        console.log('📋 Verificando acceso a tablas principales:\n');

        for (const table of tables) {
            const { data: testData, error: testError } = await supabase
                .from(table)
                .select('id')
                .limit(1);

            if (testError) {
                console.log(`❌ ${table}: ${testError.message}`);
            } else {
                console.log(`✅ ${table}: Accesible (${testData?.length || 0} registros de prueba)`);
            }
        }

        console.log('\n💡 Para ver las políticas completas, ve a:');
        console.log('   Supabase Dashboard → Authentication → Policies');
        console.log('   O usa el SQL Editor con la query que te pasé.');
        return;
    }

    if (data && data.length > 0) {
        // Agrupar por tabla
        const byTable = {};
        data.forEach(row => {
            if (!byTable[row.tabla]) byTable[row.tabla] = [];
            byTable[row.tabla].push(row);
        });

        for (const [table, policies] of Object.entries(byTable)) {
            console.log(`\n📁 ${table.toUpperCase()}`);
            console.log('─'.repeat(50));
            policies.forEach(p => {
                console.log(`  📜 ${p.politica}`);
                console.log(`     Operación: ${p.operacion}`);
                console.log(`     Roles: ${p.roles}`);
                if (p.condicion) {
                    console.log(`     Condición: ${p.condicion.substring(0, 80)}...`);
                }
            });
        }
    } else {
        console.log('⚠️  No se encontraron políticas RLS o no hay acceso a pg_policies');
    }
}

listRLSPolicies().catch(console.error);
