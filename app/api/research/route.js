import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import {
    generateAllSourceQueries,
    isValidCaseUrl,
    enhanceWithSourceInfo,
    identifySource
} from '@/lib/directSources';
import { isTrialExpired } from '@/app/lib/subscription';
import { verifyAccess } from '@/lib/tierMiddleware';
import { getPlanLimit } from '@/lib/planLimits';
import { semanticRerank } from '@/lib/embeddings';


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
        'consejomagistratura.gov.ar', // Consejo de la Magistratura
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
    // console.log(`🔑 Brave API Key Status: ${keyStatus}`);

    const { query, jurisdiction, userId, mode } = await request.json();

    // 🛡️ INPUT VALIDATION
    if (!query || typeof query !== 'string' || query.length > 2000) {
        return NextResponse.json({ error: 'Consulta inválida (máx 2.000 caracteres)' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // --- QUOTA & LIMITS ---
    // --- SECURITY: IDOR PROTECTION & QUOTA ---
    try {
        let effectiveUserId = null;
        let useOrgResearchPool = false;
        let orgIdForResearch = null;

        if (mode === 'demo') {
            const forwardedFor = request.headers.get('x-forwarded-for');
            let ip = forwardedFor ? forwardedFor.split(',')[0] : '127.0.0.1';

            // Demo Limit Check
            const { data: limitData } = await supabase.from('demo_limits').select('research_count').eq('ip_address', ip).single();
            if ((limitData?.research_count || 0) >= 2) {
                return NextResponse.json({ laws: "🔒 LÍMITE ALCANZADO", cases: "Acceso ilimitado en versión PRO.", links: [] }, { status: 402 });
            }
            await supabase.from('demo_limits').upsert({ ip_address: ip, research_count: (limitData?.research_count || 0) + 1 }, { onConflict: 'ip_address' });

        } else {
            // PRO/AUTH MODE: Validate Session Token (Fix IDOR)
            const authHeader = request.headers.get('authorization');

            if (!authHeader) {
                return NextResponse.json({ error: "Missing Authorization Header" }, { status: 401 });
            }

            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);

            if (authError || !user) {
                console.warn("⚠️ Invalid Token in Research API:", authError);
                return NextResponse.json({ error: "Invalid or Expired Session" }, { status: 401 });
            }

            effectiveUserId = user.id;

            // 🔒 TRIAL EXPIRATION CHECK (Backend Security - Cannot be bypassed via console)
            const { data: profileData } = await supabase
                .from('profiles')
                .select('plan_tier, subscription_status, trial_ends_at, verification_status')
                .eq('id', user.id)
                .single();

            if (profileData && profileData.verification_status !== 'verified') {
                console.warn(`⛔ Unverified lawyer attempted research: ${user.id}`);
                return NextResponse.json({
                    error: "VERIFICATION_REQUIRED",
                    message: "Tu cuenta está pendiente de verificación. Nuestro equipo está revisando tus credenciales.",
                    laws: "⏳ VERIFICACIÓN PENDIENTE",
                    cases: [],
                    links: []
                }, { status: 403 });
            }

            if (profileData && isTrialExpired(profileData)) {
                console.warn(`⛔ Trial expired for user ${user.id}`);
                return NextResponse.json({
                    error: "TRIAL_EXPIRED",
                    message: "Tu período de prueba ha vencido. Actualizá tu plan para continuar.",
                    laws: "⏰ PERÍODO DE PRUEBA VENCIDO",
                    cases: [],
                    links: []
                }, { status: 403 });
            }

            // SUPERUSER CHECK
            const isSuperUser = user?.email === 'gbrlescalada@gmail.com' && user?.id === '365cd259-4f1e-4004-a677-1eda06a5147e';

            // ─── ORG RESEARCH POOL CHECK ───────────────────────────────────────────
            // Si el usuario pertenece a un estudio verificado, consume del pool del org.
            // Esto reemplaza el check individual para todos los miembros del estudio.
            if (!isSuperUser) {
                const { data: profOrg } = await supabase
                    .from('profiles')
                    .select('org_id')
                    .eq('id', effectiveUserId)
                    .single();

                if (profOrg?.org_id) {
                    const { data: orgForResearch } = await supabase
                        .from('organizations')
                        .select('type, verification_status, research_credits_pool')
                        .eq('id', profOrg.org_id)
                        .maybeSingle();

                    if (orgForResearch?.type === 'estudio' && orgForResearch?.verification_status === 'verified') {
                        useOrgResearchPool = true;
                        orgIdForResearch = profOrg.org_id;

                        if ((orgForResearch.research_credits_pool ?? 0) <= 0) {
                            return NextResponse.json({
                                error: 'SIN_CREDITOS_ESTUDIO',
                                laws: '⚠️ SIN CRÉDITOS DE INVESTIGACIÓN',
                                cases: 'El estudio no tiene créditos de investigación disponibles. El titular debe adquirir un pack desde el Panel del Estudio → Créditos.',
                                links: []
                            }, { status: 402 });
                        }
                    }
                }
            }
            // ───────────────────────────────────────────────────────────────────────

            if (!isSuperUser && !useOrgResearchPool) {
                // Verify access and quota using centralized middleware
                // 🔒 Research reports have their own quota (tied to Brave API cost)
                const accessCheck = await verifyAccess(effectiveUserId, 'advanced_research', 'research_reports');

                if (!accessCheck.allowed) {
                    console.warn(`⚠️ Access denied for user ${effectiveUserId}:`, accessCheck.reason);

                    if (accessCheck.reason === 'QUOTA_EXCEEDED') {
                        return NextResponse.json({
                            laws: "⚠️ BÚSQUEDAS AGOTADAS",
                            cases: "Alcanzaste el límite de búsquedas del mes. Actualizá tu plan para continuar.",
                            links: []
                        }, { status: 402 });
                    } else if (accessCheck.reason === 'FEATURE_NOT_AVAILABLE') {
                        return NextResponse.json({
                            laws: "⚠️ FUNCIÓN NO DISPONIBLE",
                            cases: "Esta función requiere un plan Professional. Actualiza tu plan.",
                            links: []
                        }, { status: 402 });
                    }
                }

                // Consumir del pool correcto: mensual primero, extra después (atómico)
                const supabaseService = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL,
                    process.env.SUPABASE_SERVICE_ROLE_KEY
                );
                const planLimit = getPlanLimit(accessCheck.profile?.plan_tier || 'free', 'research_reports');
                await supabaseService.rpc('consume_research_report', {
                    p_user_id: effectiveUserId,
                    p_plan_limit: planLimit
                });
            }
        }

        // Override potentially spoofed userId with validated one (or null if demo)
        const secureUserId = effectiveUserId;

        // --- STAGE 0.5: GET USER ORG (For Private Library) ---
        let userOrgId = null;
        if (secureUserId) {
            const { data: orgMember } = await supabase.from('org_members').select('org_id').eq('user_id', secureUserId).single();
            if (orgMember) userOrgId = orgMember.org_id;
        }

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://openrouter.ai/api/v1",
            defaultHeaders: { "HTTP-Referer": "https://judic-ia.com", "X-Title": "Judic-IA" }
        });

        // --- STAGE 0.5: QUERY OPTIMIZER (Para Abogados) ---
        // Analiza la consulta profesional y extrae conceptos legales implícitos
        // console.log(`🔬 Analyzing query: "${query}"`);

        const queryAnalysis = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [{
                role: "system",
                content: `Sos un asistente de búsqueda jurídica para abogados litigantes argentinos.

Analizá la consulta profesional y devolvé JSON:
{
  "intent": "fallos" | "doctrina" | "legislacion" | "mixto",
  "cleanQuery": "versión limpia y optimizada de la consulta",
  "legalConcepts": ["concepto jurídico 1", "concepto 2"], 
  "relatedTerms": ["sinónimo1", "término relacionado"],
  "suggestedQueries": ["query búsqueda 1", "query 2", "query 3"]
}

EJEMPLOS:
- "MEDIANERIA CASA PARTICULAR FALLO" → { "intent": "fallos", "cleanQuery": "medianería inmueble particular", "legalConcepts": ["pared medianera", "condominio de muros", "art 2006 CCCN"], "relatedTerms": ["lindero", "cerramiento forzoso"], "suggestedQueries": ["medianería fallo cámara civil", "pared medianera sentencia", "condominio muro divisorio jurisprudencia"] }

- "juicio de alimentos Fallos" → { "intent": "fallos", "cleanQuery": "alimentos jurisprudencia", "legalConcepts": ["obligación alimentaria", "cuota alimentaria", "art 658 CCCN"], "relatedTerms": ["prestación alimentaria", "deber alimentario"], "suggestedQueries": ["cuota alimentaria fallo", "alimentos hijo menor jurisprudencia", "obligación alimentaria cámara"] }

- "despido embarazada" → { "intent": "fallos", "cleanQuery": "despido discriminatorio embarazo", "legalConcepts": ["estabilidad laboral", "despido discriminatorio", "art 178 LCT"], "relatedTerms": ["maternidad", "protección especial"], "suggestedQueries": ["despido embarazo indemnización agravada", "estabilidad maternidad fallo", "discriminación embarazada sentencia laboral"] }

REGLAS:
- NO incluyas operadores de búsqueda (site:, filetype:, intitle:) en suggestedQueries
- Mantené queries cortas (3-5 palabras máximo)
- Extraé artículos de ley relacionados si los conocés
- Incluí sinónimos legales que un abogado usaría`
            }, {
                role: "user",
                content: query
            }],
            response_format: { type: "json_object" }
        });

        let analysis;
        try {
            analysis = JSON.parse(queryAnalysis.choices[0].message.content);
            // console.log(`✅ Query Analysis:`, analysis);
        } catch (e) {
            console.warn("⚠️ Query analysis failed, using fallback");
            analysis = {
                intent: "mixto",
                cleanQuery: query,
                legalConcepts: [],
                relatedTerms: [],
                suggestedQueries: [query]
            };
        }

        // --- STAGE 1: SMART DORK GENERATION ---
        const jurisdictionSites = jurisdiction?.toLowerCase().includes('buenos aires')
            ? ['scba.gov.ar', 'juba.scba.gov.ar']
            : jurisdiction?.toLowerCase().includes('córdoba') || jurisdiction?.toLowerCase().includes('cordoba')
                ? ['justiciacordoba.gob.ar', 'tsjcordoba.gob.ar']
                : jurisdiction?.toLowerCase().includes('federal') || jurisdiction?.toLowerCase().includes('nacional')
                    ? ['csjn.gov.ar', 'pjn.gov.ar', 'saij.gob.ar']
                    : ['pjn.gov.ar', 'saij.gob.ar', 'csjn.gov.ar'];

        const dorkCompletion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [{
                role: "system",
                content: `Generá un objeto JSON { "queries": [string] } con 12 búsquedas jurídicas optimizadas.

CONTEXTO DE LA CONSULTA:
- Query original: "${query}"
- Query limpia: "${analysis.cleanQuery}"
- Intención: ${analysis.intent}
- Conceptos legales: ${analysis.legalConcepts.join(', ') || 'ninguno detectado'}
- Términos relacionados: ${analysis.relatedTerms.join(', ') || 'ninguno'}
- Jurisdicción: ${jurisdiction || 'Nacional'}
- Dominios prioritarios: ${jurisdictionSites.join(', ')}

🎯 ESTRATEGIA DE BÚSQUEDA:

${analysis.intent === 'fallos' ? `
MODO JURISPRUDENCIA:
- 4 queries con site: de los dominios prioritarios + términos de la consulta
- 3 queries con "fallo" o "sentencia" + conceptos legales
- 3 queries con formato "c/ s/" (autos)
- 2 queries simples con términos relacionados
` : analysis.intent === 'legislacion' ? `
MODO LEGISLACIÓN:
- 3 queries con número de artículo + código
- 3 queries con site:infoleg.gob.ar o site:saij.gob.ar
- 3 queries con "ley" + número o tema
- 3 queries con doctrina + interpretación
` : `
MODO MIXTO:
- 3 queries con site: de dominios prioritarios
- 3 queries con "fallo" o "sentencia"
- 3 queries simples con conceptos legales
- 3 queries con términos relacionados
`}

🔒 REGLAS TÉCNICAS BRAVE API:
- site:dominio.gov.ar (SIN "OR", uno por query)
- Comillas solo para frases exactas de 2-3 palabras
- NUNCA uses "..." ni puntos suspensivos
- filetype:pdf solo si buscás PDFs específicamente
- Máximo 6 palabras por query

DEVOLVÉ SOLO EL JSON válido.`
            }],
            response_format: { type: "json_object" }
        });

        const { queries: rawQueries } = JSON.parse(dorkCompletion.choices[0].message.content);

        // Generate targeted queries for official sources (SAIJ, CSJN, PJN, etc.)
        const officialSourceQueries = generateAllSourceQueries(
            analysis.cleanQuery || query,
            analysis.legalConcepts || []
        );
        // console.log(`📍 Official source queries:`, officialSourceQueries.slice(0, 3), '...');

        // Combine: Original query + Analysis suggestions + Generated dorks + Official Sources
        const allQueries = [
            query,                                          // Original
            analysis.cleanQuery,                            // Cleaned version
            ...analysis.suggestedQueries,                   // AI-suggested variations
            ...rawQueries,                                  // Generated dorks with operators
            ...officialSourceQueries                        // NEW: Targeted official source queries
        ];

        // Dedupe and limit (optimized: 10 max to control Brave API costs ~$0.05/search)
        const queries = [...new Set(allQueries)].filter(q => q && q.length > 2).slice(0, 10);
        // console.log(`🔍 Final query pool (${queries.length}):`, queries.slice(0, 5), '...');

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
        // If cache already provided good results, reduce Brave queries to save costs
        const cachedGoldCount = searchResults.filter(r => r.fromCache && r.score >= 80).length;
        const braveQueries = cachedGoldCount >= 5
            ? queries.slice(0, 3)   // Cache hit: minimal Brave (~3 requests)
            : queries;               // Cache miss: full search (~10 requests)
        const canSearch = mode !== 'demo' && braveQueries.length > 0;

        if (braveApiKey && braveQueries.length > 0 && canSearch) {

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

                // ══════════════════════════════════════════════════
                // 🏆 TIER 2.3: ACTUAL CASE CONTENT MARKERS (+20 to +50) (NEW)
                // ══════════════════════════════════════════════════
                // Strong indicators this is an actual ruling, not an index
                if (/fallos?\s*[:.]?\s*\d{3}:\d+/i.test(text)) score += 45; // "Fallos: 340:1234" citation format
                if (/expediente\s*(n[°º]?|nro\.?|número)?\s*\d+/i.test(text)) score += 35; // "Expediente Nro 12345"
                if (text.includes('por ello') || text.includes('se resuelve:')) score += 30; // Dispositive section
                if (text.includes('el tribunal resuelve') || text.includes('se declara')) score += 25;
                if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text)) score += 15; // Has a date (dd/mm/yyyy)

                // URL patterns that indicate specific case (not index)
                if (url.includes('/fallo/') || url.includes('/documento/') || url.includes('/sentencia/')) score += 30;
                if (url.includes('id_protocolo=') || url.includes('biblionumber=') || url.includes('?id=')) score += 20;
                if (/\d{4,}\.pdf$/i.test(url)) score += 25; // PDF with case number in filename

                // PDF bonus (when from official source)
                if (url.endsWith('.pdf') && score >= 40) score += 15;

                // ══════════════════════════════════════════════════
                // 🎯 TIER 2.5: QUERY CONCEPT MATCH BONUS (+10 to +30)
                // ══════════════════════════════════════════════════
                // Boost results that contain the legal concepts we detected
                if (analysis.legalConcepts?.length > 0) {
                    const conceptMatches = analysis.legalConcepts.filter(concept =>
                        text.includes(concept.toLowerCase())
                    ).length;
                    score += conceptMatches * 15; // +15 per matched concept
                }

                // Boost for related terms match
                if (analysis.relatedTerms?.length > 0) {
                    const termMatches = analysis.relatedTerms.filter(term =>
                        text.includes(term.toLowerCase())
                    ).length;
                    score += termMatches * 8; // +8 per matched related term
                }

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

                // ══════════════════════════════════════════════════
                // 🚫 TIER 3.5: CATALOG/INDEX PENALTIES (NEW)
                // ══════════════════════════════════════════════════
                // Library catalog systems (NOT actual fallos, just metadata)
                if (url.includes('/koha/') || url.includes('opac-') || url.includes('biblioteca.') || url.includes('/cgi-bin/')) {
                    score -= 60; // Library catalog, not the actual ruling
                }

                // Index/Collection pages (list of tomos, not specific cases)
                const textLower = text.toLowerCase();
                if (textLower.includes('tomos de fallos') || textLower.includes('tomo de fallos') ||
                    textLower.includes('colección de fallos') || textLower.includes('coleccion fallos') ||
                    textLower.includes('índice de') || textLower.includes('indice de') ||
                    textLower.includes('acceso a fallos completos') || textLower.includes('acceso a los tomos') ||
                    textLower.includes('fallos completos -') || // "Tomos de Fallos completos - CSJN"
                    (textLower.includes('secretaría') && textLower.includes('jurisprudencia') && !textLower.includes('c/'))) {
                    score -= 70; // Index page, not actual case content
                }

                // Generic landing pages
                if (url.includes('/jurisprudencia') && !url.includes('?') && !url.includes('id=')) {
                    score -= 40; // Probably a landing page, not a specific case
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

                // ══════════════════════════════════════════════════
                // 🚫 TIER 4: TERM CONFUSION PENALTIES (Critical)
                // ══════════════════════════════════════════════════
                // Penalize results with similar-sounding but DIFFERENT legal terms
                const queryLower = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                // Medianería vs Mediación confusion (VERY common)
                if (queryLower.includes('medianeria') || queryLower.includes('muro medianero') || queryLower.includes('pared medianera')) {
                    if (textLower.includes('mediacion') && !textLower.includes('medianeria') && !textLower.includes('muro') && !textLower.includes('pared')) {
                        score -= 80; // Wrong topic entirely
                    }
                    if (textLower.includes('ley 26.589') || textLower.includes('ley de mediacion')) {
                        score -= 90; // Definitely about mediation law, not party walls
                    }
                }

                // Alimentos (child support) vs Alimentación (food/nutrition) confusion
                if (queryLower.includes('alimento') && queryLower.includes('cuota')) {
                    if (textLower.includes('alimenticio') && !textLower.includes('cuota') && !textLower.includes('obligacion')) {
                        score -= 60;
                    }
                }

                // Generic irrelevant results (decomiso, secuestro when searching civil matters)
                if (!queryLower.includes('penal') && !queryLower.includes('decomiso') && !queryLower.includes('secuestro')) {
                    if (textLower.includes('decomisados') || textLower.includes('bienes secuestrados') || textLower.includes('causas penales')) {
                        score -= 50;
                    }
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
            const braveResults = await Promise.all(braveQueries.map(async (q) => {
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
                    // console.log(`✅ Brave 200 | Query: ${sanitizedQuery} | Results: ${results.length}`);

                    return results.map(r => {
                        // Sanitize concatenated URLs (e.g. "page.htmlhttp://...")
                        let cleanUrl = r.url;
                        const secondProto = cleanUrl.indexOf('http', 8);
                        if (secondProto > 0) {
                            try {
                                const secondUrl = cleanUrl.substring(secondProto);
                                const parsed = new URL(secondUrl);
                                if (parsed.hostname.length > 3) cleanUrl = secondUrl;
                                else {
                                    const firstUrl = new URL(cleanUrl.substring(0, secondProto));
                                    const pathMatch = secondUrl.match(/https?:\/\/[^/]*(\/.*)/);
                                    if (pathMatch) cleanUrl = firstUrl.origin + pathMatch[1];
                                }
                            } catch { /* keep original */ }
                        }
                        return {
                            title: r.title,
                            link: cleanUrl,
                            snippet: r.description || r.extra_snippets?.join(' ') || '',
                            source: new URL(cleanUrl).hostname.replace(/^www\./, ""),
                            score: 0
                        };
                    });
                } catch (e) {
                    console.error("Brave fetch error:", e);
                    return [];
                }
            })).then(res => res.flat());

            // Score, filter, dedupe, and sort
            const seenUrls = new Set(searchResults.map(r => r.link));
            const scoredResults = braveResults.map(r => {
                r.score = calculateLegalScore(r);

                // Apply source validation bonus/penalty
                const source = identifySource(r.link);
                if (source) {
                    // Check if it's a valid case URL (not a landing page)
                    const isValid = isValidCaseUrl(r.link);
                    if (!isValid) {
                        r.score -= 40; // Penalize landing pages from official sources
                        r._isLandingPage = true;
                    } else {
                        r._isValidCase = true;
                    }
                }

                return r;
            });

            // Log score distribution for debugging
            const scoreDistribution = {
                'gold (>80)': scoredResults.filter(r => r.score >= 80).length,
                'good (50-79)': scoredResults.filter(r => r.score >= 50 && r.score < 80).length,
                'acceptable (35-49)': scoredResults.filter(r => r.score >= 35 && r.score < 50).length,
                'rejected (<35)': scoredResults.filter(r => r.score < 35).length,
                'landing_pages': scoredResults.filter(r => r._isLandingPage).length,
                'valid_cases': scoredResults.filter(r => r._isValidCase).length
            };
            // console.log('📊 Score distribution:', scoreDistribution);

            scoredResults
                .filter(r => r.score >= 35 && !r._isLandingPage) // Filter out landing pages
                .sort((a, b) => b.score - a.score)
                .forEach(r => {
                    if (r && !seenUrls.has(r.link) && seenUrls.size < 25) { // Reduced max from 35 to 25 (quality over quantity)
                        seenUrls.add(r.link);
                        searchResults.push(r);
                    }
                });

            // console.log(`🔍 Brave Search Round 1: ${braveResults.length} raw → ${searchResults.filter(r => !r.fromCache).length} filtered (${searchResults.filter(r => r.fromCache).length} from cache)`);

            // ══════════════════════════════════════════════════
            // 🔁 DEEP DIVE MODE: Second round if few gold results
            // ══════════════════════════════════════════════════
            const goldResults = searchResults.filter(r => r.score >= 80);
            if (goldResults.length === 0 && searchResults.length > 0) {
                // console.log(`🔁 Deep Dive Mode: Only ${goldResults.length} gold results, starting round 2...`);

                // Extract patterns from best results to generate more specific queries
                const topResults = searchResults.slice(0, 5);
                const extractedTerms = topResults
                    .map(r => {
                        const text = (r.title + ' ' + (r.snippet || '')).toLowerCase();
                        // Extract case patterns like "c/ ... s/"
                        const caseMatch = text.match(/(\w+)\s*c\/\s*(\w+)\s*s\//);
                        if (caseMatch) return `"${caseMatch[0]}"`;
                        // Extract legal terms
                        const terms = text.match(/(art(?:ículo)?\.?\s*\d+|ley\s*\d+|fallos?\s*\d+:\d+)/gi);
                        return terms ? terms[0] : null;
                    })
                    .filter(Boolean)
                    .slice(0, 3);

                if (extractedTerms.length > 0) {
                    // Generate refined queries
                    const refineQueries = [
                        ...extractedTerms.map(t => `${t} site:pjn.gov.ar`),
                        `${analysis.cleanQuery} "visto y considerando"`
                    ].slice(0, 3);

                    // console.log(`🔍 Deep Dive queries:`, refineQueries);

                    // Execute round 2
                    const round2Results = await Promise.all(refineQueries.map(async (q) => {
                        try {
                            const sanitizedQuery = sanitizeQueryForBrave(q);
                            const params = new URLSearchParams({
                                q: sanitizedQuery,
                                count: '10',
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
                            if (!res.ok) return [];
                            const data = await res.json();
                            return (data.web?.results || []).map(r => {
                                let cleanUrl = r.url;
                                const sp = cleanUrl.indexOf('http', 8);
                                if (sp > 0) {
                                    try {
                                        const su = cleanUrl.substring(sp);
                                        const p = new URL(su);
                                        if (p.hostname.length > 3) cleanUrl = su;
                                        else {
                                            const fu = new URL(cleanUrl.substring(0, sp));
                                            const pm = su.match(/https?:\/\/[^/]*(\/.*)/);
                                            if (pm) cleanUrl = fu.origin + pm[1];
                                        }
                                    } catch { /* keep original */ }
                                }
                                return {
                                    title: r.title,
                                    link: cleanUrl,
                                    snippet: r.description || r.extra_snippets?.join(' ') || '',
                                    source: new URL(cleanUrl).hostname.replace(/^www\./, ""),
                                    score: 0
                                };
                            });
                        } catch (e) {
                            return [];
                        }
                    })).then(res => res.flat());

                    // Score and add round 2 results
                    let addedRound2 = 0;
                    round2Results
                        .map(r => { r.score = calculateLegalScore(r); return r; })
                        .filter(r => r.score >= 50) // Higher threshold for round 2
                        .sort((a, b) => b.score - a.score)
                        .forEach(r => {
                            if (r && !seenUrls.has(r.link) && addedRound2 < 10) {
                                seenUrls.add(r.link);
                                searchResults.push(r);
                                addedRound2++;
                            }
                        });

                    // console.log(`🔁 Deep Dive Round 2: Added ${addedRound2} more results`);
                }
            }
        }

        // ══════════════════════════════════════════════════
        // 🎯 STAGE 2.5: CLICK POPULARITY BONUS
        // ══════════════════════════════════════════════════
        if (searchResults.length > 0) {
            try {
                const resultUrls = searchResults.map(r => r.link);
                const { data: clickData } = await supabase
                    .from('research_clicks')
                    .select('case_url')
                    .in('case_url', resultUrls);

                if (clickData && clickData.length > 0) {
                    // Count clicks per URL
                    const clickCounts = {};
                    clickData.forEach(c => {
                        clickCounts[c.case_url] = (clickCounts[c.case_url] || 0) + 1;
                    });

                    searchResults.forEach(r => {
                        const clicks = clickCounts[r.link] || 0;
                        if (clicks > 0) {
                            // +15 per past click, capped at +45
                            const clickBonus = Math.min(clicks * 15, 45);
                            r.score += clickBonus;
                            r._clickBonus = clickBonus;
                        }
                    });

                    // Re-sort after click bonus
                    searchResults.sort((a, b) => b.score - a.score);
                }
            } catch (clickErr) {
                // Non-critical: click tracking table might not exist yet
                console.warn('⚠️ Click bonus skipped:', clickErr.message);
            }
        }

        // ══════════════════════════════════════════════════
        // 🧠 STAGE 2.7: SEMANTIC RE-RANKING (Embeddings)
        // ══════════════════════════════════════════════════
        if (searchResults.length > 0 && apiKey) {
            try {
                await semanticRerank(query, searchResults, apiKey);
            } catch (embedErr) {
                // Non-critical: falls back to keyword-only scoring
                console.warn('⚠️ Semantic re-ranking skipped:', embedErr.message);
            }
        }

        // --- STAGE 3: STRATEGIC SYNTHESIS (Enhanced Prompt) ---
        const isDemo = mode === 'demo';
        const hasRealResults = searchResults.length > 0;

        // Build enriched context with query analysis
        const analysisContext = `
ANÁLISIS DE LA CONSULTA:
- Intención detectada: ${analysis.intent}
- Conceptos legales clave: ${analysis.legalConcepts?.join(', ') || 'No detectados'}
- Términos relacionados: ${analysis.relatedTerms?.join(', ') || 'No detectados'}
`;

        const contextText = hasRealResults
            ? `${analysisContext}\nFALLOS Y FUENTES VERIFICADAS (${searchResults.length} resultados):\n${searchResults.slice(0, 20).map(r => `- [SCORE: ${r.score}] [${r.source.toUpperCase()}] ${r.title}\n  URL: ${r.link}\n  Snippet: ${r.snippet}`).join('\n\n')}`
            : `${analysisContext}\n⚠️ ALERTA: LA BÚSQUEDA NO DEVOLVIÓ RESULTADOS VERIFICABLES.\n\nINSTRUCCIONES CRÍTICAS:\n- NO INVENTES URLs bajo ningún concepto.\n- Para 'cases': dejá el array VACÍO [] o usá source: "Doctrina General" SIN url.\n- Compensá con análisis normativo y estratégico más profundo.\n- Podés mencionar leading cases conocidos (ej: "Aquino", "Vizzoti") pero SIN inventar URLs.`;

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

⛔⛔⛔ PROHIBICIÓN ABSOLUTA ⛔⛔⛔
- NO INVENTES nombres de partes (Pérez, García, etc.)
- NO INVENTES tribunales o fechas
- NO INVENTES URLs bajo NINGÚN concepto
- SOLO usá información TEXTUAL del contexto proporcionado

1. REGLA DE ORO - SOLO CONTEXTO:
   - Cada case DEBE tener un 'url' EXACTO del contexto proporcionado
   - Si el contexto dice: "URL: https://fallos.gov.ar/123" → usá ESA url exacta
   - Si NO hay URL en el contexto para un tema → NO incluyas ese case
   - Preferí 2 cases REALES a 10 inventados

2. FORMATO DE TITLE:
   - USA EL TÍTULO EXACTO del contexto, ej: "[SCORE: 95] [SAIJ.GOB.AR] Muro medianero..."
   - Transformalo a formato legal: "Autos: [nombre exacto del snippet]"
   - Si no hay nombre de partes en el snippet, usá el título tal cual

3. SUMMARY (Ratio Decidendi):
   - Extraé la doctrina del SNIPPET proporcionado
   - Entre 60-100 palabras
   - Incluí citas textuales si el snippet las tiene

4. VERIFICACIÓN:
   - Antes de agregar un case, verificá que su URL exista en el contexto
   - Si no podés verificar la URL → no lo incluyas

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

- SI HAY RESULTADOS EN EL CONTEXTO: Devolvé entre 3 y 8 casos CON URLs verificables.
- SI NO HAY RESULTADOS: Devolvé "cases": [] (array vacío) y compensá con análisis normativo más profundo.
- ESTILO: Formal, imperativo, jurídico-técnico. SIN Markdown (**, ##, etc.).
- SOLO JSON válido, sin texto antes ni después.
- ⛔ NUNCA inventes URLs que no estén en el contexto.

{
  "laws": "Análisis normativo exhaustivo con interpretación jurisprudencial...",
  "cases": [
    { 
      "title": "Autos: [Título EXACTO del contexto]", 
      "summary": "Ratio decidendi extendida de 60-100 palabras...", 
      "url": "URL EXACTA del contexto - OBLIGATORIO", 
      "source": "PJN / SCBA / SAIJ / CSJN" 
    }
  ],
  "strategy": "Estrategia integral tripartita...",
  "calculation": "Parámetros técnicos de liquidación...",
  "evidence": "Plan probatorio detallado...",
  "links": []
}`
                },
                { role: "user", content: `CONSULTA LEGAL: "${query}"\nJURISDICCIÓN: ${jurisdiction || 'Nacional'} \n\n${contextText} ` }
            ],
            response_format: { type: "json_object" },
            max_tokens: 10000
        });

        const result = JSON.parse(finalCompletion.choices[0].message.content);

        // --- INJECT BRAVE SCORES INTO SYNTHESIZED CASES ---
        if (Array.isArray(result.cases)) {
            result.cases = result.cases.map(c => {
                if (c.url) {
                    // Try exact match first, then fuzzy match (safe URL parsing)
                    const match = searchResults.find(r => {
                        if (r.link === c.url) return true;
                        try {
                            return c.url.includes(new URL(r.link).pathname) ||
                                r.link.includes(new URL(c.url).pathname);
                        } catch {
                            // Fallback: simple string includes for malformed URLs
                            return c.url.includes(r.link) || r.link.includes(c.url);
                        }
                    });
                    if (match) {
                        c.score = match.score;
                    }
                }
                // No match = AI-generated reference without Brave backing
                if (c.score === undefined) c.score = 0;
                return c;
            });
        }

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
        if (secureUserId) {
            try {
                const { data: savedReport } = await supabase.from('research_reports').insert({
                    user_id: secureUserId,
                    query,
                    jurisdiction: jurisdiction || 'Nacional',
                    result_json: result
                }).select('id, created_at').single();

                if (savedReport) {
                    result.report_meta = savedReport;
                }

                // Consumir crédito del pool del estudio (si aplica)
                if (useOrgResearchPool && orgIdForResearch) {
                    await supabase.rpc('consume_org_research_credit', { p_org_id: orgIdForResearch });
                    await supabase.from('org_research_credit_usage').insert({
                        org_id: orgIdForResearch,
                        used_by: secureUserId,
                        query,
                    });
                }

                // Persist only GOLD STANDARD results (score >= 60)
                const persistedResults = [];
                for (const r of searchResults) {
                    if (r.score >= 60 && !r.fromCache) {
                        await supabase.from('case_library').upsert({
                            url: r.link,
                            autos: r.title,
                            summary: r.snippet,
                            jurisdiction: jurisdiction || 'Nacional',
                            last_score: r.score || null
                        }, { onConflict: 'url' });

                        persistedResults.push(r);
                    }
                }

                // 📸 Fire-and-forget: Capture PDFs on VPS for all persisted results
                if (persistedResults.length > 0) {
                    const CAPTURE_URL = process.env.CAPTURE_SERVICE_URL || 'https://archivos.judic-ia.com';
                    const CAPTURE_KEY = process.env.CAPTURE_API_KEY;

                    // Don't await — run in background so user gets response immediately
                    Promise.allSettled(
                        persistedResults.map(async (r) => {
                            try {
                                const captureRes = await fetch(`${CAPTURE_URL}/capture`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'x-api-key': CAPTURE_KEY },
                                    body: JSON.stringify({ url: r.link, title: r.title }),
                                    signal: AbortSignal.timeout(120000),
                                });
                                const data = await captureRes.json();
                                if (data.success && data.url) {
                                    await supabase.from('case_library')
                                        .update({ pdf_url: data.url })
                                        .eq('url', r.link);
                                    console.log(`📄 PDF captured: ${r.title?.substring(0, 40)} → ${data.url}`);
                                }
                            } catch (err) {
                                console.error(`❌ PDF capture failed for ${r.link}:`, err.message);
                            }
                        })
                    ).catch(() => { }); // Swallow — fire-and-forget
                }
            } catch (dbErr) {
                console.error("Database persistence error:", dbErr);
            }
        }

        result.brave_used = !!braveApiKey && braveQueries.length > 0 && canSearch;
        result._debug = {
            total_results: searchResults.length,
            from_cache: searchResults.filter(r => r.fromCache).length,
            high_score: searchResults.filter(r => r.score >= 60).length,
            avg_score: searchResults.length > 0
                ? Math.round(searchResults.reduce((s, r) => s + r.score, 0) / searchResults.length)
                : 0
        };

        // Return verified balance so the client always shows server-confirmed credits
        try {
            if (useOrgResearchPool && orgIdForResearch) {
                const { data: orgAfter } = await supabase
                    .from('organizations').select('research_credits_pool').eq('id', orgIdForResearch).single();
                result.credits_left = orgAfter?.research_credits_pool ?? 0;
                result.credits_source = 'org';
            } else if (!isSuperUser && secureUserId) {
                const { data: profAfter } = await supabase
                    .from('profiles').select('research_reports_extra, research_reports_used').eq('id', secureUserId).single();
                result.credits_left = profAfter?.research_reports_extra ?? 0;
                result.credits_source = 'individual';
            }
        } catch { /* non-blocking */ }

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
