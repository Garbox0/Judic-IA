// app/api/clients/delete/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey) {
        return NextResponse.json({ error: "Configuración de servidor incompleta." }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        const { clientAuthId, inquiryId } = await request.json();

        if (!clientAuthId && !inquiryId) {
            return NextResponse.json({ error: "Missing Target ID" }, { status: 400 });
        }

        console.log(`🗑️ ATOMIC DELETE START: Inquiry=${inquiryId} | Auth=${clientAuthId}`);

        // 1. REVOCATION (Kill Switch) - Vital for preventing resurrection
        if (inquiryId) {
            // First, find who the lawyer is if we don't know
            const { data: inq } = await adminClient.from('inquiries').select('assigned_lawyer_id').eq('id', inquiryId).maybeSingle();

            if (inq?.assigned_lawyer_id) {
                const { error: revError } = await adminClient.from('revoked_access').upsert({
                    id: inquiryId, lawyer_id: inq.assigned_lawyer_id
                });
                if (revError) throw new Error(`Revocation Failed: ${revError.message}`);
                console.log(`   ✅ REVOKED Access for ${inquiryId}`);
            }
        }

        // 2. DELETE MESSAGES (Cascade Manual)
        if (inquiryId) {
            const { error: msgErr } = await adminClient.from('messages').delete().eq('inquiry_id', inquiryId);
            if (msgErr) throw new Error(`Msg Delete Failed: ${msgErr.message}`);

            // 3. DELETE INQUIRY
            const { error: inqErr } = await adminClient.from('inquiries').delete().eq('id', inquiryId);
            if (inqErr) throw new Error(`Inquiry Delete Failed: ${inqErr.message}`);
            console.log(`   ✅ INQUIRY DELETED`);
        }

        // 4. DELETE USER DATA & AUTH
        if (clientAuthId) {
            // Clean orphan inquiries
            await adminClient.from('inquiries').delete().eq('client_auth_id', clientAuthId);
            // Delete Profile
            await adminClient.from('profiles').delete().eq('id', clientAuthId);

            // Delete Auth User
            const { error: authErr } = await adminClient.auth.admin.deleteUser(clientAuthId);
            if (authErr && !authErr.message.includes("User not found")) {
                throw new Error(`Auth Delete Failed: ${authErr.message}`);
            }
            console.log(`   ✅ USER & PROFILE DELETED`);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("💥 CRITICAL DELETE ERROR:", error);
        // RETURN 502/500 to tell the Frontend (and User) that it failed
        return NextResponse.json(
            { error: error.message || "Error desconocido al eliminar." },
            { status: 502 } // 502 Bad Gateway is appropriate for upstream/db failures
        );
    }
}
