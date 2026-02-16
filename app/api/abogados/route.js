import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
    });

    try {
        const { searchParams } = new URL(request.url);
        const especialidad = searchParams.get('especialidad');
        const zona = searchParams.get('zona');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = 20;
        const offset = (page - 1) * limit;

        // Build query — only public, verified lawyers
        let query = adminClient
            .from('profiles')
            .select('id, full_name, avatar_url, especialidades, jurisdiccion, matricula, biography, avg_rating, review_count', { count: 'exact' })
            .eq('role', 'lawyer')
            .eq('is_public', true)
            .eq('verification_status', 'verified')
            .order('avg_rating', { ascending: false })
            .range(offset, offset + limit - 1);

        // Filter by especialidad (array contains)
        if (especialidad) {
            query = query.contains('especialidades', [especialidad]);
        }

        // Filter by zona/jurisdiccion
        if (zona) {
            query = query.ilike('jurisdiccion', `%${zona}%`);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        return NextResponse.json({
            lawyers: data || [],
            total: count || 0,
            page,
            totalPages: Math.ceil((count || 0) / limit)
        });

    } catch (error) {
        console.error("Error in /api/abogados:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
