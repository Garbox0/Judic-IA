import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { processDailyAlerts } from './lib/alertEngine.js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTest() {
    console.log('[Test] Buscando un usuario válido (profile)...');
    const { data: profiles, error: errProf } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

    if (errProf || !profiles || profiles.length === 0) {
        console.error('[Test] Error obteniendo perfil o no hay perfiles:', errProf);
        return;
    }

    const userId = profiles[0].id;
    console.log(`[Test] Usando Profile ID: ${userId}`);

    console.log('[Test] Insertando alerta de prueba protegida...');

    // Insertar alerta para buscar a MERCADO LIBRE SRL en la Cámara Nacional Comercial (ID: 10 en PJN)
    const { data: alert, error: errAlert } = await supabase
        .from('case_alerts')
        .insert({
            user_id: userId,
            portal: 'PJN',
            query_type: 'por_parte',
            query_value: 'MERCADO LIBRE SRL',
            jurisdiction_id: '10', // COM - Camara Nacional de Apelaciones en lo Comercial
            frequency: 'daily',
            is_active: true
        })
        .select()
        .single();

    if (errAlert) {
        console.error('[Test] Error creando la alerta de prueba:', errAlert);
        return;
    }

    console.log(`[Test] Alerta Creada: ${alert.id}`);
    console.log('[Test] --- Iniciando Orquestador Cron ---');

    // Ejecutar la simulación
    await processDailyAlerts();

    console.log('[Test] --- Fin del Orquestador ---');
    console.log('[Test] Borrando la alerta de prueba...');

    await supabase.from('case_alerts').delete().eq('id', alert.id);
    console.log('[Test] Limpieza finalizada.');
}

runTest();
