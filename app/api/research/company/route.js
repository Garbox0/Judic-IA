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

    // ══════════════════════════════════════════════════
    // 🔍 INTELLIGENT QUERY BUILDER
    // ══════════════════════════════════════════════════

    // Normalize company name for broader matches
    const cleanName = name
        ? name.trim()
            .replace(/\b(S\.?A\.?|S\.?R\.?L\.?|S\.?A\.?S\.?)\b/gi, '') // Strip legal suffixes
            .replace(/\s+/g, ' ')
            .trim()
        : null;

    const nameTerm = name ? `"${name}"` : null;
    const cleanNameTerm = cleanName && cleanName !== name?.trim() ? `"${cleanName}"` : null;
    const cuitTerm = cuit ? `"${cuit.replace(/\s/g, '')}"` : null;
    const primaryTerm = nameTerm || cuitTerm;

    // Core queries — always use company name (courts index by name, not CUIT)
    const queries = [
        `${primaryTerm} expediente judicial Argentina`,
        `${primaryTerm} c/ OR s/ causa sentencia`,
        `${primaryTerm} site:scw.pjn.gov.ar OR site:pjn.gov.ar`,
    ];

    // If we stripped "SA"/"SRL", search the clean name too (catches variations)
    if (cleanNameTerm) {
        queries.push(`${cleanNameTerm} demanda judicial Argentina`);
    }

    // CUIT as secondary signal (not primary — courts rarely index by CUIT)
    if (nameTerm && cuitTerm) {
        queries.push(`${cuitTerm} expediente OR causa OR sentencia`);
    }

    // Jurisdiction-specific court databases
    const jurisdictionSites = {
        buenosaires: [
            `${primaryTerm} site:scba.gov.ar OR site:juba.scba.gov.ar`,
        ],
        caba: [
            `${primaryTerm} site:jusbaires.gob.ar OR site:mpd.gov.ar`,
        ],
        todas: [
            `${primaryTerm} site:scba.gov.ar OR site:jusbaires.gob.ar OR site:justiciacordoba.gob.ar`,
        ]
    };

    if (jurisdictionSites[jurisdiction]) {
        queries.push(...jurisdictionSites[jurisdiction]);
    }

    // Cap at 5 Brave requests max (cost control: max $0.025 per search)
    const finalQueries = queries.slice(0, 5);

    // ══════════════════════════════════════════════════
    // ⚡ PARALLEL BRAVE SEARCH (faster than sequential)
    // ══════════════════════════════════════════════════

    const braveSearch = async (q) => {
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
            if (!res.ok) return [];
            const data = await res.json();
            return (data?.web?.results || []).map(r => ({
                title: r.title,
                url: r.url,
                snippet: [
                    r.description,
                    ...(r.extra_snippets || [])
                ].filter(Boolean).join(' | ')
            }));
        } catch {
            return [];
        }
    };

    const allBatches = await Promise.all(finalQueries.map(braveSearch));
    const allResults = allBatches.flat();

    // Dedupe by normalized URL
    const seen = new Set();
    const unique = allResults.filter(r => {
        const normalized = r.url.replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    }).slice(0, 30);

    if (unique.length === 0) {
        return NextResponse.json({ cases: [], message: 'No se encontraron resultados públicos para esta búsqueda.' });
    }

    // ══════════════════════════════════════════════════
    // 🧠 GPT EXTRACTION — surgical case identification
    // ══════════════════════════════════════════════════

    const openai = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': 'https://judic-ia.com', 'X-Title': 'Judic-IA' }
    });

    const gptRes = await openai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [{
            role: 'system',
            content: `Sos un analista jurídico argentino especializado en due diligence corporativo. Tu tarea es identificar expedientes judiciales reales a partir de resultados de búsqueda web.

REGLAS ESTRICTAS:
1. SOLO incluí resultados que sean claramente expedientes, causas, sentencias o resoluciones judiciales REALES
2. DESCARTÁ inmediatamente: noticias periodísticas, artículos de opinión, blogs, páginas genéricas, resultados de otras empresas con nombre similar
3. Si un resultado menciona la empresa pero NO es un expediente judicial concreto, NO lo incluyas
4. Verificá que el nombre de la empresa coincida (no confundir "Carrefour" con "Carrefour Express" si son entidades distintas)

EXTRACCIÓN:
- caratula: Formato estándar argentino "APELLIDO c/ EMPRESA s/ materia" — si no está completa, reconstruila con la info disponible
- expediente: Número de expediente exacto (ej: "FA07020156", "CNT 12345/2020") — null si no hay
- tribunal: Nombre completo del tribunal (ej: "Cámara Nacional de Apelaciones del Trabajo, Sala VII") — null si no hay
- año: Año del expediente o sentencia si es visible — null si no hay
- tipo: Categorizar en Laboral/Civil/Comercial/Penal/Contencioso Administrativo/Tributario/Otro
- estado: Activo/Archivado/Con sentencia — null si no se puede determinar
- resumen: 1 oración breve con el objeto del litigio si se puede inferir — null si no

JSON de respuesta:
{
  "cases": [
    {
      "caratula": "string",
      "expediente": "string|null",
      "tribunal": "string|null",
      "año": "string|null",
      "tipo": "string",
      "estado": "string|null",
      "resumen": "string|null",
      "url": "string"
    }
  ]
}

Máximo 15 resultados, ordenados por relevancia. Si no hay causas reales, devolvé { "cases": [] }.`
        }, {
            role: 'user',
            content: `Empresa investigada: ${name || ''}${name && cuit ? ' — CUIT: ' : ''}${cuit || ''}\n\nResultados web (${unique.length}):\n${unique.map((r, i) => `[${i + 1}] URL: ${r.url}\nTítulo: ${r.title}\nSnippet: ${r.snippet}`).join('\n---\n')}`
        }],
        response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(gptRes.choices[0].message.content);

    return NextResponse.json({
        cases: parsed.cases || [],
        meta: {
            queries_used: finalQueries.length,
            results_found: unique.length,
            jurisdiction
        }
    });
}
