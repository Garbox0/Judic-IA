import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// SYSTEM PROMPT FOR GENERATION
const DOC_GEN_SYSTEM_PROMPT = `
Sos un Asistente Legal Experto en Derecho Argentino (Redactor Jurídico).
Tu tarea es redactar documentos legales formales y precisos basándote en la información proporcionada por un chat de intake con un cliente.

INSTRUCCIONES:
1. Analiza el historial del chat proporcionado para extraer los hechos clave (fechas, nombres, montos, situaciones).
2. Redacta el documento solicitado con el formato legal estándar en Argentina.
3. Si faltan datos (ej: fecha exacta, DNI), usa placeholders entre corchetes, ej: [COMPLETAR FECHA].
4. Mantén un tono formal, imperativo y jurídico.

FORMATOS SOPORTADOS:
- Telegrama Laboral (Ley 23.789): Intimación por trabajo en negro, diferencias salariales o despido verbal.
- Carta Documento: Intimación genérica o reclamo.
- Demanda: Estructura básica de demanda (Objeto, Hechos, Derecho, Prueba, Petitorio).

TU SALIDA DEBE SER ÚNICAMENTE EL TEXTO DEL DOCUMENTO, SIN EXPLICACIONES PREVIAS NI POSTERIORES.
`;

export async function POST(request) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Falta API Key" }, { status: 500 });

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "Judic-IA Doc Gen" }
    });

    try {
        const { docType, context } = await request.json();

        // Convert chat history to a readable string for the AI
        const transcript = context.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        const userPrompt = `
        TIPO DE DOCUMENTO: ${docType}
        
        TRANSCRIPCIÓN DEL CASO:
        ---
        ${transcript}
        ---

        Redacta el documento ${docType} completo listo para copiar y pegar.
        `;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: DOC_GEN_SYSTEM_PROMPT },
                { role: "user", content: userPrompt }
            ],
            model: "openai/gpt-3.5-turbo", // Or gpt-4 if available for better legal drafting
        });

        const content = completion.choices[0].message.content;

        return NextResponse.json({ content });

    } catch (error) {
        console.error("GENERATION ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
