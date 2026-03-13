/**
 * POST /api/pjn/importar
 *
 * Importa un expediente PJN/SCBA al dashboard de Expedientes del usuario.
 * Consume 1 crédito de antecedentes y crea un Case con los datos del expediente.
 *
 * Body: {
 *   expediente: string,      // número de expediente (ej. "12345/2020")
 *   caratula: string,        // carátula
 *   fuero: string,           // label del fuero (ej. "CNT", "CIV")
 *   jurisdiccion: string,    // ID de jurisdicción (ej. "7")
 *   source: 'pjn' | 'scba', // portal de origen
 *   detail: object | null,   // detalle ya cargado (actuaciones, intervinientes, datosGenerales)
 *   link: string | null,     // URL original en el portal
 * }
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/api-auth';

// Mapeo jurisdicción PJN → materia legal
const PJN_MATERIA_MAP = {
    '0': 'Constitucional',           // CSJ
    '1': 'Civil',                    // CIV
    '2': 'Contencioso Administrativo', // CAF
    '3': 'Civil y Comercial Federal',// CCF
    '4': 'Electoral',                // CNE
    '5': 'Previsional',              // CSS
    '6': 'Penal Económico',          // CPE
    '7': 'Laboral',                  // CNT
    '8': 'Penal',                    // CFP
    '9': 'Penal',                    // CCC
    '10': 'Comercial',                // COM
    '11': 'Penal',                    // CPF
    '12': 'Penal',                    // CPN
    '13': 'Federal',                  // FBB
    '14': 'Federal',                  // FCR
    '15': 'Federal',                  // FCB
    '16': 'Federal',                  // FCT
    '17': 'Federal',                  // FGR
    '18': 'Federal',                  // FLP
    '19': 'Federal',                  // FMP
    '20': 'Federal',                  // FMZ
    '21': 'Federal',                  // FPO
    '22': 'Federal',                  // FPA
    '23': 'Federal',                  // FRE
    '24': 'Federal',                  // FSA
    '25': 'Federal',                  // FRO
    '26': 'Federal',                  // FSM
    '27': 'Federal',                  // FTU
};

export async function POST(request) {
    // ─── INTERNAL AGENT BYPASS ─────────────────────────────────────────────
    const internalKey = request.headers.get('x-internal-key');
    const isInternalAgent = internalKey && internalKey === process.env.INTERNAL_API_KEY;
    let userId, preBody;

    if (isInternalAgent) {
        preBody = await request.json();
        userId = preBody.user_id;
        if (!userId) return NextResponse.json({ error: 'user_id requerido para acceso interno' }, { status: 400 });
    } else {
        const auth = await verifyAuth(request);
        if (auth.error) return auth.response;
        userId = auth.user.id;
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    try {
        const body = preBody ?? await request.json();
        const { expediente, caratula, fuero, jurisdiccion, source = 'pjn', detail, link, sessionToken } = body;

        if (!expediente || !caratula) {
            return NextResponse.json({ error: 'Faltan datos del expediente.' }, { status: 400 });
        }

        const isSuperUser = userId === '365cd259-4f1e-4004-a677-1eda06a5147e';

        // 1. Detectar si el usuario pertenece a un estudio verificado
        let useOrgPool = false;
        let orgIdForCredits = null;

        if (!isSuperUser) {
            const { data: profileForOrg } = await supabase
                .from('profiles')
                .select('org_id')
                .eq('id', userId)
                .single();

            if (profileForOrg?.org_id) {
                const { data: memberForOrg } = await supabase
                    .from('org_members')
                    .select('role, org:org_id(type, verification_status)')
                    .eq('user_id', userId)
                    .eq('org_id', profileForOrg.org_id)
                    .single();

                if (
                    memberForOrg?.org?.type === 'estudio' &&
                    memberForOrg?.org?.verification_status === 'verified'
                ) {
                    useOrgPool = true;
                    orgIdForCredits = profileForOrg.org_id;
                }
            }
        }

        // 2. Consumir 1 crédito (atómico, evita race conditions)
        if (!isSuperUser) {
            if (useOrgPool) {
                const { data: creditResult, error: creditErr } = await supabase.rpc(
                    'consume_org_antecedentes_credit',
                    { p_org_id: orgIdForCredits }
                );

                if (creditErr) throw creditErr;

                if (creditResult === 'exhausted') {
                    return NextResponse.json(
                        { error: 'CREDITS_EXHAUSTED', message: 'El estudio no tiene créditos de antecedentes disponibles.' },
                        { status: 402 }
                    );
                }
                if (creditResult === 'org_missing') {
                    return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 });
                }
            } else {
                const { data: creditResult, error: creditErr } = await supabase.rpc(
                    'consume_antecedentes_credit',
                    { p_user_id: userId }
                );

                if (creditErr) throw creditErr;

                if (creditResult === 'exhausted') {
                    return NextResponse.json(
                        { error: 'CREDITS_EXHAUSTED', message: 'No tenés créditos de antecedentes disponibles.' },
                        { status: 402 }
                    );
                }
                if (creditResult === 'profile_missing') {
                    return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 404 });
                }
            }
        }

        // 3. Obtener (o crear) org del usuario
        const { data: profile } = await supabase
            .from('profiles')
            .select('org_id, full_name')
            .eq('id', userId)
            .single();

        let orgId = profile?.org_id || null;

        if (!orgId) {
            const { data: newOrg } = await supabase
                .from('organizations')
                .insert({
                    name: `Estudio ${profile?.full_name || 'Personal'}`,
                    owner_id: userId,
                    plan_tier: 'starter',
                })
                .select('id')
                .single();

            if (newOrg?.id) {
                orgId = newOrg.id;
                await supabase.from('org_members').insert({ org_id: orgId, user_id: userId, role: 'owner' });
                await supabase.from('profiles').update({ org_id: orgId }).eq('id', userId);
            }
        }

        // 4. Armar pjn_data (limitar actuaciones a 200 para no inflar la DB)
        const actuaciones = Array.isArray(detail?.actuaciones)
            ? detail.actuaciones.slice(0, 200)
            : [];

        const pjnData = {
            expediente,
            caratula,
            fuero,
            jurisdiccion,
            source,
            link: link || null,
            imported_at: new Date().toISOString(),
            datosGenerales: detail?.datosGenerales || {},
            intervinientes: Array.isArray(detail?.intervinientes) ? detail.intervinientes : [],
            actuaciones,
            total_actuaciones: Array.isArray(detail?.actuaciones) ? detail.actuaciones.length : 0,
            sessionToken: sessionToken || null,
        };

        // 5. Crear el Case
        const matterLabel = source === 'scba'
            ? 'Civil y Comercial'
            : (PJN_MATERIA_MAP[String(jurisdiccion)] || 'General');

        const { data: newCase, error: caseErr } = await supabase
            .from('cases')
            .insert({
                org_id: orgId,
                assigned_to: userId,
                title: caratula,
                matter: matterLabel,
                status: 'open',
                source: 'pjn_import',
                pjn_data: pjnData,
            })
            .select('id')
            .single();

        if (caseErr) throw caseErr;

        // 6. Registrar uso de crédito del estudio (para historial por miembro)
        if (useOrgPool && orgIdForCredits) {
            await supabase.from('org_antecedentes_credit_usage').insert({
                org_id: orgIdForCredits,
                used_by: userId,
                case_id: newCase.id,
                expediente,
            });
        }

        console.log(`[PJN Import] Expediente importado: ${expediente} → case ${newCase.id} (user ${userId}${useOrgPool ? `, org pool ${orgIdForCredits}` : ''})`);

        // Fetch verified balance so client always shows server-confirmed value
        let credits_left = null;
        if (!isSuperUser) {
            if (useOrgPool && orgIdForCredits) {
                const { data: orgAfter } = await supabase
                    .from('organizations').select('antecedentes_credits_pool').eq('id', orgIdForCredits).single();
                credits_left = Math.max(0, orgAfter?.antecedentes_credits_pool ?? 0);
            } else {
                const { data: profAfter } = await supabase
                    .from('profiles').select('antecedentes_credits').eq('id', userId).single();
                credits_left = Math.max(0, profAfter?.antecedentes_credits ?? 0);
            }
        }

        return NextResponse.json({ success: true, caseId: newCase.id, credits_left });

    } catch (err) {
        console.error('[PJN Import] Error:', err.message);
        return NextResponse.json({ error: err.message || 'Error al importar el expediente.' }, { status: 500 });
    }
}
