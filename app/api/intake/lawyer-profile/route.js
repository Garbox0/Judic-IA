import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing lawyer ID' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('full_name, especialidades, matricula, avatar_url, role')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Security check: Only return if it's a lawyer or admin
        if (data.role !== 'lawyer' && data.role !== 'admin') {
            return NextResponse.json({ error: 'Not a legal professional' }, { status: 403 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching lawyer profile via proxy:', error);
        return NextResponse.json({ error: 'Profile not found or inaccessible' }, { status: 404 });
    }
}
