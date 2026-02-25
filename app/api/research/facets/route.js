import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/research/facets
 * Returns fuero counts and tribunal list from the local jurisprudencia_ba index.
 * No auth required (public metadata).
 * In-memory cache: 6 hours.
 */

const FUERO_LABELS = {
    civil_comercial: 'Civil y Comercial',
    familia: 'Familia',
    laboral: 'Laboral',
    penal: 'Penal',
    contencioso_admin: 'Contencioso Administrativo',
    previsional: 'Previsional',
    otro: 'Otro'
};

let cache = null;
let cacheAt = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function GET(request) {
    const nocache = new URL(request.url).searchParams.has('nocache');

    // Serve from cache if fresh (skip if ?nocache=1)
    if (!nocache && cache && Date.now() - cacheAt < CACHE_TTL_MS) {
        return NextResponse.json(cache, {
            headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=21600' }
        });
    }

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 1. Total count
        const { count: total } = await supabase
            .from('jurisprudencia_ba')
            .select('*', { count: 'exact', head: true });

        // If index is empty, return empty facets without erroring
        if (!total) {
            return NextResponse.json({ fueros: [], tribunales: [], total: 0 });
        }

        // 2. Fuero counts — use the facets view
        const { data: fueroRows } = await supabase
            .from('jurisprudencia_ba')
            .select('fuero')
            .not('fuero', 'is', null);

        // Aggregate client-side (Supabase JS doesn't expose GROUP BY directly)
        const fueroCounts = {};
        (fueroRows || []).forEach(r => {
            if (r.fuero) fueroCounts[r.fuero] = (fueroCounts[r.fuero] || 0) + 1;
        });

        const fueros = Object.entries(fueroCounts)
            .map(([key, count]) => ({
                key,
                label: FUERO_LABELS[key] || key,
                count
            }))
            .sort((a, b) => b.count - a.count);

        // 3. Tribunal list — distinct non-empty values with count
        const { data: tribunalRows } = await supabase
            .from('jurisprudencia_ba')
            .select('tribunal')
            .not('tribunal', 'is', null)
            .neq('tribunal', '');

        const tribunalCounts = {};
        (tribunalRows || []).forEach(r => {
            const t = r.tribunal?.trim();
            if (t && t.length > 3) {
                tribunalCounts[t] = (tribunalCounts[t] || 0) + 1;
            }
        });

        const tribunales = Object.entries(tribunalCounts)
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 500); // cap at 500 distinct tribunals

        const result = { fueros, tribunales, total: total || 0 };

        // Update cache
        cache = result;
        cacheAt = Date.now();

        return NextResponse.json(result, {
            headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=21600' }
        });
    } catch (err) {
        console.error('[facets] Error:', err.message);
        return NextResponse.json({ fueros: [], tribunales: [], total: 0 });
    }
}
