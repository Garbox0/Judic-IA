import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
    const { query, jurisdiction, userId, mode } = await request.json();

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // --- QUOTA & LIMITS ---
    try {
        if (mode === 'demo') {
            const forwardedFor = request.headers.get('x-forwarded-for');
            let ip = forwardedFor ? forwardedFor.split(',')[0] : '127.0.0.1';
            const { data: limitData } = await supabase.from('demo_limits').select('research_count').eq('ip_address', ip).single();
            if ((limitData?.research_count || 0) >= 2) {
                return NextResponse.json({ laws: "🔒 LÍMITE ALCANZADO", cases: "Acceso ilimitado en versión PRO.", links: [] }, { status: 402 });
            }
            await supabase.from('demo_limits').upsert({ ip_address: ip, research_count: (limitData?.research_count || 0) + 1 }, { onConflict: 'ip_address' });
        } else if (userId) {
            // SUPERUSER CHECK
            const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
            const isSuperUser = authUser?.email === 'gbrlescalada@gmail.com' && authUser?.id === '365cd259-4f1e-4004-a677-1eda06a5147e';

            if (!isSuperUser) {
                const { data: quota } = await supabase.rpc("consume_ai_message", { p_user: userId });
                if (!quota?.ok) return NextResponse.json({ laws: "⚠️ CRÉDITOS AGOTADOS", cases: "Actualiza tu plan.", links: [] }, { status: 402 });
            } else {
                console.log("🛡️ SUPERUSER BYPASS ACTIVE: gbrlescalada@gmail.com");
            }
        }

        // --- STAGE 0.5: GET USER ORG (For Private Library) ---
        let userOrgId = null;
        if (userId) {
            const { data: orgMember } = await supabase.from('org_members').select('org_id').eq('user_id', userId).single();
            if (orgMember) userOrgId = orgMember.org_id;
        }

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://openrouter.ai/api/v1",
            defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "Judic-IA" }
        });

        // --- STAGE 1: DORK GENERATION (TERMINAL INTEL PROTOCOL) ---
        const dorkCompletion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [{
                role: "system",
                content: `Generá un objeto JSON { "queries": [string] } con 15 búsquedas jurídicas de ALTA PRECISIÓN para: "${query}".
                JURISDICCIÓN: ${jurisdiction || 'Nacional'}.
                
                PROTOCOLO DE BÚSQUEDA "TERMINAL DE INTELIGENCIA":
                - SI ES NACIONAL/FEDERAL: Priorizá dominios (.gov.ar) de CSJN, PJN, SAIJ, CIJ.
                - SI ES PROVINCIAL: Priorizá el portal de jurisprudencia provincial (ej: scba, jusmisiones, jussantafe).
                - OBJETIVO: Buscamos SENTENCIAS definitivas y leading cases. 
                - OPERADORES: Usá "autos", "expediente", "s/ daños", "sentencia", "visto y considerando", "filetype:pdf".
                - DIVERSIFICACIÓN: Realizá búsquedas variadas (procesal, fondo, cuantificación, doctrina).`
            }],
            response_format: { type: "json_object" }
        });

        const { queries: rawQueries } = JSON.parse(dorkCompletion.choices[0].message.content);
        const queries = [query, ...rawQueries].slice(0, 16);
        const searchResults = [];

        // --- STAGE 1.5: CACHE CHECK ---
        const cleanQueries = queries.map(q => q.replace(/site:[^\s]+/g, '').trim()).filter(q => q.length > 5);
        const { data: cachedCases } = await supabase
            .from('case_library')
            .select('*')
            .textSearch('summary', cleanQueries.join(' | '), { config: 'spanish', type: 'websearch' })
            .limit(10);

        if (cachedCases?.length > 0) {
            cachedCases.forEach(c => searchResults.push({ title: c.autos, link: c.url, snippet: c.summary, source: c.jurisdiction || 'Biblioteca', score: 100 }));
        }

        // --- STAGE 2: MASSIVE PARALLEL SEARCH (BRAVE PRO) ---
        const canSearch = (mode !== 'demo' && searchResults.length < 15) || queries.length > 0;
        if (braveApiKey && queries?.length > 0 && canSearch) {
            const legalWhiteList = [
                'pjn.gov.ar', 'cij.gov.ar', 'saij.gob.ar', 'csjn.gov.ar',
                'scba.gov.ar', 'mpba.gov.ar', 'justiciacordoba.gob.ar',
                'jusmisiones.gov.ar', 'jussantafe.gov.ar', 'jus.mendoza.gov.ar',
                'infojus.gob.ar', 'boletinoficial.gob.ar', 'buenosaires.gob.ar'
            ];

            const calculateLegalScore = (r) => {
                let score = 0;
                const text = (r.title + " " + r.snippet).toLowerCase();
                const url = r.link.toLowerCase();

                // High priority: Official Domains
                if (legalWhiteList.some(d => url.includes(d))) score += 50;
                if (url.includes('.gov.ar') || url.includes('.gob.ar')) score += 30;

                // Technical Keywords
                if (text.includes('autos:') || text.includes('expediente')) score += 40;
                if (text.includes('visto y considerando')) score += 30;
                if (text.includes('fallo completo') || text.includes('sentencia definitiva')) score += 25;
                if (text.includes('jurisprudencia') || text.includes('doctrina')) score += 15;

                // Negative keywords
                if (text.includes('plano') || text.includes('diseño') || text.includes('arquitectura')) {
                    if (!legalWhiteList.some(d => url.includes(d))) score -= 60;
                }
                if (url.includes('pinterest') || url.includes('facebook') || url.includes('instagram')) score -= 100;

                return score;
            };

            const braveResults = await Promise.all(queries.map(async (q) => {
                try {
                    // Using Pro features: extra snippets, clusters
                    const params = new URLSearchParams({
                        q: q,
                        count: 10,
                        country: "ar",
                        search_lang: "es",
                        extra_snippets: "1"
                    });
                    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
                        headers: { "X-Subscription-Token": braveApiKey }
                    });
                    if (!res.ok) return [];
                    const data = await res.json();

                    const results = (data.web?.results || []).map(r => ({
                        title: r.title,
                        link: r.url,
                        snippet: r.description,
                        source: new URL(r.url).hostname.replace(/^www\./, ""),
                        score: 0
                    }));

                    return results;
                } catch (e) { return []; }
            })).then(res => res.flat());

            const seenUrls = new Set(searchResults.map(r => r.link));
            braveResults
                .map(r => {
                    r.score = calculateLegalScore(r);
                    return r;
                })
                .filter(r => r.score > 15) // High relevance only
                .sort((a, b) => b.score - a.score)
                .forEach(r => {
                    if (r && !seenUrls.has(r.link) && seenUrls.size < 30) {
                        seenUrls.add(r.link);
                        searchResults.push(r);
                    }
                });
        }

        // --- STAGE 3: STRATEGIC SYNTHESIS ---
        const isDemo = mode === 'demo';
        const contextText = searchResults.length > 0
            ? `FALLOS REALES ENCONTRADOS:\n${searchResults.map(r => `- [${r.source.toUpperCase()}] ${r.title}\n  URL: ${r.link}\n  Snippet: ${r.snippet}`).join('\n\n')}`
            : (isDemo ? "MODO DEMO: Usá leading cases." : "No se hallaron resultados directos, USÁ TUS CONOCIMIENTOS GENERALES.");

        const finalCompletion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Sos Judic-IA, una Terminal de Inteligencia Legal de élite para abogados senior.
                
                TU MISIÓN: No sos un buscador, sos un estratega técnico. Procesa la información y entrega un Reporte de Estrategia Jurídica Blindada EXHAUSTIVO.
                
                REGLAS DE ORO JURÍDICAS:
                1. 'verified_jurisprudence' (cases): Buscamos la "Ratio Decidendi" (la razón central del fallo).
                   - 'summary': No narres los hechos. Explicá la DOCTRINA sentada por el juez y cómo se aplica al caso del usuario. Mínimo 20 palabras, máximo 50.
                2. 'trazabilidad' (CRÍTICO): USÁ ÚNICAMENTE LAS URLs PROPORCIONADAS EN EL CONTEXTO. 
                   - **ESTÁ TOTALMENTE PROHIBIDO INVENTAR, MODIFICAR O PREDECIR URLs.**
                   - NO AGREGUES ".pdf" AL FINAL DE UNA URL SI EL CONTEXTO NO LO TIENE.
                   - Si un link oficial en el contexto no es PDF, USALO IGUAL (es mejor un link HTML real que un PDF inventado).
                3. 'strategy': Debe ser PROFILÁCTICA y de ALTO NIVEL. Separá en:
                   - Táctica Ofensiva (Línea argumental principal).
                   - Táctica Defensiva (Respuestas a posibles excepciones de la contraparte).
                   - Gestión de Riesgos (Costas, plazos, debilidades).
                4. 'laws' (Normativa): No listes solo la ley. Explicá la INTERPRETACIÓN del artículo en el contexto de la consulta. Incluí doctrina relevante si aplica.
                5. 'calculation': Evitá lo genérico. Proveé parámetros técnicos de cuantificación (tasas de interés aplicables, rubros indemnizatorios específicos, fórmulas si existen).

                OUTPUT FORMAT:
                - ENTREGÁ ENTRE 5 Y 10 RESULTADOS EN 'cases'.
                - ESTILO: Formal, imperativo, jurídico-técnico. NADA DE MARKDOWN (**).

                JSON SCHEMA:
                {
                  "laws": "Análisis dogmático y normativo detallado (mínimo 150 palabras).",
                  "cases": [
                    { 
                      "title": "Autos: 'Apellido c/ Apellido s/ Materia'", 
                      "summary": "Ratio Decidendi y aplicación táctica.", 
                      "url": "URL DIRECTA", 
                      "source": "PJN / SCBA / SAIJ / CSJN" 
                    }
                  ],
                  "strategy": "Estrategia integral (Ofensiva + Defensiva + Riesgos). Detallada y accionable.",
                  "calculation": "Parámetros técnicos de liquidación y cuantificación.",
                  "evidence": "Plan probatorio: Periciales específicas, testigos clave y documental necesaria.",
                  "links": [ { "title": "Portal Oficial", "url": "..." } ]
                }

                IMPORTANTE: Si no hay fallos, compensá con una ESTRATEGIA Y NORMATIVA aún más profunda basada en la teoría general del derecho. NO DEVUELVAS MARKDOWN, SOLO JSON PLANO.`
                },
                { role: "user", content: `Consulta: "${query}"\nJurisdicción: ${jurisdiction}\n\nCONTEXTO:\n${contextText}` }
            ],
            response_format: { type: "json_object" },
            max_tokens: 8000
        });

        const result = JSON.parse(finalCompletion.choices[0].message.content);

        // --- ENRICH LINKS ---
        const finalLinks = result.links || [];
        if (searchResults.length > 0) {
            searchResults.slice(0, 8).forEach(r => {
                if (!finalLinks.some(l => l.url === r.link)) {
                    finalLinks.push({ title: r.title, url: r.link });
                }
            });
        }
        if (queries?.length > 0) {
            const dorkLinks = [queries[0], queries[1] || queries[0]].map(q => ({
                title: `Búsqueda adicional: ${q.substring(0, 40)}...`,
                url: `https://www.google.com/search?q=${encodeURIComponent(q)}`
            }));
            dorkLinks.forEach(dl => {
                if (!finalLinks.some(fl => fl.url === dl.url)) finalLinks.push(dl);
            });
        }
        result.links = finalLinks;

        // --- PERSISTENCE ---
        if (userId) {
            try {
                await supabase.from('research_reports').insert({ user_id: userId, query, jurisdiction: jurisdiction || 'Nacional', result_json: result });
                for (const r of searchResults) {
                    // GOLD STANDARD: Only persist to shared libraries if level of legal relevance is high
                    if (r.score >= 50) {
                        await supabase.from('case_library').upsert({ url: r.link, autos: r.title, summary: r.snippet, jurisdiction: jurisdiction || 'Nacional' }, { onConflict: 'url' });
                        if (userOrgId) {
                            await supabase.from('organization_library').upsert({ org_id: userOrgId, case_url: r.link }, { onConflict: 'org_id, case_url' });
                        }
                    }
                }
            } catch (dbErr) { console.error("Database persistence error:", dbErr); }
        }

        result.brave_used = !!braveApiKey && queries.length > 0 && canSearch;
        return NextResponse.json(result);

    } catch (error) {
        console.error("Juris 3.0 Error:", error);
        return NextResponse.json({ laws: "Error técnico.", cases: "Intente nuevamente.", links: [] }, { status: 500 });
    }
}
