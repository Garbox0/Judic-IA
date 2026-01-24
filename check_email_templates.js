// Script para ver y modificar las plantillas de email de Supabase
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
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function getAuthConfig() {
    console.log('📧 Obteniendo configuración de autenticación...\n');

    // Get auth config
    const result = await fetchAPI(`/v1/projects/${PROJECT_REF}/config/auth`);

    if (result.status !== 200) {
        console.error('Error:', result.data);
        return;
    }

    const config = result.data;

    console.log('='.repeat(70));
    console.log('                  CONFIGURACIÓN DE AUTH');
    console.log('='.repeat(70));

    console.log('\n📌 Site URL:', config.site_url);
    console.log('📌 URI Scheme:', config.uri_scheme);

    console.log('\n📧 PLANTILLAS DE EMAIL:');
    console.log('─'.repeat(70));

    // Email templates
    if (config.mailer_templates) {
        console.log('\n[CONFIRMATION EMAIL]');
        console.log('Subject:', config.mailer_templates.confirmation?.subject || 'Default');
        console.log('Content Preview:');
        const content = config.mailer_templates.confirmation?.content || 'Using default template';
        console.log(content.substring(0, 500) + (content.length > 500 ? '...' : ''));
    }

    console.log('\n📍 REDIRECT URLs:');
    console.log('─'.repeat(70));
    console.log('Additional Redirect URLs:', config.redirect_urls || 'None configured');

    console.log('\n🔑 EMAIL CONFIRMATION SETTINGS:');
    console.log('─'.repeat(70));
    console.log('Email Confirmation Required:', config.mailer_autoconfirm ? 'NO (auto-confirm)' : 'YES');
    console.log('Double Confirm Email Changes:', config.mailer_secure_email_change_enabled);

    // Return config for potential update
    return config;
}

async function updateEmailTemplate() {
    console.log('\n\n📝 ACTUALIZANDO PLANTILLA DE EMAIL...\n');

    // First, let's see what the current template looks like
    const currentConfig = await fetchAPI(`/v1/projects/${PROJECT_REF}/config/auth`);

    if (currentConfig.status !== 200) {
        console.error('Error obteniendo config:', currentConfig.data);
        return;
    }

    // The key is to ensure the confirmation email redirects to /auth/callback
    // We can customize the email template to use a fixed redirect URL

    const newConfirmationTemplate = `
<h2>Confirma tu cuenta en Judic-IA</h2>

<p>Hola,</p>

<p>Gracias por registrarte en <strong>Judic-IA</strong>. Para activar tu cuenta, haz clic en el siguiente enlace:</p>

<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup" style="background-color: #fbbf24; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Confirmar Email</a></p>

<p>O copia y pega este enlace en tu navegador:</p>
<p>{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup</p>

<p>Si no creaste esta cuenta, puedes ignorar este mensaje.</p>

<p>Saludos,<br>Equipo Judic-IA ⚖️</p>
`;

    const updatePayload = {
        mailer_templates: {
            confirmation: {
                subject: "Confirma tu cuenta en Judic-IA ⚖️",
                content: newConfirmationTemplate
            }
        }
    };

    console.log('Nuevo template preparado. El redirect será a: /auth/callback');
    console.log('\n⚠️  NOTA: La actualización vía API puede requerir permisos adicionales.');
    console.log('Si falla, ve manualmente a:');
    console.log('  Supabase Dashboard → Authentication → Email Templates → Confirm Signup');
    console.log('\nY cambia el template para usar: {{ .SiteURL }}/auth/callback');

    // Try to update
    const updateResult = await fetchAPI(
        `/v1/projects/${PROJECT_REF}/config/auth`,
        'PATCH',
        updatePayload
    );

    if (updateResult.status === 200) {
        console.log('\n✅ Template actualizado correctamente!');
    } else {
        console.log('\n❌ Error actualizando:', updateResult.status, JSON.stringify(updateResult.data, null, 2));
    }
}

async function main() {
    await getAuthConfig();
    // Uncomment to try updating:
    // await updateEmailTemplate();
}

main().catch(console.error);
