import { NextResponse } from 'next/server';
import { generateAlternatives } from '@/lib/queryEnhancer';
import { verifyAuth } from '@/lib/api-auth';
import { verifyAccess } from '@/lib/tierMiddleware';

/**
 * API Endpoint: Alternative Queries Generator
 * Generates alternative search queries when initial results are poor
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

        const alternatives = await generateAlternatives(query, jurisdiction);

        return NextResponse.json({ alternatives });

    } catch (error) {
        console.error('❌ Alternatives API error:', error);
        return NextResponse.json(
            {
                error: 'Error al generar alternativas',
                alternatives: []
            },
            { status: 500 }
        );
    }
}
