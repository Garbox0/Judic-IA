import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    // FIX: Ahora solo usamos Brave Search
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
            const isSuperUser = authUser?.email === 'gbrlescalada@gmail.com';

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

        // --- STAGE 0: DEBUG LOGS ---
        console.log("--- RESEARCH DEBUG ---");
        console.log("MODE:", mode);
        console.log("USER ID:", userId);
        console.log("USER ID:", userId);
        console.log("HAS BRAVE KEY:", !!braveApiKey);
        console.log("JURISDICTION:", jurisdiction);

        // --- STAGE 1: DORK GENERATION (OPTIMIZED & RELAXED) ---
        const dorkCompletion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [{
                role: "system",
                content: `Generá un objeto JSON { "queries": [string] } con 20 búsquedas avanzadas para: "${query}".
                JURISDICCIÓN: ${jurisdiction || 'Nacional'}.
                
                SI LA JURISDICCIÓN ES 'Nacional' o 'Federal':
                - PRIORIZÁ: pjn.gov.ar, cij.gov.ar, csjn.gov.ar, saij.gob.ar.
                - AGREGÁ: "filetype:pdf" para encontrar la sentencia completa.
                - EVITÁ: Dominios provinciales salvo relevancia.
                
                SI LA JURISDICCIÓN ES PROVINCIAL (ej: Buenos Aires):
                - PRIORIZÁ: El dominio judicial de esa provincia (ej: scba.gov.ar).
                
                IMPORTANTE: El usuario BUSCA FALLOS (Sentencias Judiciales), no guías de trámite.
                Usá términos: "sentencia", "fallo completo", "autos", "cámara expediente".
                AGREGÁ SIEMPRE: "-manual -guía -instructivo -tutorial -formulario" para filtrar ruido administrativo.`
            }],
            response_format: { type: "json_object" }
        });

        const { queries } = JSON.parse(dorkCompletion.choices[0].message.content);
        const searchResults = [];

        // --- STAGE 1.5: CACHE CHECK (Cost Optimization) ---
        const cleanQueries = queries.map(q => q.replace(/site:[^\s]+/g, '').trim()).filter(q => q.length > 5);

        const { data: cachedCases } = await supabase
            .from('case_library')
            .select('*')
            .textSearch('summary', cleanQueries.join(' | '), { config: 'spanish', type: 'websearch' })
            .limit(10);

        if (cachedCases?.length > 0) {
            console.log("Cache Hit! Using cases from library.");
            // Add implicit Private Link for cached items if not exists? 
            // Better to only link what is "found" or "viewed", but for now we treat search results as "found".
            cachedCases.forEach(c => searchResults.push({ title: c.autos, link: c.url, snippet: c.summary, source: c.jurisdiction || 'Biblioteca' }));
        }

        // --- STAGE 2: REAL-TIME SEARCH (BRAVE EXCLUSIVE) ---
        // Changed threshold to 10 as requested
        const canSearch = mode !== 'demo' && searchResults.length < 10;

        // Validamos solo BRAVE y queries
        if (braveApiKey && queries?.length > 0 && canSearch) {
            console.log("🚀 Starting Brave Pro Search...");

            const searchPromises = [];

            // Helper para filtrar (JURISDICTION AWARE)
            const filterResult = (r) => {
                try {
                    const urlObj = new URL(r.link);
                    const h = urlObj.hostname.replace(/^www\./, "");
                    const lowerQuery = (jurisdiction || 'nacional').toLowerCase();
                    const isFederal = lowerQuery.includes('nacional') || lowerQuery.includes('federal');

                    // 1. Filtrado por Fuentes Oficiales / Confiables
                    const isGov = h.includes("gov.ar") || h.includes("gob.ar") || h.includes("pjn.gov.ar");
                    const isBar = h.includes("colegioabogados") || h.includes("colproba") || h.includes("org.ar");
                    const isLegal = h.includes("saij") || h.includes("infojus") || h.includes("derecho") || h.includes("vlex") || h.includes("microjuris");

                    if (!isGov && !isBar && !isLegal) return false;

                    // 2. Filtrado Geográfico (Si es Federal, evitamos provinciales ruidosos)
                    if (isFederal) {
                        // Lista negra básica de provinciales si estamos en federal (para no contaminar)
                        if (h.includes("juscorrientes") || h.includes("jusmendoza") || h.includes("juschubut")) return false;
                    }

                    return true;
                } catch (e) { return false; }
            };

            // 1. BRAVE SEARCH (PARALLEL EXECUTION - PRO PLAN 50 REQ/S)
            // Execute ALL queries in parallel for maximum speed
            const bravePromise = Promise.all(queries.map(async (q) => {
                try {
                    const params = new URLSearchParams({ q: q, count: 20, country: "ar", search_lang: "es" });
                    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
                        headers: { "X-Subscription-Token": braveApiKey }
                    });

                    if (!res.ok) {
                        console.warn(`Brave Error ${res.status} for query: ${q}`);
                        return [];
                    }

                    const data = await res.json();
                    if (data.web?.results) {
                        return data.web.results.map(r => ({
                            title: r.title,
                            link: r.url,
                            snippet: r.description,
                            source: new URL(r.url).hostname.replace(/^www\./, "")
                        })).filter(filterResult);
                    }
                    return [];
                } catch (e) {
                    console.error("🦁 Brave Single Query Error:", e.message);
                    return [];
                }
            })).then(results => results.flat());

            searchPromises.push(bravePromise);

            // Execute All & Deduplicate
            const resultsArrays = await Promise.all(searchPromises);
            const seenUrls = new Set(searchResults.map(r => r.link));

            resultsArrays.flat().forEach(r => {
                if (r && !seenUrls.has(r.link)) {
                    seenUrls.add(r.link);
                    searchResults.push(r);
                }
            });
        }

        // --- STAGE 3: VERIFIED SYNTHESIS (USER FOCUSED OUTPUT) ---
        const isDemo = mode === 'demo';
        const contextText = searchResults.length > 0
            ? `FALLOS REALES ENCONTRADOS:\n${searchResults.map(r => `- [${r.source.toUpperCase()}] ${r.title}\n  URL: ${r.link}\n  Snippet: ${r.snippet}`).join('\n\n')}`
            : (isDemo ? "MODO DEMO: Usá leading cases." : "No se hallaron resultados directos.");

        const finalCompletion = await openai.chat.completions.create({
            model: "openai/gpt-4o",
            messages: [
                {
                    role: "system", content: `Sos Judic-IA, un asistente jurídico senior.
                
                CAMBIO DE FORMATO "JURISPRUDENCIA":
                El abogado QUIERE CANTIDAD (5 a 10 fallos).
                NO TE LIMITES A 3. SI ENCONTRÁS 10, DAME 10.
                
                OUTPUT 'cases':
                Debe ser un ARRAY DE OBJETOS.
                
                FORMATO OBLIGATORIO:
                - "summary": MÁXIMO 30-40 PALABRAS (2-3 líneas). Debe ser un resumen ULTRA-CONCISO del holding.
                - ESTILO DE TEXTO: Texto plano. NADA DE NEGRITAS (**). NADA DE MARKDOWN en los valores.

                FILTRO DE CALIDAD (CRÍTICO):
                - Descartá CUALQUIER resultado que sea un índice, un boletín sumario sin desarrollo, o un PDF que solo menciona la palabra clave al pasar.
                - Si el snippet dice "Índice", "Boletín", "Sumario", "Tabla de contenidos" -> IGNORARLO.
                - Solo incluí "cases" si estás 90% seguro de que es un FALLO/SENTENCIA real con autos definidos. Prefiero 3 fallos reales que 10 enlaces basura.

                JSON SCHEMA:
                - "laws": (Texto detallado con subtítulos y items)
                - "cases": [
                   { 
                     "title": "NOMBRE DEL FALLO", 
                     "summary": "Holding puntual (1-2 líneas).", 
                     "url": "https://...", 
                     "source": "FUENTE" 
                   }
                  ]
                - "strategy": (Estrategia paso a paso con subtítulos. TEXTO STRING MARKDOWN. NO OBJETO.)
                - "calculation": (Cálculo o liquidación detallada. TEXTO STRING MARKDOWN. NO OBJETO.)
                - "evidence": (Puntos de prueba listados. TEXTO STRING MARKDOWN. NO OBJETO.)

                NO DEVUELVAS MARKDOWN EN EL JSON EXTERNO, SOLO JSON PLANO.
                IMPORTANTE: "laws", "strategy", "calculation", "evidence" SON STRINGS. NO LOS HAGAS OBJETOS {"titulo": ...}.
                Si no hay casos, devuelve array vacío [].

                NO DEVUELVAS MARKDOWN, SOLO JSON PLANO.` },
                { role: "user", content: `Consulta: "${query}"\nJurisdicción: ${jurisdiction}\n\nCONTEXTO:\n${contextText}` }
            ],
            response_format: { type: "json_object" },
            max_tokens: 8000
        });

        const result = JSON.parse(finalCompletion.choices[0].message.content);

        // Fallback Links
        if ((!result.links || result.links.length === 0) && queries?.length > 0) {
            result.links = queries.map(q => ({
                title: `Búsqueda Manual: ${q.substring(0, 30)}...`,
                url: `https://www.google.com/search?q=${encodeURIComponent(q)}`
            }));
        }
        // Force links from search results into the response links array as well if valid
        if (searchResults.length > 0) {
            const existingLinks = result.links || [];
            searchResults.slice(0, 10).forEach(r => {
                if (!existingLinks.some(l => l.url === r.link)) {
                    existingLinks.push({ title: r.title, url: r.link });
                }
            });
            result.links = existingLinks;
        }

        // Save report & Update Library
        if (userId) {
            try {
                await supabase.from('research_reports').insert({ user_id: userId, query, jurisdiction: jurisdiction || 'Nacional', result_json: result });

                for (const r of searchResults) {
                    // 1. Global Cache Update
                    await supabase.from('case_library').upsert({ url: r.link, autos: r.title, summary: r.snippet, jurisdiction: jurisdiction || 'Nacional' }, { onConflict: 'url' });

                    // 2. Private Organization Link (Multi-Tenant)
                    if (userOrgId) {
                        await supabase.from('organization_library').upsert({ org_id: userOrgId, case_url: r.link }, { onConflict: 'org_id, case_url' });
                    }
                }
            } catch (dbErr) { console.error("Database persistence error:", dbErr); }
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error("Juris 3.0 Error:", error);
        return NextResponse.json({ laws: "Error técnico.", cases: "Intente nuevamente.", links: [] }, { status: 500 });
    }
}
