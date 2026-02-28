/**
 * GET /api/pjn/credits
 *
 * Retorna los créditos de antecedentes efectivos para el usuario autenticado.
 * Si el usuario pertenece a un estudio verificado, devuelve el pool del estudio.
 * De lo contrario, devuelve los créditos individuales del perfil.
 *
 * Response:
 * {
 *   credits: number,
 *   source: 'individual' | 'org',
 *   orgId: string | null,
 *   orgName: string | null,
 *   isOrgOwner: boolean
 * }
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/api-auth';

export async function GET(request) {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.response;

    const userId = auth.user.id;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    // Fetch profile: individual credits + org_id
    const { data: profile } = await supabase
        .from('profiles')
        .select('antecedentes_credits, org_id')
        .eq('id', userId)
        .single();

    if (!profile) {
        return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 404 });
    }

    // If user has no org, return individual credits
    if (!profile.org_id) {
        return NextResponse.json({
            credits: profile.antecedentes_credits ?? 0,
            source: 'individual',
            orgId: null,
            orgName: null,
            isOrgOwner: false,
        });
    }

    // Check org membership and org details
    const { data: member } = await supabase
        .from('org_members')
        .select('role, org:org_id(id, name, razon_social, type, verification_status, antecedentes_credits_pool)')
        .eq('user_id', userId)
        .eq('org_id', profile.org_id)
        .single();

    const org = member?.org;

    // Only use org pool if it's a verified estudio
    if (!org || org.type !== 'estudio' || org.verification_status !== 'verified') {
        return NextResponse.json({
            credits: profile.antecedentes_credits ?? 0,
            source: 'individual',
            orgId: null,
            orgName: null,
            isOrgOwner: false,
        });
    }

    return NextResponse.json({
        credits: org.antecedentes_credits_pool ?? 0,
        source: 'org',
        orgId: org.id,
        orgName: org.razon_social || org.name,
        isOrgOwner: member.role === 'owner',
    });
}
