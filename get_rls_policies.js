// Script para obtener RLS via Supabase Management API
const https = require('https');

const SUPABASE_ACCESS_TOKEN = 'sbp_443c70cdcb83d406c72f14fdfa1e4332748d468e';
const PROJECT_REF = 'aeecmwzmarjzliwctqcx';

async function fetchAPI(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.supabase.com',
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function getRLSPolicies() {
    console.log('='.repeat(80));
    console.log('              POLITICAS RLS DE JUDIC-IA (via Management API)');
    console.log('='.repeat(80));
    console.log('');

    // Query para obtener todas las políticas
    const sqlQuery = `
        SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles::text as roles,
            cmd,
            qual,
            with_check
        FROM pg_policies 
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname;
    `;

    try {
        const result = await fetchAPI(
            `/v1/projects/${PROJECT_REF}/database/query`,
            'POST',
            { query: sqlQuery }
        );

        if (result.error) {
            console.error('Error:', result.error);
            console.log('\nIntentando método alternativo...');

            // Intentar obtener tablas al menos
            const tablesResult = await fetchAPI(`/v1/projects/${PROJECT_REF}/database/tables`);
            console.log('Tablas encontradas:', tablesResult);
            return;
        }

        if (!result || result.length === 0) {
            console.log('No se encontraron políticas RLS o la respuesta está vacía.');
            console.log('Respuesta:', JSON.stringify(result, null, 2));
            return;
        }

        // Agrupar por tabla
        const byTable = {};
        result.forEach(row => {
            if (!byTable[row.tablename]) byTable[row.tablename] = [];
            byTable[row.tablename].push(row);
        });

        for (const [table, policies] of Object.entries(byTable)) {
            console.log(`\n${'─'.repeat(70)}`);
            console.log(`📁 ${table.toUpperCase()} (${policies.length} políticas)`);
            console.log('─'.repeat(70));

            policies.forEach((p, i) => {
                console.log(`\n  [${i + 1}] ${p.policyname}`);
                console.log(`      Comando: ${p.cmd}`);
                console.log(`      Roles: ${p.roles}`);
                console.log(`      Permisivo: ${p.permissive}`);
                if (p.qual) {
                    // Formatear la condición para mejor lectura
                    const qual = p.qual.replace(/\s+/g, ' ').trim();
                    console.log(`      USING: ${qual}`);
                }
                if (p.with_check) {
                    const wc = p.with_check.replace(/\s+/g, ' ').trim();
                    console.log(`      WITH CHECK: ${wc}`);
                }
            });
        }

        console.log('\n' + '='.repeat(80));
        console.log(`Total: ${result.length} políticas en ${Object.keys(byTable).length} tablas`);
        console.log('='.repeat(80));

    } catch (err) {
        console.error('Error de conexión:', err.message);
    }
}

getRLSPolicies();
