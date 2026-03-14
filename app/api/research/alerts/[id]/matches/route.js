import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/api-auth';

/**
 * GET /api/research/alerts/[id]/matches
 * Devuelve todos los expedientes detectados históricamente para una alerta.
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
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

    const { data: matches, error, count } = await supabase
        .from('case_alerts_matches')
        .select('id, expediente, caratula, link, source, found_at', { count: 'exact' })
        .eq('alert_id', alertId)
        .order('found_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('[alerts/matches] DB error:', error.message);
        return NextResponse.json({ error: 'No se pudo cargar el historial' }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        alert_id: alertId,
        total: count ?? 0,
        matches: matches || [],
    });
}
