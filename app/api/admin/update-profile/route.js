import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    try {
        // 1. Verify Requester is the unique allowed Admin (Gabriel)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user || user.email !== 'gbrlescalada@gmail.com') {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { userId, updates } = await request.json();

        if (!userId || !updates) {
            return NextResponse.json({ error: 'Missing userId or updates' }, { status: 400 });
        }

        // 🛡️ SECURITY: Prevent self-demotion or other critical role changes via this API if necessary
        // In this case, we trust the hardcoded email check above.

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });

    } catch (error) {
        console.error('Error in Admin Update API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
