import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const CAPTURE_SERVICE_URL = process.env.CAPTURE_SERVICE_URL || 'https://archivos.judic-ia.com';
const CAPTURE_API_KEY = process.env.CAPTURE_API_KEY || 'judicia-capture-2026';

export async function GET(request) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    try {
        // Verify admin
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user || user.email !== 'gbrlescalada@gmail.com') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch latest audit report
        const { data, error } = await supabaseAdmin
            .from('kb_audit_reports')
            .select('*')
            .order('ran_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return NextResponse.json({ report: data || null });
    } catch (error) {
        console.error('KB Audit GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    try {
        // Verify admin
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user || user.email !== 'gbrlescalada@gmail.com') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Trigger audit on VPS
        console.log('🔍 Triggering audit on VPS...');
        let res;
        try {
            res = await fetch(`${CAPTURE_SERVICE_URL}/audit`, {
                headers: { 'x-api-key': CAPTURE_API_KEY },
                signal: AbortSignal.timeout(120000), // 2 min timeout
            });
        } catch (fetchError) {
            const isTimeout = fetchError.name === 'TimeoutError' || fetchError.name === 'AbortError';
            const hint = isTimeout
                ? 'La auditoría tardó más de 2 minutos. Intentá de nuevo o verificá el VPS.'
                : 'No se pudo conectar al VPS. Verificá que capture-service esté corriendo con el endpoint /audit desplegado.';
            console.error('KB Audit VPS connection error:', fetchError.message);
            return NextResponse.json({ error: hint, details: fetchError.message }, { status: 502 });
        }

        if (!res.ok) {
            const text = await res.text();
            const hint = res.status === 404
                ? 'El endpoint /audit no existe en capture-service. Desplegá la versión actualizada en el VPS.'
                : `VPS respondió con error ${res.status}`;
            return NextResponse.json({ error: hint, details: text }, { status: 502 });
        }

        const result = await res.json();
        return NextResponse.json(result);
    } catch (error) {
        console.error('KB Audit POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
