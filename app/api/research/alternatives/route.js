import { NextResponse } from 'next/server';
import { generateAlternatives } from '@/lib/queryEnhancer';

/**
 * API Endpoint: Alternative Queries Generator
 * Generates alternative search queries when initial results are poor
 */
export async function POST(request) {
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
