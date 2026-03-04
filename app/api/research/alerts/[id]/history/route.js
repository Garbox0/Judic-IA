import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/api-auth';

/**
 * GET /api/research/alerts/[id]/history
 * Devuelve las últimas ejecuciones de una alerta del usuario.
 */
export async function GET(req, { params }) {
    const auth = await verifyAuth(req);
    if (auth.error) return auth.response;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const alertId = params?.id;
    if (!alertId) {
        return NextResponse.json({ error: 'ID de alerta requerido' }, { status: 400 });
    }

    // Verificar que la alerta pertenece al usuario
    const { data: alert } = await supabase
        .from('case_alerts')
        .select('id, user_id, portal, search_query, query_value')
        .eq('id', alertId)
        .eq('user_id', auth.user.id)
        .maybeSingle();

    if (!alert) {
        return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);

    const { data: logs, error } = await supabase
        .from('case_alerts_log')
        .select('id, alert_id, results_found, status, error_message, created_at')
        .eq('alert_id', alertId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[alerts/history] DB error:', error.message);
        return NextResponse.json({ error: 'No se pudo cargar el historial' }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        alert_id: alertId,
        logs: (logs || []).map(log => {
            // Extraer new_count del campo error_message si contiene ALERT_META
            let newCount = null;
            if (log.error_message?.startsWith('ALERT_META:')) {
                try {
                    const meta = JSON.parse(log.error_message.replace('ALERT_META:', ''));
                    newCount = meta?.new_count ?? null;
                } catch { /* ignore */ }
            }
            return {
                id: log.id,
                status: log.status,
                results_found: log.results_found ?? 0,
                new_count: newCount,
                ran_at: log.created_at,
                has_error: log.status === 'error',
                error_short: log.status === 'error'
                    ? (log.error_message || 'Error desconocido').slice(0, 80)
                    : null,
            };
        })
    });
}
