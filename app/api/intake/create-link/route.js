import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        return NextResponse.json({ error: "Missing Service Role Key" }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
    });

    try {
        const { lawyerId } = await request.json();

        if (!lawyerId) {
            return NextResponse.json({ error: "Missing lawyerId" }, { status: 400 });
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
