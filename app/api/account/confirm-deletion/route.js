import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getHtmlEmail } from '../../../lib/email-template';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
    try {
        const { otp } = await request.json();

        // 1. Verify Auth
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
            authHeader.replace('Bearer ', '')
        );
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 2. Validate OTP
        const { data: otpRecord, error: otpFetchError } = await supabaseAdmin
            .from('deletion_otps')
            .select('*')
            .eq('user_id', user.id)
            .eq('otp_code', otp)
            .gt('expires_at', new Date().toISOString()) // Not expired
            .maybeSingle();

        if (otpFetchError) throw otpFetchError;
        if (!otpRecord) {
            return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 400 });
        }

        console.log(`🗑️ STARTING CASCADE DELETION FOR USER: ${user.id}`);

        // 3. Cascade Deletion (Schema Aware)

        // Delete OTPs (cleanup)
        await supabaseAdmin.from('deletion_otps').delete().eq('user_id', user.id);

        // A. DELETE ORGANIZATIONS & RELATED CASES
        // First find orgs owned by user
        const { data: orgs } = await supabaseAdmin.from('organizations').select('id').eq('owner_id', user.id);

        if (orgs && orgs.length > 0) {
            const orgIds = orgs.map(o => o.id);
            // Delete Cases in these orgs
            await supabaseAdmin.from('cases').delete().in('org_id', orgIds);
            // Delete Organizations
            await supabaseAdmin.from('organizations').delete().eq('owner_id', user.id);
        }

        // B. DELETE DIRECT USER DATA
        // Inquiries (The "Clients" of the lawyer)
        await supabaseAdmin.from('inquiries').delete().eq('assigned_lawyer_id', user.id);

        // Research Reports
        await supabaseAdmin.from('research_reports').delete().eq('user_id', user.id);

        // Deadlines (Agenda events)
        await supabaseAdmin.from('deadlines').delete().eq('user_id', user.id);

        // C. DELETE PROFILE
        await supabaseAdmin.from('profiles').delete().eq('id', user.id);

        // 4. Delete Auth User
        const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteUserError) {
            console.error('Auth deletion failed:', deleteUserError);
            throw new Error('Error eliminando usuario de autenticación. Datos borrados parcialmente.');
        }

        // 5. Send Goodbye Email (Best Effort)
        try {
            await resend.emails.send({
                from: 'Judic-IA <noreply@judic-ia.com>',
                to: user.email,
                subject: '👋 Tu cuenta ha sido eliminada',
                html: getHtmlEmail({
                    heading: 'Cuenta Eliminada Exitosamente',
                    bodyContent: `
                        <p>Te confirmamos que tu cuenta de Judic-IA y todos tus datos (casos, clientes, reportes) han sido eliminados permanentemente de nuestros servidores.</p>
                        <p>Lamentamos verte partir. Si decides volver en el futuro, estaremos encantados de recibirte nuevamente con nuevas herramientas.</p>
                        <p>Hasta siempre,</p>
                        <p><strong>El equipo de Judic-IA</strong></p>
                    `
                })
            });
        } catch (emailErr) {
            console.error("Failed to send goodbye email:", emailErr);
            // Don't block response
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Deletion Confirmation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
