import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase-server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        return NextResponse.json({ error: "Missing Service Role Key" }, { status: 500 });
    }

    // DEBUG: Check cookies (disabled for prod)
    // const cookieStore = await cookies();
    // const allCookies = cookieStore.getAll().map(c => c.name);
    // console.log("🍪 Cookies present in request:", allCookies);

    // 1. Identify Requester via Session Client using Unified Helper
    // This helper now correctly uses 'sb-judicia-auth' and await cookies()
    const supabase = await createClient();

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
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

        // Generate link using client subdomain
        // In production: consultas.judic-ia.com
        // In development: localhost:3000/consultas (no subdomain locally)
        const host = request.headers.get('host') || '';
        const isDev = host.includes('localhost');

        let clientBaseUrl;
        if (isDev) {
            const protocol = request.headers.get('x-forwarded-proto') || 'http';
            clientBaseUrl = `${protocol}://${host}/consultas`;
        } else {
            clientBaseUrl = 'https://consultas.judic-ia.com';
        }

        const link = `${clientBaseUrl}/${lawyerId}?cid=${intakeToken}`;

        return NextResponse.json({ link, cid: intakeToken });

    } catch (error) {
        console.error("❌ Error creating intake link:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
