import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processDailyAlerts } from '@/lib/alertEngine';

/**
 * GET /api/admin/run-alerts
 * Dispara el motor de alertas manualmente. Solo admin.
 * 
 * Query params:
 *   ?limit=10        Máximo de alertas a procesar (default: 100)
 *   ?dry_run=true    Solo muestra qué haría sin enviar emails ni actualizar DB
 */
export async function GET(req) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Auth: solo admins
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Se requiere rol admin' }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit')) || 100, 500));

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        const result = await processDailyAlerts({ limit });
        const durationMs = Date.now() - startMs;

        return NextResponse.json({
            ok: true,
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            duration_ms: durationMs,
            limit_used: limit,
            summary: result,
        });
    } catch (err) {
        console.error('[admin/run-alerts] Error:', err);
        return NextResponse.json({
            ok: false,
            error: err?.message || 'Error interno',
            started_at: startedAt,
            duration_ms: Date.now() - startMs,
        }, { status: 500 });
    }
}
