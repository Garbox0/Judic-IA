import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        return NextResponse.json({ error: "Service Role Key MISSING in Env" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const lawyerId = '4d8c72a7-c830-4483-8546-e8b9a7829bd4';

    // 1. Check Profiles Table
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', lawyerId)
        .maybeSingle();

    // 2. Check Auth Users (Admin API)
    const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(lawyerId);

    return NextResponse.json({
        checkId: lawyerId,
        serviceKeyLoaded: !!serviceRoleKey,
        profileInTable: profile,
        profileError: profileError,
        authInSystem: user,
        authError: authError
    });
}
