import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { searchMEVByName } from '@/lib/scbaMevSolver';

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * SCBA MEV Search
 * HTTP scraper — no Puppeteer, no captcha, no credits.
 */
export async function POST(request) {
    try {
        // Auth
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token    = authHeader.replace('Bearer ', '');
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
        }

        // Body
        const body = await request.json();
        const { nombre, jurisdiccionId, maxOrganismos } = body;

        if (!nombre?.trim()) {
            return NextResponse.json({ error: 'Ingresá el nombre a buscar.' }, { status: 400 });
        }
        if (!jurisdiccionId) {
            return NextResponse.json({ error: 'Falta la jurisdicción.' }, { status: 400 });
        }

        console.log(`[SCBA Search] user:${user.id} nombre:"${nombre}" jur:${jurisdiccionId}`);

        const result = await searchMEVByName({
            nombre:        nombre.trim().toUpperCase(),
            jurisdiccionId,
            maxOrganismos: maxOrganismos ? Math.min(Number(maxOrganismos), 20) : 6,
        });

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 502 });
        }

        return NextResponse.json({
            results:            result.results ?? [],
            total:              result.total ?? 0,
            jurisdiccion:       result.jurisdiccion,
            organismosBuscados: result.organismosBuscados ?? [],
        });
    } catch (err) {
        console.error('[SCBA Search] Error:', err.message);
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
    }
}
