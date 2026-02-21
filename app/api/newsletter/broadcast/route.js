import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase-server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getHtmlEmail } from '@/lib/email-template';
import { CHANGELOG } from '@/app/lib/changelog';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

async function verifyAdmin(supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    if (ADMIN_EMAIL && user.email !== ADMIN_EMAIL) return null;
    return user;
}

function getAdminClient() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );
}

// GET — subscriber count + last broadcast date (admin only)
export async function GET() {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const adminClient = getAdminClient();

    const [{ count }, { data: lastBroadcast }] = await Promise.all([
        adminClient
            .from('leads_newsletter')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active'),
        adminClient
            .from('newsletter_broadcasts')
            .select('entry_date, sent_at, sent_count')
            .order('sent_at', { ascending: false })
            .limit(1)
            .single(),
    ]);

    const latest = CHANGELOG[0] ?? null;
    const alreadySent = lastBroadcast?.entry_date === latest?.id;

    return NextResponse.json({
        count: count ?? 0,
        latest,
        last_broadcast: lastBroadcast ?? null,
        already_sent: alreadySent,
    });
}

// POST — send newsletter to all active subscribers (admin only)
export async function POST(request) {
    const secretHeader = request.headers.get('x-broadcast-secret');
    let isAuthorized = false;

    if (secretHeader && process.env.BROADCAST_SECRET && secretHeader === process.env.BROADCAST_SECRET) {
        isAuthorized = true;
    } else {
        const supabase = await createClient();
        const admin = await verifyAdmin(supabase);
        if (admin) isAuthorized = true;
    }

    if (!isAuthorized) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const latest = CHANGELOG[0];
    if (!latest) {
        return NextResponse.json({ error: 'No hay entradas en el changelog' }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Check if this entry was already broadcast
    const { data: existing } = await adminClient
        .from('newsletter_broadcasts')
        .select('entry_date')
        .eq('entry_date', latest.id)
        .single();

    if (existing) {
        return NextResponse.json(
            { error: 'already_sent', message: `Ya se envió la entrada "${latest.id}"` },
            { status: 409 }
        );
    }

    const { data: subscribers, error } = await adminClient
        .from('leads_newsletter')
        .select('email')
        .eq('status', 'active');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subscribers?.length) {
        return NextResponse.json({ sent: 0, message: 'No hay suscriptores activos' });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const itemsHtml = latest.items
        .map(item => `<li style="margin-bottom:8px; list-style:none; padding-left:1.2rem; position:relative; color:#94a3b8; font-size:0.9rem; line-height:1.6;">
            <span style="position:absolute; left:0; color:rgba(251,191,36,0.7);">→</span> ${item}
        </li>`)
        .join('');

    const bodyContent = `
        <p>Hay novedades en <strong>Judic-IA</strong> — <strong>${latest.date}</strong>.</p>
        <ul style="padding:0; margin:20px 0;">${itemsHtml}</ul>
        <p style="color:#64748b; font-size:0.88rem;">Hacé clic en el botón para ver el historial completo de cambios.</p>
    `;

    const emails = subscribers.map(sub => ({
        from: 'Judic-IA <hola@judic-ia.com>',
        to: sub.email,
        subject: `Novedades en Judic-IA — ${latest.date}`,
        html: getHtmlEmail({
            heading: '¿Qué hay de nuevo?',
            bodyContent,
            buttonText: 'Ver todas las novedades',
            buttonUrl: 'https://judic-ia.com/legal?tab=novedades',
            footerLinks: [
                { label: 'Darme de baja', url: `https://judic-ia.com/newsletter/unsubscribe?email=${encodeURIComponent(sub.email)}` },
            ],
        }),
    }));

    let sent = 0;
    for (let i = 0; i < emails.length; i += 100) {
        await resend.batch.send(emails.slice(i, i + 100));
        sent += Math.min(100, emails.length - i);
    }

    // Log the broadcast so it can't be sent again for this entry
    await adminClient
        .from('newsletter_broadcasts')
        .insert({ entry_date: latest.id, sent_count: sent });

    return NextResponse.json({ sent, date: latest.date });
}
