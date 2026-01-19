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
        const { inquiryId, lawyerId } = await request.json();

        if (!inquiryId || !lawyerId) {
            return NextResponse.json({ error: "Faltan parámetros: inquiryId o lawyerId" }, { status: 400 });
        }

        // 🛡️ SECURITY: Verify Identity
        const { data: { user } } = await adminClient.auth.getUser();
        if (!user || user.id !== lawyerId) {
            return NextResponse.json({ error: "Unauthorized: Identity mismatch" }, { status: 401 });
        }

        // Verify Inquiry Ownership
        const { data: inqCheck } = await adminClient
            .from('inquiries')
            .select('assigned_lawyer_id')
            .eq('id', inquiryId)
            .single();

        if (!inqCheck || inqCheck.assigned_lawyer_id !== user.id) {
            return NextResponse.json({ error: "Forbidden: No eres el dueño de esta consulta." }, { status: 403 });
        }

        console.log(`📂 CASE CONVERSION START: inquiry=${inquiryId}, lawyer=${lawyerId}`);

        // 1. Get Lawyer Profile to check for existing org_id
        const { data: profile, error: profileError } = await adminClient
            .from('profiles')
            .select('org_id, full_name, email')
            .eq('id', lawyerId)
            .single();

        if (profileError || !profile) {
            throw new Error("Perfil de abogado no encontrado.");
        }

        let orgId = profile.org_id;

        // 2. LAZY STUDIO CREATION: If no org, create one
        if (!orgId) {
            console.log(`   🛠️ No org found for lawyer. Creating default 'Estudio Personal'...`);

            // 2.1 Create Organization
            const { data: newOrg, error: orgError } = await adminClient
                .from('organizations')
                .insert({
                    name: `Estudio ${profile.full_name || 'Legal'}`,
                    owner_id: lawyerId,
                    plan_tier: 'starter'
                })
                .select()
                .single();

            if (orgError) throw orgError;
            orgId = newOrg.id;

            // 2.2 Add lawyer as owner/member
            await adminClient
                .from('org_members')
                .insert({
                    org_id: orgId,
                    user_id: lawyerId,
                    role: 'owner'
                });

            // 2.3 Update Lawyer Profile with org_id
            await adminClient
                .from('profiles')
                .update({ org_id: orgId })
                .eq('id', lawyerId);
        }

        // 3. GET INQUIRY DATA
        const { data: inquiry, error: inqError } = await adminClient
            .from('inquiries')
            .select('*')
            .eq('id', inquiryId)
            .single();

        if (inqError || !inquiry) throw new Error("Consulta no encontrada.");

        // 4. CREATE CASE
        console.log(`   📝 Creating case for inquiry: ${inquiryId}`);
        const { data: newCase, error: caseError } = await adminClient
            .from('cases')
            .insert({
                org_id: orgId,
                title: inquiry.contact_name ? `Expediente: ${inquiry.contact_name}` : `Caso #${inquiryId.slice(0, 6)}`,
                matter: inquiry.case_type || 'General',
                status: 'open',
                inquiry_id: inquiryId,
                assigned_to: lawyerId
            })
            .select()
            .single();

        if (caseError) throw caseError;

        // 5. SYNC INQUIRY (Tag with org_id)
        await adminClient
            .from('inquiries')
            .update({ org_id: orgId })
            .eq('id', inquiryId);

        console.log(`✅ CASE CREATED: ${newCase.id}`);

        return NextResponse.json({
            success: true,
            case: newCase,
            orgId: orgId
        });

    } catch (error) {
        console.error("❌ Error in case conversion API:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
