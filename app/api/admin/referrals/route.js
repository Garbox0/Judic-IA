/**
 * GET  /api/admin/referrals   → Lista todos los vendedores con sus stats
 * POST /api/admin/referrals   → Crea un nuevo código de referido
 * PATCH /api/admin/referrals  → Reemplaza un código (bloquea el anterior, transfiere referrals)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/api-auth';

export async function GET(request) {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    // Obtener todos los códigos con sus stats via la vista
    const { data: summary, error } = await supabase
        .from('referral_commission_summary')
        .select('*');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Por cada vendedor, obtener el detalle de sus referrals activos con meses restantes
    const { data: codes } = await supabase
        .from('referral_codes')
        .select('id, code, name, commission_pct, recurring_months, is_active, created_at');

    const codeIds = (codes || []).map(c => c.id);

    let referralDetails = [];
    if (codeIds.length > 0) {
        const { data: referrals } = await supabase
            .from('referrals')
            .select(`
                id, code_id, type, status, conversion_count, commission_amount, created_at, converted_at,
                profiles:referred_user_id (full_name, email),
                organizations:referred_org_id (name, razon_social)
            `)
            .in('code_id', codeIds)
            .order('created_at', { ascending: false });

        referralDetails = referrals || [];
    }

    return NextResponse.json({ summary: summary || [], codes: codes || [], referrals: referralDetails });
}

export async function POST(request) {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { name, commission_pct, recurring_months, email, cbu, cuit } = await request.json();

    if (!name?.trim()) {
        return NextResponse.json({ error: 'El nombre del vendedor es requerido.' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    // Generar código único: inicial del nombre + 2 letras del apellido + número
    // Ej: Gabriel Escalada → GES01, Juan Escalada → JES01
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : firstName;
    const base = (firstName[0] + lastName.slice(0, 2)).toUpperCase().replace(/[^A-Z]/g, 'X').padEnd(3, 'X');

    // Buscar cuántos códigos con esa base ya existen
    const { data: existing } = await supabase
        .from('referral_codes')
        .select('code')
        .ilike('code', `${base}%`);

    const nextNum = String((existing?.length || 0) + 1).padStart(2, '0');
    const code = `${base}${nextNum}`;

    const { data, error } = await supabase
        .from('referral_codes')
        .insert({
            code,
            name: name.trim(),
            commission_pct: commission_pct ?? 20,
            recurring_months: recurring_months ?? 6,
            is_active: true,
            // Guardamos datos de contacto en settings_json (columna extra o en un jsonb)
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ code: data });
}

export async function PATCH(request) {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { old_code_id, vendor_name } = await request.json();

    if (!old_code_id) {
        return NextResponse.json({ error: 'old_code_id requerido.' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    // 1. Obtener el código anterior
    const { data: oldCode, error: fetchErr } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('id', old_code_id)
        .single();

    if (fetchErr || !oldCode) {
        return NextResponse.json({ error: 'Código no encontrado.' }, { status: 404 });
    }

    // 2. Bloquear el código anterior PERMANENTEMENTE
    await supabase
        .from('referral_codes')
        .update({ is_active: false })
        .eq('id', old_code_id);

    // Generar nuevo código con mismo esquema: inicial nombre + 2 letras apellido + número
    const nameParts2 = (vendor_name || oldCode.name).trim().split(/\s+/);
    const firstName2 = nameParts2[0] || '';
    const lastName2 = nameParts2.length > 1 ? nameParts2[nameParts2.length - 1] : firstName2;
    const base = (firstName2[0] + lastName2.slice(0, 2)).toUpperCase().replace(/[^A-Z]/g, 'X').padEnd(3, 'X');
    const { data: existing } = await supabase
        .from('referral_codes')
        .select('code')
        .ilike('code', `${base}%`);

    const nextNum = String((existing?.length || 0) + 1).padStart(2, '0');
    const newCode = `${base}${nextNum}`;

    const { data: createdCode, error: createErr } = await supabase
        .from('referral_codes')
        .insert({
            code: newCode,
            name: vendor_name || oldCode.name,
            commission_pct: oldCode.commission_pct,
            recurring_months: oldCode.recurring_months,
            is_active: true,
        })
        .select()
        .single();

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

    // 4. Migrar todos los referrals del código viejo al nuevo (preservar progreso)
    await supabase
        .from('referrals')
        .update({ code_id: createdCode.id })
        .eq('code_id', old_code_id);

    // 5. Actualizar referred_by_code en profiles y organizations
    await supabase
        .from('profiles')
        .update({ referred_by_code: newCode })
        .eq('referred_by_code', oldCode.code);

    await supabase
        .from('organizations')
        .update({ referred_by_code: newCode })
        .eq('referred_by_code', oldCode.code);

    return NextResponse.json({
        success: true,
        old_code: oldCode.code,
        new_code: newCode,
        referrals_migrated: true
    });
}
