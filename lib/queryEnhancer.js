/**
 * QUERY ENHANCER MODULE
 * Analyzes and improves legal search queries to maximize result quality
 * Reduces dependency on user's search formulation skills
 */

import OpenAI from 'openai';

// Quality thresholds
const QUALITY_THRESHOLDS = {
    EXCELLENT: 80,
    GOOD: 60,
    ACCEPTABLE: 40,
    POOR: 20
};

// Legal terms patterns that indicate a well-formed query
const LEGAL_PATTERNS = {
    articles: /art(?:ículo)?\.?\s*\d+/i,
    laws: /ley\s*\d+/i,
    caseFormat: /c\/.*s\//i,
    legalTerms: /\b(sentencia|fallo|jurisprudencia|autos|expediente|resolución|doctrina)\b/i,
    specificConcepts: /\b(indemnización|liquidación|daño|prescripción|medida|cautelar|amparo|habeas|inconstitucionalidad)\b/i,
    procedural: /\b(apelación|recurso|casación|queja|incidente|excepción)\b/i
};

// Red flags that indicate too generic or problematic queries
const RED_FLAGS = {
    tooShort: (query) => query.trim().split(/\s+/).length < 2,
    tooGeneric: (query) => /^(despido|divorcio|alimentos|sucesión|daños|penal|civil|laboral)$/i.test(query.trim()),
    chatGptStyle: (query) => /^(como|cómo|qué|cuál|cuales|explicame|decime|ayudame|necesito|quiero|busco)/i.test(query.trim()),
    noLegalContext: (query) => {
        const hasLegalTerm = Object.values(LEGAL_PATTERNS).some(pattern => pattern.test(query));
        return !hasLegalTerm && query.split(/\s+/).length < 4;
    }
};

/**
 * Analyze query quality and return score with reasoning
 */
export function analyzeQueryQuality(query) {
    if (!query || query.trim().length < 2) {
        return {
            score: 0,
            level: 'INVALID',
            issues: ['Query vacía o demasiado corta'],
            suggestions: []
        };
    }

    let score = 30; // Base score (reduced from 50 to be more strict)
    const issues = [];
    const strengths = [];

    // Check for red flags
    if (RED_FLAGS.tooShort(query)) {
        score -= 30;
        issues.push('Búsqueda muy corta (menos de 2 palabras)');
    }

    if (RED_FLAGS.tooGeneric(query)) {
        score -= 25;
        issues.push('Término demasiado genérico (ej: solo "despido")');
    }

    if (RED_FLAGS.chatGptStyle(query)) {
        score -= 20;
        issues.push('Formato de pregunta conversacional (esta es una búsqueda legal, no un chat)');
    }

    if (RED_FLAGS.noLegalContext(query)) {
        score -= 20; // Increased penalty from 15 to 20
        issues.push('Falta contexto legal específico (artículos, leyes, términos técnicos)');
    }

    // Check for positive patterns
    if (LEGAL_PATTERNS.articles.test(query)) {
        score += 15;
        strengths.push('Incluye artículo legal específico');
    }

    if (LEGAL_PATTERNS.laws.test(query)) {
        score += 15;
        strengths.push('Referencia a ley específica');
    }

    if (LEGAL_PATTERNS.caseFormat.test(query)) {
        score += 20;
        strengths.push('Formato de autos (c/ ... s/)');
    }

    if (LEGAL_PATTERNS.legalTerms.test(query)) {
        score += 10;
        strengths.push('Incluye terminología legal');
    }

    if (LEGAL_PATTERNS.specificConcepts.test(query)) {
        score += 10;
        strengths.push('Conceptos jurídicos específicos');
    }

    if (LEGAL_PATTERNS.procedural.test(query)) {
        score += 10;
        strengths.push('Términos procesales');
    }

    // Word count bonus (sweet spot is 4-8 words)
    const wordCount = query.trim().split(/\s+/).length;
    if (wordCount >= 4 && wordCount <= 8) {
        score += 10;
        strengths.push('Longitud óptima');
    } else if (wordCount > 10) {
        score -= 5;
        issues.push('Query demasiado larga (puede diluir resultados)');
    }

    // Normalize score to 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine level
    let level;
    if (score >= QUALITY_THRESHOLDS.EXCELLENT) level = 'EXCELLENT';
    else if (score >= QUALITY_THRESHOLDS.GOOD) level = 'GOOD';
    else if (score >= QUALITY_THRESHOLDS.ACCEPTABLE) level = 'ACCEPTABLE';
    else level = 'POOR';

    return {
        score,
        level,
        issues,
        strengths,
        shouldEnhance: score < QUALITY_THRESHOLDS.GOOD
    };
}

/**
 * Enhance a query using AI to add legal context
 */
export async function enhanceQuery(originalQuery, jurisdiction = 'Nacional') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.warn('⚠️ OpenRouter API key not found, skipping enhancement');
        return {
            enhanced: originalQuery,
            confidence: 0,
            changes: []
        };
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: { "HTTP-Referer": "https://judic-ia.com", "X-Title": "Judic-IA" }
    });

    try {
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [{
                role: "system",
                content: `Sos un asistente experto en búsqueda de jurisprudencia argentina.

TU MISIÓN: Transformar búsquedas genéricas en búsquedas legales precisas.

REGLAS:
1. NO cambies el tema de la búsqueda original
2. AGREGÁ contexto legal relevante (artículos, leyes, términos técnicos)
3. Mantené la búsqueda entre 5-10 palabras
4. NO uses operadores de búsqueda (site:, filetype:, etc.)
5. Priorizá: conceptos legales > artículos > términos procesales

EJEMPLOS:
❌ "despido" → ✅ "despido sin causa art 245 LCT indemnización"
❌ "divorcio con hijos" → ✅ "divorcio vincular hijos menores cuota alimentaria"
❌ "accidente auto" → ✅ "accidente tránsito daño moral art 1741 CCCN"
❌ "como hacer una demanda" → ✅ "requisitos demanda art 330 CPCCN escrito inicio"
❌ "medianeria casa" → ✅ "medianería muro divisorio art 2006 CCCN cerramiento"

CONTEXTO:
- Jurisdicción: ${jurisdiction}
- Query original: "${originalQuery}"

Devolvé JSON:
{
  "enhanced": "query mejorada (string, NO array)",
  "confidence": 0-100,
  "changes": ["cambio 1", "cambio 2"],
  "reasoning": "por qué hiciste estos cambios"
}`
            }],
            response_format: { type: "json_object" },
            temperature: 0.3
        });

        const result = JSON.parse(completion.choices[0].message.content);

        // Validate that enhanced query is not too different from original
        const originalWords = new Set(originalQuery.toLowerCase().split(/\s+/));
        const enhancedWords = result.enhanced.toLowerCase().split(/\s+/);
        const preservedWords = enhancedWords.filter(w => originalWords.has(w)).length;
        const preservationRatio = preservedWords / originalWords.size;

        if (preservationRatio < 0.3) {
            console.warn('⚠️ Enhanced query too different from original, keeping original');
            return {
                enhanced: originalQuery,
                confidence: 0,
                changes: ['Enhancement rejected: too different from original']
            };
        }

        return {
            enhanced: result.enhanced,
            confidence: result.confidence || 70,
            changes: result.changes || [],
            reasoning: result.reasoning || ''
        };

    } catch (error) {
        console.error('❌ Query enhancement failed:', error);
        return {
            enhanced: originalQuery,
            confidence: 0,
            changes: ['Enhancement failed: ' + error.message]
        };
    }
}

/**
 * Analyze search results quality
 */
export function analyzeResultsQuality(results) {
    if (!results || !Array.isArray(results.cases)) {
        return {
            quality: 'UNKNOWN',
            avgScore: 0,
            shouldReformulate: true
        };
    }

    // Calculate average score from cases
    const scores = results.cases
        .map(c => c.score || 0)
        .filter(s => s > 0);

    if (scores.length === 0) {
        return {
            quality: 'POOR',
            avgScore: 0,
            shouldReformulate: true,
            issues: ['No se encontraron casos con score verificable']
        };
    }

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const highQualityCases = scores.filter(s => s >= 60).length;

    let quality;
    if (avgScore >= 70 && highQualityCases >= 3) quality = 'EXCELLENT';
    else if (avgScore >= 50 && highQualityCases >= 2) quality = 'GOOD';
    else if (avgScore >= 35) quality = 'ACCEPTABLE';
    else quality = 'POOR';

    return {
        quality,
        avgScore: Math.round(avgScore),
        totalCases: results.cases.length,
        highQualityCases,
        shouldReformulate: quality === 'POOR' || (quality === 'ACCEPTABLE' && highQualityCases < 2)
    };
}

/**
 * Generate alternative search suggestions based on failed query
 */
export async function generateAlternatives(originalQuery, jurisdiction = 'Nacional') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return [];

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: { "HTTP-Referer": "https://judic-ia.com", "X-Title": "Judic-IA" }
    });

    try {
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [{
                role: "system",
                content: `Generá 3 búsquedas alternativas para mejorar resultados de jurisprudencia.

Query original: "${originalQuery}"
Jurisdicción: ${jurisdiction}

ESTRATEGIAS:
1. Versión con sinónimos legales
2. Versión más específica (con artículos/leyes)
3. Versión más amplia (rama del derecho + concepto general)

Devolvé JSON:
{
  "alternatives": [
    { "query": "búsqueda 1", "reason": "por qué puede ser mejor" },
    { "query": "búsqueda 2", "reason": "por qué puede ser mejor" },
    { "query": "búsqueda 3", "reason": "por qué puede ser mejor" }
  ]
}`
            }],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);
        return result.alternatives || [];

    } catch (error) {
        console.error('❌ Alternatives generation failed:', error);
        return [];
    }
}
