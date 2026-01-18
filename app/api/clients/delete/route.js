import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey) {
        console.error("❌ SUPABASE_SERVICE_ROLE_KEY is missing");
        return NextResponse.json({ error: "Configuración de servidor incompleta." }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        const { clientAuthId, inquiryId } = await request.json();

        if (!clientAuthId && !inquiryId) {
            return NextResponse.json({ error: "Missing clientAuthId or inquiryId" }, { status: 400 });
        }

        console.log(`🧹 ADMIN POWER DELETE: auth=${clientAuthId}, inquiry=${inquiryId}`);
        const { data: { user: requester } } = await adminClient.auth.getUser(); // Try to get requester if possible, but we might just use the inquiry's lawyer

        // 0. RECORD REVOCATION (The Kill Switch)
        if (inquiryId) {
            console.log(`   Step 0: Recording revocation for ${inquiryId}`);
            // Fetch lawyer ID from inquiry if not provided or to be sure
            const { data: inquiryData } = await adminClient
                .from('inquiries')
                .select('assigned_lawyer_id')
                .eq('id', inquiryId)
                .single();

            if (inquiryData?.assigned_lawyer_id) {
                await adminClient.from('revoked_access').upsert({
                    id: inquiryId,
                    lawyer_id: inquiryData.assigned_lawyer_id
                });
                console.log(`   ✅ Link ${inquiryId} is now officially DEAD.`);
            }
        }
        if (inquiryId) {
            console.log(`   Step 1: Cleaning messages for inquiry: ${inquiryId}`);
            await adminClient
                .from('messages')
                .delete()
                .eq('inquiry_id', inquiryId);

            // 2. Delete the Inquiry itself
            console.log(`   Step 2: Deleting inquiry card: ${inquiryId}`);
            await adminClient
                .from('inquiries')
                .delete()
                .eq('id', inquiryId);
        }

        // 3. Clean up by clientAuthId if provided (Registered Users)
        if (clientAuthId) {
            console.log(`   Step 3: Cleaning all inquiries for user: ${clientAuthId}`);
            await adminClient
                .from('inquiries')
                .delete()
                .eq('client_auth_id', clientAuthId);

            console.log(`   Step 4: deleting profile: ${clientAuthId}`);
            await adminClient
                .from('profiles')
                .delete()
                .eq('id', clientAuthId);

            console.log(`   Step 5: Deleting auth user: ${clientAuthId}`);
            const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(clientAuthId);
            if (authDeleteError && !authDeleteError.message.includes("User not found")) {
                console.error("❌ ERROR deleting auth user:", authDeleteError);
            }
        }

        console.log(`✅ ATOMIC CLEANUP COMPLETE`);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("❌ Error in client deletion API:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
