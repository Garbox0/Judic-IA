import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════════
// 🏛️ JUDIC-IA RESEARCH ENGINE v4.0 - "TERMINAL DE INTELIGENCIA JURÍDICA"
// ═══════════════════════════════════════════════════════════════════════════════
// CHANGELOG:
// - Whitelist expandida a 24 jurisdicciones argentinas
// - Scoring mejorado: penaliza hosts genéricos de PDF, bonifica terminología judicial
// - Prompt de síntesis refinado para Ratio Decidendi de mayor calidad
// - Dork generation con operadores site: explícitos
// ═══════════════════════════════════════════════════════════════════════════════

// 🔒 WHITELIST EXHAUSTIVA DE DOMINIOS JUDICIALES ARGENTINOS
const JUDICIAL_DOMAINS = {
    // FEDERALES / NACIONALES
    federal: [
        'csjn.gov.ar',           // Corte Suprema de Justicia de la Nación
        'pjn.gov.ar',            // Poder Judicial de la Nación (incluye CIJ)
        'cij.gov.ar',            // Centro de Información Judicial
        'saij.gob.ar',           // Sistema Argentino de Información Jurídica
        'infojus.gob.ar',        // InfoJus (legacy, aún funcional)
        'mpf.gob.ar',            // Ministerio Público Fiscal
        'mpd.gov.ar',            // Ministerio Público de la Defensa
        'boletinoficial.gob.ar', // Boletín Oficial
    ],
    // PROVINCIALES - Poderes Judiciales y Portales de Jurisprudencia
    provincial: [
        // Buenos Aires
        'scba.gov.ar', 'juba.scba.gov.ar', 'mpba.gov.ar',
        // CABA
        'jusbaires.gob.ar', 'tsjbaires.gov.ar', 'mptutelar.gob.ar',
        // Córdoba
        'justiciacordoba.gob.ar', 'tsjcordoba.gob.ar', 'web.justiciacordoba.gob.ar',
        // Santa Fe
        'justiciasantafe.gov.ar', 'jussantafe.gov.ar',
        // Mendoza
        'jus.mendoza.gov.ar', 'poderjudicial.mendoza.gov.ar',
        // Tucumán
        'justucuman.gov.ar', 'poder-judicial.tucuman.gov.ar',
        // Entre Ríos
        'jusentrerios.gov.ar',
        // Salta
        'justiciadesalta.gov.ar',
        // Misiones
        'jusmisiones.gov.ar',
        // Corrientes
        'juscorrientes.gov.ar',
        // Chaco
        'justiciachaco.gov.ar', 'juschaco.gov.ar',
        // San Juan
        'jussanjuan.gov.ar',
        // Formosa
        'jusformosa.gov.ar',
        // Neuquén
        'jusneuquen.gov.ar',
        // Río Negro
        'jusrionegro.gov.ar',
        // Chubut
        'juschubut.gov.ar',
        // Santa Cruz
        'jussantacruz.gov.ar',
        // La Pampa
        'juslapampa.gob.ar',
        // San Luis
        'justiciasanluis.gov.ar',
        // Catamarca
        'juscatamarca.gob.ar',
        // La Rioja
        'justicialarioja.gob.ar',
        // Santiago del Estero
        'jussantiago.gov.ar',
        // Jujuy
        'justiciajujuy.gov.ar',
        // Tierra del Fuego
        'justierradelfuego.gov.ar',
    ]
};

// 🚫 HOSTS GENÉRICOS A PENALIZAR (no son fuentes judiciales primarias)
const GENERIC_PDF_HOSTS = [
    'scribd.com', 'academia.edu', 'docsity.com', 'studocu.com',
    'drive.google.com', 'dropbox.com', 'mega.nz', 'mediafire.com',
    'slideshare.net', 'issuu.com', 'calameo.com', 'yumpu.com',
    'eldial.com', 'laleyonline.com.ar', // Paywall/Login required
];

// 🚫 DOMINIOS DE RUIDO (redes sociales, genéricos)
const NOISE_DOMAINS = [
    'pinterest.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'youtube.com', 'tiktok.com', 'linkedin.com', 'reddit.com',
    'wikipedia.org', 'blogspot.com', 'wordpress.com',
];

// Flatten para búsqueda rápida
const ALL_JUDICIAL_DOMAINS = [...JUDICIAL_DOMAINS.federal, ...JUDICIAL_DOMAINS.provincial];

export async function POST(request) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;

    // Debug Logging for API Key
    const keyStatus = braveApiKey ? `Present (Starts with ${braveApiKey.substring(0, 4)}..., Length: ${braveApiKey.length})` : 'MISSING';
    console.log(`🔑 Brave API Key Status: ${keyStatus}`);

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
            defaultHeaders: { "HTTP-Referer": "https://judic-ia.com", "X-Title": "Judic-IA" }
        });

        // --- STAGE 1: DORK GENERATION (ENHANCED with explicit site: operators) ---
        const jurisdictionSites = jurisdiction?.toLowerCase().includes('buenos aires')
            ? 'site:scba.gov.ar OR site:juba.scba.gov.ar'
            : jurisdiction?.toLowerCase().includes('córdoba') || jurisdiction?.toLowerCase().includes('cordoba')
                ? 'site:justiciacordoba.gob.ar OR site:tsjcordoba.gob.ar'
                : jurisdiction?.toLowerCase().includes('federal') || jurisdiction?.toLowerCase().includes('nacional')
                    ? 'site:csjn.gov.ar OR site:pjn.gov.ar OR site:saij.gob.ar'
                    : 'site:pjn.gov.ar OR site:saij.gob.ar'; // Default Nacional

        const dorkCompletion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [{
                role: "system",
                content: `Generá un objeto JSON { "queries": [string] } con 10 búsquedas jurídicas para: "${query}".
                JURISDICCIÓN: ${jurisdiction || 'Nacional'}.
                
                🎯 REGLAS PARA BRAVE SEARCH API:
                
                1. OPERADORES SOPORTADOS (USÁ ESTOS):
                   - site: (ejemplo: site:scba.gov.ar)
                   - Comillas para frase exacta: "cuota alimentaria"
                   - filetype:pdf (para sentencias en PDF)
                   - intitle: (ejemplo: intitle:sentencia)
                   - Exclusión simple: -formulario
                
                2. REGLAS CRÍTICAS:
                   - NUNCA uses "..." o puntos suspensivos
                   - NO abuses de comillas (máx 1 frase exacta por query)
                   - Mantené queries cortas y limpias
                
                3. ESTRUCTURA DE QUERIES:
                   - 2 queries con site:scba.gov.ar
                   - 2 queries con site:pjn.gov.ar
                   - 2 queries con site:saij.gob.ar  
                   - 2 queries con intitle:sentencia o intitle:fallo
                   - 2 queries generales (sin operadores complejos)
                
                4. PLANTILLAS OPTIMIZADAS:
                   - "visto y considerando" [tema] site:pjn.gov.ar
                   - [tema] fallo cámara filetype:pdf
                   - intitle:sentencia [tema] site:scba.gov.ar
                   - "autos y vistos" [tema]
                
                DEVOLVÉ SOLO EL JSON, SIN "..." NI TEXTO EXTRA.`
            }],
            response_format: { type: "json_object" }
        });

        const { queries: rawQueries } = JSON.parse(dorkCompletion.choices[0].message.content);
        const queries = [query, ...rawQueries].slice(0, 14);
        const searchResults = [];

        // --- STAGE 1.5: CACHE CHECK ---
        const cleanQueries = queries.map(q => q.replace(/site:[^\s]+/g, '').replace(/-\w+/g, '').trim()).filter(q => q.length > 5);
        const { data: cachedCases } = await supabase
            .from('case_library')
            .select('*')
            .textSearch('summary', cleanQueries.slice(0, 3).join(' | '), { config: 'spanish', type: 'websearch' })
            .limit(8);

        if (cachedCases?.length > 0) {
            cachedCases.forEach(c => searchResults.push({
                title: c.autos,
                link: c.url,
                snippet: c.summary,
                source: c.jurisdiction || 'Biblioteca Judic-IA',
                score: 120, // Cached = Pre-vetted
                fromCache: true
            }));
        }

        // --- STAGE 2: BRAVE SEARCH (with Enhanced Scoring) ---
        const canSearch = (mode !== 'demo' && searchResults.length < 15) || queries.length > 0;

        if (braveApiKey && queries?.length > 0 && canSearch) {

            // 🧠 ENHANCED SCORING ALGORITHM
            const calculateLegalScore = (r) => {
                let score = 0;
                const text = (r.title + " " + (r.snippet || '')).toLowerCase();
                const url = r.link.toLowerCase();

                // ══════════════════════════════════════════════════
                // 🏛️ TIER 1: OFFICIAL JUDICIAL DOMAINS (+50 to +80)
                // ══════════════════════════════════════════════════
                if (ALL_JUDICIAL_DOMAINS.some(d => url.includes(d))) {
                    score += 70; // Official judicial portal
                    // Extra boost for direct case access URLs
                    if (url.includes('/documento/') || url.includes('/fallo/') || url.includes('/sentencia/')) {
                        score += 20;
                    }
                } else if (url.includes('.gov.ar') || url.includes('.gob.ar')) {
                    score += 40; // Government but not judicial
                }

                // ══════════════════════════════════════════════════
                // 📜 TIER 2: LEGAL TERMINOLOGY BONUSES (+15 to +40)
                // ══════════════════════════════════════════════════
                // Core judicial markers (high confidence of being a real ruling)
                if (text.includes('visto y considerando')) score += 40;
                if (text.includes('autos:') || text.includes('autos ')) score += 35;
                if (text.includes('sentencia definitiva') || text.includes('fallo completo')) score += 30;
                if (text.includes('ratio decidendi') || text.includes('doctrina del fallo')) score += 30;

                // Case identification patterns
                if (/c\/.*s\//.test(text)) score += 25; // "Apellido c/ Apellido s/ Materia"
                if (text.includes('cámara de apelaciones') || text.includes('camara de apelaciones')) score += 20;
                if (text.includes('corte suprema') || text.includes('csjn')) score += 25;
                if (text.includes('tribunal superior') || text.includes('suprema corte')) score += 20;

                // General legal terms
                if (text.includes('expediente') || text.includes('legajo')) score += 15;
                if (text.includes('jurisprudencia') || text.includes('doctrina')) score += 10;
                if (text.includes('resolución') || text.includes('resolucion')) score += 10;

                // PDF bonus (when from official source)
                if (url.endsWith('.pdf') && score >= 40) score += 15;

                // ══════════════════════════════════════════════════
                // 🚫 TIER 3: PENALTIES (-30 to -100)
                // ══════════════════════════════════════════════════
                // Generic PDF hosts (NOT primary judicial sources)
                if (GENERIC_PDF_HOSTS.some(h => url.includes(h))) {
                    score -= 70;
                }

                // Social media / noise
                if (NOISE_DOMAINS.some(d => url.includes(d))) {
                    score -= 100;
                }

                // Non-legal content indicators (when NOT from official source)
                const isOfficial = ALL_JUDICIAL_DOMAINS.some(d => url.includes(d));
                if (!isOfficial) {
                    if (text.includes('modelo de') || text.includes('template') || text.includes('formulario')) score -= 40;
                    if (text.includes('cómo hacer') || text.includes('guía paso') || text.includes('tutorial')) score -= 35;
                    if (text.includes('plano') || text.includes('diseño') || text.includes('arquitectura')) score -= 50;
                }

                // Blog/article indicators (less reliable than official)
                if (url.includes('blog') || url.includes('articulo') || url.includes('noticias')) {
                    if (!isOfficial) score -= 20;
                }

                return score;
            };

            // 🧹 SANITIZE QUERIES FOR BRAVE COMPATIBILITY
            const sanitizeQueryForBrave = (q) => {
                return q
                    // CRITICAL: Remove accents/diacritics (Brave API returns 422 with accented chars)
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    // CRITICAL: Remove literal "..." or ellipsis (causes 422)
                    .replace(/\.{2,}/g, '')
                    .replace(/\u2026/g, '') // Unicode ellipsis
                    // Remove autos: which is not a valid Brave operator
                    .replace(/autos:/gi, '')
                    // Keep site: operator but clean it up
                    .replace(/site:([^\s]+)\s+OR\s+site:/gi, 'site:$1') // Remove OR between sites
                    // Remove excessive exclusions (keep max 2)
                    .replace(/([-]\w+\s*){3,}/g, (match) => match.split(/\s+/).slice(0, 2).join(' '))
                    // Remove special quotes that might cause issues
                    .replace(/[\u201c\u201d\u2018\u2019]/g, '"')
                    // Clean up multiple spaces
                    .replace(/\s+/g, ' ')
                    .trim();
            };

            // Parallel search execution
            const braveResults = await Promise.all(queries.map(async (q) => {
                try {
                    // Sanitize the query before sending
                    const sanitizedQuery = sanitizeQueryForBrave(q);

                    const params = new URLSearchParams({
                        q: sanitizedQuery,
                        count: '10', // String as suggested
                        country: "ar",
                        search_lang: "es",
                        extra_snippets: "true"
                    });
                    const braveUrl = `https://api.search.brave.com/res/v1/web/search?${params.toString()}`;
                    const res = await fetch(braveUrl, {
                        headers: {
                            "Accept": "application/json",
                            "X-Subscription-Token": braveApiKey
                        }
                    });
                    if (!res.ok) {
                        // Log more details for debugging (as GPT suggested)
                        const errorBody = await res.text().catch(() => 'No body');
                        console.warn(`❌ Brave ${res.status} | URL: ${braveUrl.replace(braveApiKey, '[REDACTED]')} | Error: ${errorBody}`);
                        return [];
                    }
                    const data = await res.json();

                    const results = data.web?.results || [];
                    console.log(`✅ Brave 200 | Query: ${sanitizedQuery} | Results: ${results.length}`);

                    return results.map(r => ({
                        title: r.title,
                        link: r.url,
                        snippet: r.description || r.extra_snippets?.join(' ') || '',
                        source: new URL(r.url).hostname.replace(/^www\./, ""),
                        score: 0
                    }));
                } catch (e) {
                    console.error("Brave fetch error:", e);
                    return [];
                }
            })).then(res => res.flat());

            // Score, filter, dedupe, and sort
            const seenUrls = new Set(searchResults.map(r => r.link));
            braveResults
                .map(r => {
                    r.score = calculateLegalScore(r);
                    return r;
                })
                .filter(r => r.score >= 25) // Higher threshold for quality
                .sort((a, b) => b.score - a.score)
                .forEach(r => {
                    if (r && !seenUrls.has(r.link) && seenUrls.size < 35) {
                        seenUrls.add(r.link);
                        searchResults.push(r);
                    }
                });

            console.log(`🔍 Brave Search: ${braveResults.length} raw → ${searchResults.filter(r => !r.fromCache).length} filtered (${searchResults.filter(r => r.fromCache).length} from cache)`);
        }

        // --- STAGE 3: STRATEGIC SYNTHESIS (Enhanced Prompt) ---
        const isDemo = mode === 'demo';
        const hasRealResults = searchResults.length > 0;

        const contextText = hasRealResults
            ? `FALLOS Y FUENTES VERIFICADAS (${searchResults.length} resultados):\n${searchResults.slice(0, 20).map(r => `- [SCORE: ${r.score}] [${r.source.toUpperCase()}] ${r.title}\n  URL: ${r.link}\n  Snippet: ${r.snippet}`).join('\n\n')}`
            : `⚠️ ALERTA: LA BÚSQUEDA NO DEVOLVIÓ RESULTADOS VERIFICABLES.\n\nINSTRUCCIONES CRÍTICAS:\n- NO INVENTES URLs bajo ningún concepto.\n- Para 'cases': dejá el array VACÍO [] o usá source: "Doctrina General" SIN url.\n- Compensá con análisis normativo y estratégico más profundo.\n- Podés mencionar leading cases conocidos (ej: "Aquino", "Vizzoti") pero SIN inventar URLs.`;

        const finalCompletion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Sos JUDIC-IA, una Terminal de Inteligencia Legal de élite para abogados litigantes senior.

🎯 TU MISIÓN: Transformar información jurídica en ESTRATEGIA ACCIONABLE. No sos Google, sos un abogado especialista.

═══════════════════════════════════════════════════════════════════════════════
📜 REGLAS DE ORO PARA 'cases' (JURISPRUDENCIA):
═══════════════════════════════════════════════════════════════════════════════

1. RATIO DECIDENDI (Lo más importante):
   - El 'summary' debe explicar la DOCTRINA CENTRAL del fallo, NO los hechos.
   - Formato: "El tribunal estableció que [doctrina]. Esto significa para el caso que [aplicación práctica]."
   - EXTENSIÓN OBLIGATORIA: Entre 60 y 100 palabras. Menos es insuficiente.
   - Si el snippet contiene una cita textual del fallo, INCLUILÁ entre comillas.

2. CITA PERFECTA:
   - 'title' debe seguir formato: "Autos: 'Apellido, N. c/ Apellido, M. s/ Materia' (Tribunal, Fecha si disponible)"
   - Ejemplo: "Autos: 'García, J. c/ Pérez, M. s/ Alimentos' (Cám. Civ. Sala II, 2023)"

3. TRAZABILIDAD (CRÍTICO):
   - 'url' DEBE ser una URL EXACTA del contexto proporcionado.
   - ⛔ ESTÁ PROHIBIDO inventar, modificar o "predecir" URLs.
   - ⛔ NO agregues ".pdf" si el contexto no lo tiene.
   - ✅ Si el link es HTML (no PDF), usalo igual. Un link real HTML > un PDF inventado.
   - Si no hay URL en el contexto para un fallo, MARCÁ source como "Doctrina General" y NO inventes URL.

4. PRIORIZACIÓN:
   - Priorizá resultados con SCORE alto en el contexto (son fuentes oficiales verificadas).
   - Resultados de scba.gov.ar, pjn.gov.ar, saij.gob.ar, csjn.gov.ar son ORO.

═══════════════════════════════════════════════════════════════════════════════
⚖️ REGLAS PARA OTRAS SECCIONES:
═══════════════════════════════════════════════════════════════════════════════

5. 'laws' (NORMATIVA):
   - No listes artículos de forma seca. Explicá la INTERPRETACIÓN jurisprudencial del artículo.
   - Incluí: Código aplicable + Artículos específicos + Doctrina mayoritaria + Excepciones.
   - EXTENSIÓN: Mínimo 150 palabras.

6. 'strategy' (ESTRATEGIA):
   - Dividí en tres secciones claras:
     a) TÁCTICA OFENSIVA: Línea argumental principal y subsidiaria.
     b) TÁCTICA DEFENSIVA: Anticipación de excepciones y cómo rebatirlas.
     c) GESTIÓN DE RIESGOS: Costas, plazos procesales, puntos débiles.
   - EXTENSIÓN: Mínimo 120 palabras.

7. 'calculation' (LIQUIDACIÓN):
   - Evitá generalidades. Proveé:
     - Rubros indemnizatorios específicos (ej: daño moral, lucro cesante, etc.)
     - Tasas de interés aplicables (ej: Tasa Activa BNA, Tasa Pasiva BCRA)
     - Fórmulas de cálculo si existen (ej: para incapacidad: fórmula Méndez/Marshall)
     - Rangos de montos según jurisprudencia reciente.

8. 'evidence' (PRUEBA):
   - Plan probatorio concreto: tipos de pericias, testigos clave, documental específica.

═══════════════════════════════════════════════════════════════════════════════
📤 OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════════════════════

- SI HAY RESULTADOS EN EL CONTEXTO: Devolvé entre 5 y 10 casos.
- SI NO HAY RESULTADOS: Devolvé "cases": [] (array vacío) y compensá con análisis normativo más profundo.
- ESTILO: Formal, imperativo, jurídico-técnico. SIN Markdown (**, ##, etc.).
- SOLO JSON válido, sin texto antes ni después.
- ⛔ NUNCA inventes URLs que no estén en el contexto.

{
  "laws": "Análisis normativo exhaustivo con interpretación jurisprudencial...",
  "cases": [
    { 
      "title": "Autos: 'Apellido c/ Apellido s/ Materia' (Tribunal, Año)", 
      "summary": "Ratio decidendi extendida de 60-100 palabras...", 
      "url": "SOLO si existe en el contexto, sino omitir este campo", 
      "source": "PJN / SCBA / SAIJ / CSJN / Doctrina General" 
    }
  ],
  "strategy": "Estrategia integral tripartita...",
  "calculation": "Parámetros técnicos de liquidación...",
  "evidence": "Plan probatorio detallado...",
  "links": []
}`
                },
                { role: "user", content: `CONSULTA LEGAL: "${query}"\nJURISDICCIÓN: ${jurisdiction || 'Nacional'}\n\n${contextText}` }
            ],
            response_format: { type: "json_object" },
            max_tokens: 10000
        });

        const result = JSON.parse(finalCompletion.choices[0].message.content);

        // --- ENRICH LINKS (Only from high-score results) ---
        const finalLinks = result.links || [];
        if (searchResults.length > 0) {
            // Only add links from results with score >= 50 (verified judicial sources)
            searchResults
                .filter(r => r.score >= 50)
                .slice(0, 10)
                .forEach(r => {
                    if (!finalLinks.some(l => l.url === r.link)) {
                        finalLinks.push({ title: r.title, url: r.link });
                    }
                });
        }
        // Backup Google searches (only if few links)
        if (finalLinks.length < 5 && queries?.length > 0) {
            const dorkLinks = queries.slice(0, 2).map(q => ({
                title: `🔍 Búsqueda avanzada: ${q.substring(0, 35)}...`,
                url: `https://www.google.com/search?q=${encodeURIComponent(q)}`
            }));
            dorkLinks.forEach(dl => {
                if (!finalLinks.some(fl => fl.url === dl.url)) finalLinks.push(dl);
            });
        }
        result.links = finalLinks;

        // --- PERSISTENCE (Higher threshold) ---
        if (userId) {
            try {
                await supabase.from('research_reports').insert({
                    user_id: userId,
                    query,
                    jurisdiction: jurisdiction || 'Nacional',
                    result_json: result
                });

                // Persist only GOLD STANDARD results (score >= 60)
                for (const r of searchResults) {
                    if (r.score >= 60 && !r.fromCache) {
                        await supabase.from('case_library').upsert({
                            url: r.link,
                            autos: r.title,
                            summary: r.snippet,
                            jurisdiction: jurisdiction || 'Nacional'
                        }, { onConflict: 'url' });

                        if (userOrgId) {
                            await supabase.from('organization_library').upsert({
                                org_id: userOrgId,
                                case_url: r.link
                            }, { onConflict: 'org_id, case_url' });
                        }
                    }
                }
            } catch (dbErr) {
                console.error("Database persistence error:", dbErr);
            }
        }

        result.brave_used = !!braveApiKey && queries.length > 0 && canSearch;
        result._debug = {
            total_results: searchResults.length,
            from_cache: searchResults.filter(r => r.fromCache).length,
            high_score: searchResults.filter(r => r.score >= 60).length
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error("Juris 4.0 Error:", error);
        return NextResponse.json({
            laws: "Error técnico en el motor de investigación.",
            cases: "Por favor, intente nuevamente en unos segundos.",
            links: []
        }, { status: 500 });
    }
}
