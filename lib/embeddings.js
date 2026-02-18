/**
 * Semantic Re-ranking Module for Judic-IA Research Engine
 * 
 * Uses embeddings to compute cosine similarity between the search query
 * and each result snippet, then blends semantic score with keyword score.
 * 
 * Falls back gracefully if the embedding API is unavailable.
 */

import OpenAI from 'openai';

// Cosine similarity between two vectors
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Generate embeddings for an array of texts using OpenRouter.
 * 
 * @param {string[]} texts - Array of texts to embed
 * @param {string} apiKey - OpenRouter API key
 * @returns {number[][]} Array of embedding vectors
 */
async function getEmbeddings(texts, apiKey) {
    const openai = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
            'HTTP-Referer': 'https://judic-ia.com',
            'X-Title': 'Judic-IA'
        }
    });

    const response = await openai.embeddings.create({
        model: 'openai/text-embedding-3-small',
        input: texts.slice(0, 30), // Limit to avoid token overflow
    });

    return response.data.map(d => d.embedding);
}

/**
 * Semantic re-rank: compute cosine similarity between query and each result,
 * then blend into the existing keyword score.
 * 
 * @param {string} query - The search query
 * @param {Object[]} results - Search results with `score`, `title`, `snippet`
 * @param {string} apiKey - OpenRouter API key
 * @param {Object} [options]
 * @param {number} [options.keywordWeight=0.7] - Weight for existing keyword score
 * @param {number} [options.semanticWeight=0.3] - Weight for semantic similarity
 * @param {number} [options.semanticBoost=80] - Max points from semantic similarity
 * @returns {Object[]} Results with updated scores (sorted by new score descending)
 */
export async function semanticRerank(query, results, apiKey, options = {}) {
    const {
        keywordWeight = 0.7,
        semanticWeight = 0.3,
        semanticBoost = 80
    } = options;

    if (!results || results.length === 0) return results;

    try {
        // Build texts: [query, snippet1, snippet2, ...]
        const snippets = results.map(r =>
            `${r.title || ''} ${r.snippet || ''}`.substring(0, 500) // Trim to control token usage
        );
        const texts = [query, ...snippets];

        const embeddings = await getEmbeddings(texts, apiKey);
        const queryEmbedding = embeddings[0];

        // Compute semantic score for each result
        results.forEach((r, i) => {
            const resultEmbedding = embeddings[i + 1];
            if (resultEmbedding) {
                const similarity = cosineSimilarity(queryEmbedding, resultEmbedding);
                const semanticScore = Math.round(similarity * semanticBoost);

                // Blend: keep original score dominant, add semantic bonus
                r._semanticScore = semanticScore;
                r._originalScore = r.score;
                r.score = Math.round(
                    (r.score * keywordWeight) + (semanticScore * (semanticWeight / (semanticBoost / 100)))
                );
            }
        });

        // Re-sort by blended score
        results.sort((a, b) => b.score - a.score);

        console.log(`🧠 Semantic re-rank applied: top score ${results[0]?.score} (was ${results[0]?._originalScore})`);
        return results;

    } catch (err) {
        // Graceful fallback: if embeddings fail, return results unchanged
        console.warn('⚠️ Semantic re-ranking failed, using keyword-only scores:', err.message);
        return results;
    }
}
