import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { verifyAccess } from '@/lib/tierMiddleware';
import { getPlanLimit } from '@/lib/planLimits';
import { isTrialExpired } from '@/app/lib/subscription';

export async function POST(request) {
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
    const apiKey = process.env.OPENROUTER_API_KEY;

    const { name, cuit, jurisdiction } = await request.json();

    if (!name && !cuit) {
        return NextResponse.json({ error: 'Ingresá nombre o CUIT' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

    const { data: profileData } = await supabase
        .from('profiles')
        .select('plan_tier, subscription_status, trial_ends_at, verification_status, research_reports_used, research_reports_extra')
        .eq('id', user.id)
        .single();

    if (profileData?.verification_status !== 'verified') {
        return NextResponse.json({ error: 'VERIFICATION_REQUIRED' }, { status: 403 });
    }

    if (profileData && isTrialExpired(profileData)) {
        return NextResponse.json({ error: 'TRIAL_EXPIRED' }, { status: 403 });
    }

    const isSuperUser = user?.email === 'gbrlescalada@gmail.com' && user?.id === '365cd259-4f1e-4004-a677-1eda06a5147e';

    if (!isSuperUser) {
        const accessCheck = await verifyAccess(user.id, 'advanced_research', 'research_reports');
        if (!accessCheck.allowed) {
            return NextResponse.json({ error: 'QUOTA_EXCEEDED', cases: [] }, { status: 402 });
        }

        const planLimit = getPlanLimit(profileData?.plan_tier || 'free', 'research_reports');
        await supabase.rpc('consume_research_report', {
            p_user_id: user.id,
            p_plan_limit: planLimit
        });
    }

    // Build targeted search queries
    const term = cuit
        ? `"${cuit.replace(/\s/g, '')}"`
        : `"${name}"`;

    const queries = [
        `${term} expediente judicial`,
        `${term} demanda causa judicial Argentina`,
        `${term} site:scw.pjn.gov.ar`,
    ];

    if (jurisdiction === 'buenosaires') {
        queries.push(`${term} site:scba.gov.ar`);
        queries.push(`${term} site:juba.scba.gov.ar`);
    } else if (jurisdiction === 'caba') {
        queries.push(`${term} site:jusbaires.gob.ar`);
    }

    // Brave Search
    const allResults = [];
    for (const q of queries.slice(0, 5)) {
        try {
            const params = new URLSearchParams({
                q,
                count: '10',
                country: 'ar',
                search_lang: 'es',
                extra_snippets: 'true'
            });
            const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Subscription-Token': braveApiKey
                }
            });
            if (res.ok) {
                const data = await res.json();
                const results = data?.web?.results || [];
                allResults.push(...results.map(r => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.description || r.extra_snippets?.[0] || ''
                })));
            }
        } catch { /* continue */ }
    }

    // Dedupe by URL
    const seen = new Set();
    const unique = allResults.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
    }).slice(0, 25);

    if (unique.length === 0) {
        return NextResponse.json({ cases: [], message: 'No se encontraron resultados públicos para esta búsqueda.' });
    }

    // GPT structures results into case cards
    const openai = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': 'https://judic-ia.com', 'X-Title': 'Judic-IA' }
    });

    const gptRes = await openai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [{
            role: 'system',
            content: `Sos un asistente jurídico argentino. Analizás resultados de búsqueda web para identificar expedientes judiciales de una empresa.

Extraé SOLO resultados que sean claramente expedientes, causas, o sentencias judiciales reales.
Descartá: noticias, artículos de opinión, páginas genéricas, resultados sin relación legal.

Devolvé JSON:
{
  "cases": [
    {
      "caratula": "nombre del expediente o causa",
      "expediente": "número si está disponible, sino null",
      "tribunal": "juzgado o cámara, sino null",
      "tipo": "Laboral" | "Civil" | "Comercial" | "Penal" | "Contencioso Administrativo" | "Otro",
      "estado": "Activo" | "Archivado" | null,
      "url": "URL del resultado"
    }
  ]
}

- caratula: ej "YPF SA c/ Estado Nacional s/ daños y perjuicios"
- Si la caratula no está clara, usá el título del resultado
- Máximo 15 resultados
- Si no hay causas judiciales reales, devolvé { "cases": [] }`
        }, {
            role: 'user',
            content: `Empresa buscada: ${name || cuit}\n\nResultados de búsqueda:\n${unique.map(r => `URL: ${r.url}\nTítulo: ${r.title}\nSnippet: ${r.snippet}`).join('\n---\n')}`
        }],
        response_format: { type: 'json_object' }
    });

    const { cases } = JSON.parse(gptRes.choices[0].message.content);

    return NextResponse.json({ cases: cases || [] });
}
