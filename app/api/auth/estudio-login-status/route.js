/**
 * POST /api/auth/estudio-login-status
 *
 * Consulta pública (sin auth) que, dado un email, devuelve el estado
 * de verificación del estudio asociado al owner de ese email.
 *
 * Usado en el login para distinguir entre pending y rejected
 * cuando Supabase devuelve un error de ban.
 *
 * Respuesta:  { status: 'pending' | 'rejected' | null }
 * - 'pending'  → mostrar mensaje "solicitud en revisión"
 * - 'rejected' → mostrar error genérico de credenciales
 * - null       → no es un estudio o error inesperado
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIP } from '@/lib/rate-limiter';

export async function POST(request) {
    // Rate limit: 10 intentos por minuto por IP
    const ip = getClientIP(request);
    const rl = checkRateLimit(`estudio-login-status:${ip}`, 10, 60_000);
    if (!rl.allowed) return NextResponse.json({ status: null });

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    if (!email) return NextResponse.json({ status: null });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    try {
        // Buscar el perfil por email (solo owners con plan pending_enterprise)
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, org_id, plan_tier')
            .eq('email', email)
            .eq('plan_tier', 'pending_enterprise')
            .maybeSingle();

        if (!profile?.org_id) return NextResponse.json({ status: null });

        // Obtener estado de verificación del estudio (debe ser owner)
        const { data: org } = await supabase
            .from('organizations')
            .select('verification_status')
            .eq('id', profile.org_id)
            .eq('owner_id', profile.id)
            .maybeSingle();

        if (!org) return NextResponse.json({ status: null });

        if (org.verification_status === 'pending')  return NextResponse.json({ status: 'pending' });
        if (org.verification_status === 'rejected') return NextResponse.json({ status: 'rejected' });

        return NextResponse.json({ status: null });

    } catch {
        return NextResponse.json({ status: null });
    }
}
