import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!serviceRoleKey) {
        return NextResponse.json({ error: "Missing Service Role Key" }, { status: 500 });
    }

    // 1. Identify Requester via Session Client
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, anonKey, {
        cookies: {
            getAll() { return cookieStore.getAll() },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) =>
                    cookieStore.set(name, value, options)
                )
            },
        },
        cookieOptions: { name: 'sb-admin-token' }
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
    });

    try {
        const { lawyerId } = await request.json();

        if (!lawyerId) {
            return NextResponse.json({ error: "Missing lawyerId" }, { status: 400 });
        }

        // 🛡️ SECURITY: Verify Identity
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || user.id !== lawyerId) {
            console.warn(`🚫 UNAUTHORIZED LINK ATTEMPT: User ${user?.id} tried to create link for lawyer ${lawyerId}`);
            return NextResponse.json({ error: "Unauthorized: Identity mismatch" }, { status: 401 });
        }

        // Generate a persistent TOKEN for this specific potential inquiry
        const intakeToken = crypto.randomUUID();

        // Create a placeholder inquiry so the token is ALREADY in the DB
        // This prevents the "CID" from being just a random string in the air
        const { data, error } = await adminClient
            .from('inquiries')
            .insert({
                id: intakeToken,
                assigned_lawyer_id: lawyerId,
                status: 'link_generated', // Hidden from dashboard until client talks
                contact_name: 'Enlace Generado'
            })
            .select()
            .single();

        if (error) throw error;

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const link = `${siteUrl}/consultas/${lawyerId}?cid=${intakeToken}`;

        return NextResponse.json({ link, cid: intakeToken });

    } catch (error) {
        console.error("❌ Error creating intake link:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
