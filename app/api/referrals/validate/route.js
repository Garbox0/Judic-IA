import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIP } from '../../../../lib/rate-limiter';

export async function GET(request) {
    // 🛡️ Rate limiting: 10 intentos por minuto por IP (anti enumeración por fuerza bruta)
    const ip = getClientIP(request);
    const { allowed, remaining } = checkRateLimit(`referral_validate:${ip}`, 10, 60000);

    if (!allowed) {
        return NextResponse.json(
            { error: 'Demasiados intentos. Intentá en un minuto.' },
            {
                status: 429,
                headers: { 'Retry-After': '60', 'X-RateLimit-Remaining': '0' }
            }
        );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code || code.trim().length < 3 || code.trim().length > 20) {
        return NextResponse.json({ valid: false }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    const { data, error } = await supabase
        .from('referral_codes')
        .select('id, name')
        .eq('code', code.trim().toUpperCase())
        .eq('is_active', true)
        .single();

    if (error || !data) {
        return NextResponse.json({ valid: false }, { status: 404 });
    }

    return NextResponse.json(
        { valid: true, name: data.name },
        { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
}
