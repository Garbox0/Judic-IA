import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import RefVendorClient from './RefVendorClient';

// Server Component: busca el vendedor en la DB con el código
export default async function RefPage({ params }) {
    const { code } = await params;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    const { data, error } = await supabase
        .from('referral_codes')
        .select('code, name')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single();

    if (error || !data) {
        notFound();
    }

    return <RefVendorClient vendorName={data.name} code={data.code} />;
}

export async function generateMetadata({ params }) {
    const { code } = await params;
    return {
        title: `Judic-IA — Invitación especial`,
        description: `Accedé a la plataforma de inteligencia artificial para abogados con el respaldo de un asesor de confianza.`,
        robots: 'noindex', // No queremos que Google indexe páginas de vendedores
    };
}
