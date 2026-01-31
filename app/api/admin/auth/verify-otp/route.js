import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        const { email, otp } = await request.json();

        if (!email || !otp) {
            return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
        }

        // 1. Verify OTP in DB
        const { data: record, error } = await supabaseAdmin
            .from('admin_otps')
            .select('*')
            .eq('email', email)
            .eq('otp_code', otp)
            .eq('verified', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !record) {
            return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 401 });
        }

        // 2. Mark as verified (prevent reuse)
        await supabaseAdmin
            .from('admin_otps')
            .update({ verified: true })
            .eq('id', record.id);

        // 3. Return Success
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Verify OTP Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
