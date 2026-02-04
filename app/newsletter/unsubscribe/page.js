import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Forzar renderizado dinámico para captar parámetros de búsqueda
export const dynamic = 'force-dynamic';

export default async function UnsubscribePage({ searchParams }) {
    const params = await searchParams;
    const email = params.email;

    let success = false;
    let errorMsg = null;

    if (email) {
        try {
            // Inicializar Supabase con Service Role para bypass RLS y asegurar la baja
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            const { error } = await supabase
                .from('leads_newsletter')
                .update({ status: 'unsubscribed' })
                .eq('email', email);

            if (!error) {
                success = true;
            } else {
                console.error('Unsubscribe DB Error:', error);
                errorMsg = 'No pudimos procesar la solicitud en este momento.';
            }
        } catch (e) {
            console.error('Unsubscribe Server Error:', e);
            errorMsg = 'Error interno del servidor.';
        }
    } else {
        errorMsg = 'Email no proporcionado.';
    }

    return (
        <div className="unsubscribe-wrapper">
            {/* Importar CSS específico (ya está en public, pero lo vinculamos) */}
            <link rel="stylesheet" href="/newsletter/unsubscribe.css" />

            <div className="card">
                {success ? (
                    <>
                        <h1>Baja Confirmada</h1>
                        <p>Has sido dado de baja exitosamente de nuestra lista de correo para el email:<br />
                            <span className="email-label">{email}</span>
                        </p>
                    </>
                ) : (
                    <>
                        <h1 style={{ color: '#ef4444' }}>Ocurrió un error</h1>
                        <p>{errorMsg || 'No pudimos completar la operación.'}</p>
                    </>
                )}
                <Link href="/" className="btn">Volver al inicio</Link>
            </div>

        </div>
    );
}
