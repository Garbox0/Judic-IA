import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request, { params }) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const { id } = await params;

    if (!id) {
        return NextResponse.json({ error: "Missing lawyer ID" }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
    });

    try {
        // Fetch public profile (only if public + verified)
        const { data: lawyer, error } = await adminClient
            .from('profiles')
            .select('id, full_name, avatar_url, especialidades, jurisdiccion, matricula, matriculas, biography, avg_rating, review_count')
            .eq('id', id)
            .eq('role', 'lawyer')
            .eq('is_public', true)
            .eq('verification_status', 'verified')
            .single();

        if (error || !lawyer) {
            return NextResponse.json({ error: "Perfil no encontrado o no disponible" }, { status: 404 });
        }

        // Fetch recent reviews + org membership badge
        const [{ data: reviews }, { data: orgMember }] = await Promise.all([
            adminClient
                .from('reviews')
                .select('id, rating, comment, created_at')
                .eq('lawyer_id', id)
                .order('created_at', { ascending: false })
                .limit(10),
            adminClient
                .from('org_members')
                .select('role, org:org_id(id, name, razon_social, type, verification_status)')
                .eq('user_id', id)
                .maybeSingle(),
        ]);

        // Only expose the estudio badge if it's verified
        const estudioOrg = (
            orgMember?.org?.type === 'estudio' &&
            orgMember?.org?.verification_status === 'verified'
        ) ? {
            id: orgMember.org.id,
            name: orgMember.org.razon_social || orgMember.org.name,
            role: orgMember.role,
        } : null;

        return NextResponse.json({
            ...lawyer,
            reviews: reviews || [],
            estudio: estudioOrg,
        });

    } catch (error) {
        console.error("Error fetching lawyer profile:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
