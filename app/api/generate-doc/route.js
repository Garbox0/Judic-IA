import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { verifyAuth } from '@/lib/api-auth';
import { verifyAccess, incrementUsage } from '@/lib/tierMiddleware';

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
    // 🛡️ Auth required (consumes OpenRouter API credits)
    const auth = await verifyAuth(request);
    if (auth.error) return auth.response;

    // 🛡️ Plan & Quota verification
    const accessCheck = await verifyAccess(auth.user.id, null, 'ai_messages');
    if (!accessCheck.allowed) {
        return NextResponse.json({ error: accessCheck.message, reason: accessCheck.reason }, { status: 403 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Falta API Key" }, { status: 500 });

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: { "HTTP-Referer": "https://judic-ia.com", "X-Title": "Judic-IA Doc Gen" }
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
            model: "openai/gpt-4o-mini",
        });

        const content = completion.choices[0].message.content;

        await incrementUsage(auth.user.id, 'ai_messages', 1);

        return NextResponse.json({ content });

    } catch (error) {
        console.error("GENERATION ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
