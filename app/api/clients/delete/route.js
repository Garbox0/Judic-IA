import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!serviceRoleKey) {
        return NextResponse.json({ error: "Configuración de servidor incompleta." }, { status: 500 });
    }

    // 1. Identify Requester
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
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        let body;
        try {
            body = await request.json();
        } catch (e) {
            console.error("❌ JSON Parse Error in /api/clients/delete:", e);
            return NextResponse.json({ error: "Invalid or empty JSON body" }, { status: 400 });
        }

        const { clientAuthId, inquiryId } = body;

        if (!clientAuthId && !inquiryId) {
            return NextResponse.json({ error: "Missing Target ID (clientAuthId or inquiryId)" }, { status: 400 });
        }

        // 🛡️ SECURITY: Verify Requester Identity
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Verify Ownership of the inquiry
        if (inquiryId) {
            const { data: inq } = await adminClient
                .from('inquiries')
                .select('assigned_lawyer_id')
                .eq('id', inquiryId)
                .maybeSingle();

            if (!inq || inq.assigned_lawyer_id !== user.id) {
                console.warn(`🚫 UNAUTHORIZED DELETE ATTEMPT: User ${user.id} tried to delete inquiry ${inquiryId}`);
                return NextResponse.json({ error: "Forbidden: No eres el dueño de este expediente." }, { status: 403 });
            }
        }

        console.log(`🗑️ ATOMIC DELETE START: Inquiry=${inquiryId} | Auth=${clientAuthId}`);

        // 🛡️ STEP 0: REVOCATION (Kill Switch) - DO THIS FIRST to prevent resurrection
        // Even if the delete fails later, the access is revoked.
        if (inquiryId) {
            const { data: inq } = await adminClient.from('inquiries').select('assigned_lawyer_id').eq('id', inquiryId).maybeSingle();
            if (inq?.assigned_lawyer_id) {
                const { error: revError } = await adminClient.from('revoked_access').upsert({
                    id: inquiryId, lawyer_id: inq.assigned_lawyer_id
                });
                if (revError) console.error(`⚠️ Revocation warning (non-fatal): ${revError.message}`);
                else console.log(`   ✅ Access REVOKED for inquiry ${inquiryId}`);
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
