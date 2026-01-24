/**
 * DIRECT SOURCES MODULE
 * Generates optimized queries for official Argentine legal databases
 * and provides utility functions for source validation
 */

// Official domain priorities with specific query templates
export const OFFICIAL_SOURCES = {
    saij: {
        domain: 'saij.gob.ar',
        name: 'SAIJ',
        queryTemplates: [
            '{query} site:saij.gob.ar',
            '"{query}" jurisprudencia site:saij.gob.ar',
            '{query} fallo site:saij.gob.ar'
        ],
        urlPatterns: {
            validCase: /saij\.gob\.ar\/[a-z0-9-]+-[a-z]{2,3}\d{5,}/i, // Pattern like: /titulo-slug-sur0021224
            invalidPatterns: ['/buscador/', '/home', '/tratados']
        },
        scoreBonus: 50
    },
    pjn: {
        domain: 'pjn.gov.ar',
        name: 'PJN',
        queryTemplates: [
            '{query} site:pjn.gov.ar fallo',
            '{query} sentencia site:pjn.gov.ar',
            '"{query}" expediente site:pjn.gov.ar'
        ],
        urlPatterns: {
            validCase: /pjn\.gov\.ar.*(\?|documento|adjunto|ID=)/i,
            invalidPatterns: ['/cne/', '/secelec/', '/Publicaciones/00036']
        },
        scoreBonus: 45
    },
    csjn: {
        domain: 'csjn.gov.ar',
        name: 'CSJN',
        queryTemplates: [
            '{query} site:csjn.gov.ar fallo',
            '"{query}" corte suprema site:csjn.gov.ar',
            '{query} sentencia site:csjn.gov.ar'
        ],
        urlPatterns: {
            validCase: /csjn\.gov\.ar.*(descargar|documento|ID=|fallos)/i,
            invalidPatterns: ['/mandamientos/', '/preguntas', '/archivos/notificaciones']
        },
        scoreBonus: 55
    },
    scba: {
        domain: 'scba.gov.ar',
        name: 'SCBA',
        queryTemplates: [
            '{query} site:scba.gov.ar jurisprudencia',
            '{query} fallo site:juba.scba.gov.ar',
            '"{query}" sentencia site:scba.gov.ar'
        ],
        urlPatterns: {
            validCase: /scba\.gov\.ar.*(\?id=|_paginas|juba)/i,
            invalidPatterns: ['/estructura', '/integra', '/guias']
        },
        scoreBonus: 45
    },
    cij: {
        domain: 'cij.gov.ar',
        name: 'CIJ',
        queryTemplates: [
            '{query} site:cij.gov.ar sentencia',
            '{query} fallo site:cij.gov.ar'
        ],
        urlPatterns: {
            validCase: /cij\.gov\.ar.*(sentencia|sorteos|d\/)/i,
            invalidPatterns: []
        },
        scoreBonus: 50
    }
};

/**
 * Generate optimized queries for a specific source
 */
export function generateSourceQueries(query, sourceKey) {
    const source = OFFICIAL_SOURCES[sourceKey];
    if (!source) return [];

    return source.queryTemplates.map(template =>
        template.replace('{query}', query)
    );
}

/**
 * Generate queries for ALL official sources
 */
export function generateAllSourceQueries(query, legalConcepts = []) {
    const queries = [];

    Object.keys(OFFICIAL_SOURCES).forEach(sourceKey => {
        const source = OFFICIAL_SOURCES[sourceKey];
        // Use first template for each source
        queries.push(source.queryTemplates[0].replace('{query}', query));

        // If we have legal concepts, add them too
        if (legalConcepts.length > 0) {
            const conceptQuery = legalConcepts.slice(0, 2).join(' ');
            queries.push(source.queryTemplates[0].replace('{query}', conceptQuery));
        }
    });

    return queries;
}

/**
 * Validate if a URL is a valid case document (not a landing page)
 */
export function isValidCaseUrl(url) {
    const urlLower = url.toLowerCase();

    for (const [key, source] of Object.entries(OFFICIAL_SOURCES)) {
        if (urlLower.includes(source.domain)) {
            // Check invalid patterns first
            const hasInvalidPattern = source.urlPatterns.invalidPatterns.some(
                pattern => urlLower.includes(pattern.toLowerCase())
            );
            if (hasInvalidPattern) return false;

            // Check valid pattern
            if (source.urlPatterns.validCase) {
                return source.urlPatterns.validCase.test(url);
            }
        }
    }

    // For unknown sources, basic validation
    return url.includes('?') || url.includes('ID=') || url.endsWith('.pdf');
}

/**
 * Get source bonus for a URL
 */
export function getSourceBonus(url) {
    const urlLower = url.toLowerCase();

    for (const [key, source] of Object.entries(OFFICIAL_SOURCES)) {
        if (urlLower.includes(source.domain)) {
            return source.scoreBonus;
        }
    }

    return 0;
}

/**
 * Identify which official source a URL belongs to
 */
export function identifySource(url) {
    const urlLower = url.toLowerCase();

    for (const [key, source] of Object.entries(OFFICIAL_SOURCES)) {
        if (urlLower.includes(source.domain)) {
            return {
                key,
                name: source.name,
                domain: source.domain
            };
        }
    }

    return null;
}

/**
 * Filter results to only include valid case documents from official sources
 */
export function filterOfficialResults(results) {
    return results.filter(r => {
        const source = identifySource(r.link || r.url);
        if (!source) return true; // Keep non-official results for now

        return isValidCaseUrl(r.link || r.url);
    });
}

/**
 * Enhance results with source identification and bonuses
 */
export function enhanceWithSourceInfo(results) {
    return results.map(r => {
        const url = r.link || r.url;
        const source = identifySource(url);
        const isValidCase = isValidCaseUrl(url);
        const bonus = isValidCase ? getSourceBonus(url) : 0;

        return {
            ...r,
            _source: source?.name || 'Unknown',
            _isValidCase: isValidCase,
            _sourceBonus: bonus,
            score: (r.score || 0) + bonus
        };
    });
}
