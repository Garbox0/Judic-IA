import { NextResponse } from 'next/server';
import { enhanceQuery } from '@/lib/queryEnhancer';

/**
 * API Endpoint: Query Enhancement
 * Improves a legal search query by adding legal context and terminology
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
