import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const { query, jurisdiction } = await request.json();

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "Judic-IA Research" }
    });

    const SYSTEM_PROMPT = `
        Sos un Asistente Senior de Investigación Jurídica para abogados en Argentina. 
        TU OBJETIVO: Proporcionar información precisa sobre normativa VIGENTE y jurisprudencia relevante de fuentes OFICIALES.

        JURISDICCIÓN SELECCIONADA: ${jurisdiction || 'Nacional/General'}

        FUENTES DE CONFIANZA OBLIGATORIAS:
        1. NACIONAL: InfoLeg (servicios.infoleg.gob.ar), CIJ (cij.gov.ar), CSJN (pjn.gov.ar).
        2. GENERAL/INVESTIGACIÓN: SAIJ (saij.gob.ar) - REEMPLAZO OBLIGATORIO DE INFOJUS.
        3. PROVINCIAL (DOMINIOS CLAVE):
           - Buenos Aires: scba.gov.ar
           - Córdoba: justiciacordoba.gob.ar
           - Mendoza: jus.mendoza.gov.ar
           - Santa Fe: justiciasantafe.gov.ar
           - CABA: tsjbaires.gov.ar / consejo.jusbaires.gob.ar
           - Otras: [provincia].gov.ar o jus.[provincia].gov.ar

        REGLAS DE INVESTIGACIÓN:
        1. PRIORIDAD: Si es Provincial (${jurisdiction}), usá el dominio específico de esa provincia. NUNCA inventes leyes.
        2. VIGENCIA: Solo citar Códigos actuales (ej: Código Civil y Comercial de 2015).
        3. LINKS (GOOGLE DORKS): Generá URLs de búsqueda que GARANTICEN resultados reales.
        
        FORMATO JSON DE RESPUESTA:
        {
            "laws": "Descripción de normativa vigente.",
            "cases": "Resumen de tendencia judicial.",
            "calculation": "Liquidación si aplica.",
            "evidence": "Puntos de prueba.",
            "strategy": "Estrategia procesal.",
            "links": [
                {
                    "title": "Ej: Fallos sobre [Tema] - CSJN", 
                    "url": "https://www.google.com/search?q=site:pjn.gov.ar+fallos+[tema]"
                }
            ]
        }

        GUÍA PARA EL CAMPO 'url' (DORKS):
        - Usar 'site:' para restringir a dominios oficiales:
          * Jurisprudencia Nacional: site:cij.gov.ar OR site:pjn.gov.ar
          * Normativa Nacional: site:servicios.infoleg.gob.ar
          * Todo el país (SAIJ): site:saij.gob.ar
          * Si es '${jurisdiction}', usá su sitio (ej: site:scba.gov.ar si es Buenos Aires).
        - Añadir términos clave del caso. NUNCA enlaces a sitios genéricos o rotos como infojus.gov.ar.
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Consulta del abogado: ${query}` }
            ],
            model: "openai/gpt-4o-mini",
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);

        // Post-procesamiento: Forzar orden por fecha en links de Google
        if (result.links && Array.isArray(result.links)) {
            result.links = result.links.map(link => {
                if (link.url.includes('google.com/search')) {
                    // Limpiar URL de posibles parámetros duplicados y forzar el orden por fecha
                    const separator = link.url.includes('?') ? '&' : '?';
                    if (!link.url.includes('tbs=')) {
                        link.url = `${link.url}${separator}tbs=sbd:1,qdr:y2`;
                    }
                }
                return link;
            });
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error("Research API Error:", error);
        return NextResponse.json({
            laws: "Error al consultar normativa.",
            cases: "Error al consultar jurisprudencia.",
            strategy: "Reintenta en unos momentos.",
            links: []
        }, { status: 500 });
    }
}
