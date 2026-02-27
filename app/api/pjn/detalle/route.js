import { NextResponse } from 'next/server';
import { getExpedienteDetalle } from '../../../../lib/captchaSolver';

// Opcional: Proteger ruta con Supabase Auth si se requiere login
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req) {
    try {
        const body = await req.json();
        const { jurisdiccion, numero, anio } = body;

        if (!numero || !anio) {
            return NextResponse.json({ error: 'Falta número o año de expediente' }, { status: 400 });
        }

        // --- Verificación opcional de sesión ---
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            {
                cookies: {
                    get(name) { return cookieStore.get(name)?.value; },
                },
            }
        );

        // Opcional: Descomentar si la app requiere estar logueado para extraer detalles
        // const authHeader = req.headers.get('authorization');
        // if (authHeader) {
        //     const token = authHeader.replace('Bearer ', '');
        //     const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        //     if (authError || !user) {
        //         return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        //     }
        // }

        const detalles = await getExpedienteDetalle({ jurisdiccion, numero, anio });
        return NextResponse.json(detalles);

    } catch (error) {
        console.error('[API PJN Detalle] Error:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}
