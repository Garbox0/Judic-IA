import { NextResponse } from 'next/server';
import { enhanceQuery } from '@/lib/queryEnhancer';
import { verifyAuth } from '@/lib/api-auth';
import { verifyAccess } from '@/lib/tierMiddleware';

/**
 * API Endpoint: Query Enhancement
 * Improves a legal search query by adding legal context and terminology
 */
export async function POST(request) {
    // 🛡️ Auth required (consumes API credits)
    const auth = await verifyAuth(request);
    if (auth.error) return auth.response;

    // 🛡️ Plan verification (consumes OpenRouter credits)
    const accessCheck = await verifyAccess(auth.user.id, 'advanced_research');
    if (!accessCheck.allowed) {
        return NextResponse.json({ error: accessCheck.message, reason: accessCheck.reason }, { status: 403 });
    }

    try {
        const { query, jurisdiction = 'Nacional' } = await request.json();

        if (!query || query.trim().length < 2) {
            return NextResponse.json(
                { error: 'Query inválida' },
                { status: 400 }
            );
        }

        const enhancement = await enhanceQuery(query, jurisdiction);

        return NextResponse.json(enhancement);

    } catch (error) {
        console.error('❌ Enhancement API error:', error);
        return NextResponse.json(
            {
                error: 'Error al mejorar la búsqueda',
                enhanced: null,
                confidence: 0
            },
            { status: 500 }
        );
    }
}
