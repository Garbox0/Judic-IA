const https = require('https');

const PROJECT_REF = 'aeecmwzmarjzliwctqcx';
const TOKEN = 'sbp_35d8f3e2b71a6203ce1bbd1bdd50b8de9fd9b617';

function runSql(sql) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.supabase.com',
            path: `/v1/projects/${PROJECT_REF}/database/query`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(`Error ${res.statusCode}: ${data}`);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(JSON.stringify({ query: sql }));
        req.end();
    });
}

async function main() {
    console.log("🔍 Analizando funciones vulnerables...");

    // 1. Obtener las funciones afectadas y generar el comando ALTER correcto
    const introspectionQuery = `
        SELECT 'ALTER FUNCTION ' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') SET search_path = public;' as fix_command
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN (
            'handle_deleted_inquiry_user',
            'check_inquiry_exists',
            'log_critical_changes',
            'log_password_change',
            'check_password_reuse',
            'consume_ai_message',
            'safe_delete_client_auth',
            'delete_client_auth_user',
            'sync_assigned_lawyer',
            'get_my_role',
            '_check_org_membership',
            'sync_lawyer_to_client_profile',
            'handle_new_user'
        );
    `;

    try {
        const result = await runSql(introspectionQuery);

        if (!result || result.length === 0) {
            console.log("✅ No se encontraron funciones vulnerables nuevas o ya fueron corregidas.");
            return;
        }

        console.log(`🛠️ Se encontraron ${result.length} funciones para corregir.`);

        // 2. Ejecutar cada corrección
        for (const row of result) {
            const command = row.fix_command;
            console.log(`Ejecutando: ${command}`);
            await runSql(command);
        }

        console.log("✨ ¡Todas las funciones han sido aseguradas exitosamente!");

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main();
