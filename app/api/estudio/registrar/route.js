/**
 * POST /api/estudio/registrar
 *
 * Registro público de un nuevo Estudio Jurídico.
 * Crea el usuario (titular), su perfil, la organización y el vínculo owner.
 * El estudio queda en verification_status: 'pending' hasta aprobación manual del admin.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { sendEmail } from '@/app/lib/resend';
import { getHtmlEmail } from '@/lib/email-template';
import { isValidEmail, isValidString } from '@/lib/validation';
import { checkRateLimit, getClientIP } from '@/lib/rate-limiter';

const PLAN_LABELS = {
    enterprise_s:  'Enterprise S — Hasta 5 miembros ($89.000/mes)',
    enterprise_m:  'Enterprise M — Hasta 10 miembros ($149.000/mes)',
    enterprise_l:  'Enterprise L — Hasta 20 miembros ($249.000/mes)',
    enterprise_xl: 'Enterprise XL — Miembros ilimitados ($449.000/mes)',
};

const VALID_PLANS = ['enterprise_s', 'enterprise_m', 'enterprise_l', 'enterprise_xl'];
const MEMBER_LIMITS = { enterprise_s: 5, enterprise_m: 10, enterprise_l: 20, enterprise_xl: null };

export async function POST(request) {
  try {
    return await _handlePost(request);
  } catch (outerErr) {
    console.error('[estudio/registrar] UNHANDLED OUTER ERROR:', outerErr?.message, outerErr?.stack);
    return NextResponse.json({
      error: 'Error inesperado al registrar el estudio.',
      _debug: outerErr?.message,
    }, { status: 500 });
  }
}

async function _handlePost(request) {
    // Rate limit: máximo 3 registros de estudio por IP por hora
    const ip = getClientIP(request);
    const rl = checkRateLimit(`registrar-estudio:${ip}`, 3, 60 * 60 * 1000);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Demasiadas solicitudes. Intentá más tarde.' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);

    if (!body) {
        return NextResponse.json({ error: 'Cuerpo de solicitud inválido.' }, { status: 400 });
    }

    const {
        razon_social, cuit, domicilio, phone,
        first_name, last_name, email, password,
        matriculas, plan_tier,
    } = body;

    // Validar campos obligatorios con límites de longitud
    if (!isValidString(razon_social, 200) || !isValidString(cuit, 20) || !isValidString(domicilio, 300) || !isValidString(phone, 30)) {
        return NextResponse.json({ error: 'Faltan datos del estudio.' }, { status: 400 });
    }
    if (!isValidString(first_name, 100) || !isValidString(last_name, 100) || !isValidEmail(email) || !isValidString(password, 128)) {
        return NextResponse.json({ error: 'Faltan datos del titular o el email es inválido.' }, { status: 400 });
    }
    if (!Array.isArray(matriculas) || matriculas.length === 0 || matriculas.length > 10) {
        return NextResponse.json({ error: 'El titular debe tener al menos una matrícula.' }, { status: 400 });
    }
    if (!VALID_PLANS.includes(plan_tier)) {
        return NextResponse.json({ error: 'Plan inválido.' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    // 1. Crear usuario en Supabase Auth
    const fullName = `${first_name} ${last_name}`;
    const m0 = matriculas[0];
    const finalMatricula = `T° ${m0.tomo} F° ${m0.folio}`;
    const finalJurisdiccion = m0.colegio;

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            first_name,
            last_name,
            full_name: fullName,
            role: 'lawyer',
            matricula: finalMatricula,
            jurisdiccion: finalJurisdiccion,
            matriculas,
        },
    });

    if (authErr) {
        const msg = authErr.message?.toLowerCase() || '';
        if (msg.includes('already registered') || msg.includes('already exists')) {
            return NextResponse.json({ error: 'Este email ya está registrado.' }, { status: 409 });
        }
        console.error('[estudio/registrar] Auth error:', authErr);
        return NextResponse.json({ error: 'Error al crear el usuario.' }, { status: 500 });
    }

    if (!authData?.user?.id) {
        console.error('[estudio/registrar] authData.user is null despite no error:', authData);
        return NextResponse.json({ error: 'Error al crear el usuario (user null).', _debug: 'authData.user is null' }, { status: 500 });
    }
    const userId = authData.user.id;

    try {
        // 1.5. Bloquear acceso hasta aprobación manual del admin
        const { error: banErr } = await supabase.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
        if (banErr) console.error('[estudio/registrar] Ban error (non-fatal):', banErr.message);

        // 2. Actualizar perfil con datos del titular
        // Nota: no tocamos plan_tier (protegido por trigger) — el plan vive en organizations
        const { error: profileErr } = await supabase
            .from('profiles')
            .update({
                full_name: fullName,
                matricula: finalMatricula,
                jurisdiccion: finalJurisdiccion,
                matriculas,
                verification_status: 'pending',
            })
            .eq('id', userId);
        if (profileErr) console.error('[estudio/registrar] Profile update error (non-fatal):', profileErr.message);

        // 3. Crear la organización
        const { data: org, error: orgErr } = await supabase
            .from('organizations')
            .insert({
                name: razon_social,
                owner_id: userId,
                type: 'estudio',
                verification_status: 'pending',
                razon_social,
                cuit,
                domicilio,
                phone,
                plan_tier,
                member_limit: MEMBER_LIMITS[plan_tier],
                settings: {},
            })
            .select('id')
            .single();

        if (orgErr) throw orgErr;

        const orgId = org.id;

        // 4. Crear vínculo owner
        await supabase
            .from('org_members')
            .insert({ org_id: orgId, user_id: userId, role: 'owner' });

        // 5. Actualizar perfil con org_id
        await supabase
            .from('profiles')
            .update({ org_id: orgId })
            .eq('id', userId);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';
        const resend = new Resend(process.env.RESEND_API_KEY);

        // 6. Notificar al admin — inline (evita self-fetch que Vercel corta al retornar)
        const matriculasHtml = Array.isArray(matriculas) && matriculas.length > 0
            ? `<p><strong>Matrículas del Titular (${matriculas.length}):</strong></p>
               <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:12px;">
                 <thead>
                   <tr style="background:#f1f5f9;">
                     <th style="padding:6px 10px;border:1px solid #e2e8f0;text-align:left;">Colegio</th>
                     <th style="padding:6px 10px;border:1px solid #e2e8f0;">Tomo</th>
                     <th style="padding:6px 10px;border:1px solid #e2e8f0;">Folio</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${matriculas.map(m => `<tr>
                     <td style="padding:6px 10px;border:1px solid #e2e8f0;">${m.colegio || '-'}</td>
                     <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;">${m.tomo || '-'}</td>
                     <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;">${m.folio || '-'}</td>
                   </tr>`).join('')}
                 </tbody>
               </table>`
            : '<p>Sin matrículas registradas.</p>';

        await sendEmail({
            resendClient: resend,
            to: 'gbrlescalada@gmail.com',
            from: 'Soporte Judic-IA <soporte@judic-ia.com>',
            subject: '🏛️ Nuevo Estudio Jurídico — Solicitud de verificación',
            html: getHtmlEmail({
                heading: 'Nuevo Estudio Jurídico',
                bodyContent: `
                    <p>Hola Gabriel,</p>
                    <p>Un nuevo estudio jurídico solicitó registro en Judic-IA:</p>
                    <div style="background:#f8f7f4;border-radius:10px;padding:16px;margin:12px 0;">
                      <p style="margin:0 0 6px;"><strong>Razón Social:</strong> ${razon_social}</p>
                      <p style="margin:0 0 6px;"><strong>CUIT:</strong> ${cuit || '-'}</p>
                      <p style="margin:0 0 6px;"><strong>Domicilio:</strong> ${domicilio || '-'}</p>
                      <p style="margin:0;"><strong>Teléfono:</strong> ${phone || '-'}</p>
                    </div>
                    <p><strong>Titular:</strong> ${fullName} &lt;${email}&gt;</p>
                    ${matriculasHtml}
                    <p><strong>Plan solicitado:</strong> ${PLAN_LABELS[plan_tier] || plan_tier}</p>
                    <p style="font-size:13px;color:#888;">ID de org: ${orgId || '-'}</p>
                    <p>Verificá el CUIT en ARCA y la matrícula del titular antes de aprobar.</p>
                `,
                buttonText: 'Verificar en Panel Admin',
                buttonUrl: `${appUrl}/dashboard/admin`,
            }),
        }).catch(err => console.error('[estudio/registrar] Admin email failed:', err));

        // 7. Confirmar recepción al titular (fire-and-forget)
        sendEmail({
            resendClient: resend,
            to: email,
            from: 'Judic-IA <soporte@judic-ia.com>',
            subject: 'Solicitud de Estudio Jurídico recibida — Judic-IA',
            html: getHtmlEmail({
                heading: 'Solicitud recibida',
                bodyContent: `
                    <p>Hola <strong>${fullName}</strong>,</p>
                    <p>Recibimos la solicitud de registro para el estudio <strong>${razon_social}</strong>.</p>
                    <div style="background:#f8f7f4;border-radius:10px;padding:16px;margin:12px 0;">
                      <p style="margin:0 0 6px;"><strong>Plan solicitado:</strong> ${PLAN_LABELS[plan_tier] || plan_tier}</p>
                      <p style="margin:0;"><strong>Estado:</strong> En revisión</p>
                    </div>
                    <p>Nuestro equipo verificará los datos y la matrícula del titular. Te avisaremos por este medio cuando el estudio esté habilitado para operar.</p>
                    <p style="font-size:13px;color:#888;">Este proceso puede demorar hasta 48 horas hábiles. Si tenés alguna duda, contactanos en soporte@judic-ia.com.</p>
                `,
                buttonText: 'Ver mi panel',
                buttonUrl: `${appUrl}/dashboard`,
            }),
        }).catch(err => console.error('[estudio/registrar] Confirm email failed:', err));

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error('[estudio/registrar] FATAL:', err.message, err.code, err.details);
        // Intentar limpiar el usuario creado si algo falló
        await supabase.auth.admin.deleteUser(userId).catch(() => {});
        // Devolver el error real para diagnóstico (se puede opacar en producción una vez resuelto)
        return NextResponse.json({
            error: 'Error al registrar el estudio. Intentá nuevamente.',
            _debug: err.message,
        }, { status: 500 });
    }
}
