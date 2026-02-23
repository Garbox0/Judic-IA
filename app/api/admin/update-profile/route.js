import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendEmail } from '@/app/lib/resend';
import { getHtmlEmail } from '@/lib/email-template';

export async function POST(request) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        // 1. Verify Requester is the unique allowed Admin (Gabriel)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user || user.email !== 'gbrlescalada@gmail.com') {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await request.json();

        // ── ACTION: update_matricula (per-entry verification) ──────────────
        if (body.action === 'update_matricula') {
            const { userId, matriculaId, status, rejection_reason } = body;
            if (!userId || !matriculaId || !status) {
                return NextResponse.json({ error: 'Missing userId, matriculaId or status' }, { status: 400 });
            }

            // Fetch current profile
            const { data: profile, error: fetchErr } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            if (fetchErr || !profile) throw fetchErr || new Error('Profile not found');

            const currentMatriculas = Array.isArray(profile.matriculas) ? profile.matriculas : [];
            const entryIndex = currentMatriculas.findIndex(m => m.id === matriculaId);
            if (entryIndex === -1) return NextResponse.json({ error: 'Matricula not found' }, { status: 404 });

            // Update the specific entry
            const entry = { ...currentMatriculas[entryIndex] };
            entry.status = status;
            if (status === 'verified') {
                entry.verified_at = new Date().toISOString();
                entry.rejection_reason = null;
            } else if (status === 'rejected') {
                entry.rejection_reason = rejection_reason || null;
                entry.verified_at = null;
            }
            const updatedMatriculas = currentMatriculas.map((m, i) => i === entryIndex ? entry : m);

            // Recalculate derived fields
            const hasVerified = updatedMatriculas.some(m => m.status === 'verified');
            const allRejected = updatedMatriculas.every(m => m.status === 'rejected');
            const newVerifStatus = hasVerified ? 'verified' : allRejected ? 'rejected' : 'pending';
            const primary = updatedMatriculas.find(m => m.status === 'verified' && m.principal)
                || updatedMatriculas.find(m => m.status === 'verified')
                || updatedMatriculas[0];
            const newMatricula = primary ? `T° ${primary.tomo} F° ${primary.folio}` : (profile.matricula || '');
            const newJurisdiccion = primary ? primary.colegio : (profile.jurisdiccion || '');
            const verifiedZones = updatedMatriculas.filter(m => m.status === 'verified').map(m => m.zona).filter(Boolean);
            const existingZones = Array.isArray(profile.coverage_zones) ? profile.coverage_zones : [];
            const newCoverageZones = [...new Set([...existingZones, ...verifiedZones])];

            const { data: updated, error: updateErr } = await supabaseAdmin
                .from('profiles')
                .update({
                    matriculas: updatedMatriculas,
                    verification_status: newVerifStatus,
                    matricula: newMatricula,
                    jurisdiccion: newJurisdiccion,
                    coverage_zones: newCoverageZones,
                    ...(newVerifStatus !== 'rejected' ? { rejection_reason: null } : {})
                })
                .eq('id', userId)
                .select()
                .single();
            if (updateErr) throw updateErr;

            // Send specific email for this entry
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com';
            const userEmail = updated.email;
            const entryLabel = `${entry.colegio} (T° ${entry.tomo} F° ${entry.folio})`;
            if (userEmail) {
                if (status === 'verified') {
                    await sendEmail({
                        resendClient: resend,
                        to: userEmail,
                        subject: '✅ Matrícula verificada en Judic-IA',
                        html: getHtmlEmail({
                            heading: 'Matrícula Verificada',
                            bodyContent: `
                                <p>Hola <strong>${updated.full_name || ''}</strong>,</p>
                                <p>Tu matrícula en <strong>${entryLabel}</strong> fue verificada con éxito.</p>
                                ${!hasVerified || newVerifStatus === 'verified' ? '<p>Tu perfil está ahora completamente activo en el marketplace.</p>' : ''}
                            `,
                            buttonText: 'Ver mi perfil',
                            buttonUrl: `${appUrl}/dashboard/settings`,
                        })
                    });
                } else if (status === 'rejected') {
                    await sendEmail({
                        resendClient: resend,
                        to: userEmail,
                        subject: '⚠️ Matrícula no verificada en Judic-IA',
                        html: getHtmlEmail({
                            heading: 'Revisión de Matrícula',
                            bodyContent: `
                                <p>Hola <strong>${updated.full_name || ''}</strong>,</p>
                                <p>No pudimos verificar tu matrícula en <strong>${entryLabel}</strong>.</p>
                                ${rejection_reason ? `<div style="background:#fff1f2;border-left:4px solid #f43f5e;padding:12px 16px;border-radius:6px;margin:12px 0;"><strong>Motivo:</strong> ${rejection_reason}</div>` : ''}
                                <p>Podés corregirla desde Ajustes y la revisaremos nuevamente.</p>
                            `,
                            buttonText: 'Corregir en Ajustes',
                            buttonUrl: `${appUrl}/dashboard/settings`,
                        })
                    });
                }
            }

            return NextResponse.json({ success: true, data: updated });
        }

        // ── DEFAULT ACTION: full profile update (existing behaviour) ────────
        const { userId, updates } = body;

        if (!userId || !updates) {
            return NextResponse.json({ error: 'Missing userId or updates' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        // 📧 Handle Email Notifications based on verification_status
        if (updates.verification_status && data) {
            const userEmail = data.email;
            if (userEmail) {
                if (updates.verification_status === 'verified') {
                    await sendEmail({
                        resendClient: resend,
                        to: userEmail,
                        subject: '¡Felicidades! Tu matrícula ha sido verificada con éxito',
                        html: getHtmlEmail({
                            heading: '¡Verificado!',
                            bodyContent: `
                                <p>Hola <strong>${data.full_name || ''}</strong>,</p>
                                <p>Tu matrícula profesional fue verificada con éxito en <strong>Judic-IA</strong>.</p>
                                <p>Ahora tenés acceso completo a las funciones exclusivas para abogados verificados.</p>
                            `,
                            buttonText: 'Ir a mi perfil',
                            buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com'}/dashboard/settings`,
                        })
                    });
                } else if (updates.verification_status === 'rejected') {
                    const reason = updates.rejection_reason || data.rejection_reason || '';
                    await sendEmail({
                        resendClient: resend,
                        to: userEmail,
                        subject: 'Judic-IA: No hemos podido validar tu matrícula',
                        html: getHtmlEmail({
                            heading: 'Aviso de Verificación',
                            bodyContent: `
                                <p>Hola <strong>${data.full_name || ''}</strong>,</p>
                                <p>No hemos podido validar tu matrícula con los datos proporcionados.</p>
                                ${reason ? `<div style="background:#fff1f2;border-left:4px solid #f43f5e;padding:12px 16px;border-radius:6px;margin:12px 0;"><strong>Motivo:</strong> ${reason}</div>` : ''}
                                <p>Ingresá a tus ajustes y revisá que el colegio, tomo y folio estén escritos correctamente.</p>
                            `,
                            buttonText: 'Corregir en Ajustes',
                            buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://judic-ia.com'}/dashboard/settings`,
                        })
                    });
                }
            }
        }

        return NextResponse.json({ success: true, data });

    } catch (error) {
        console.error('Error in Admin Update API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
