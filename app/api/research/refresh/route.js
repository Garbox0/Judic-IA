import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request) {
    const { query, excludeUrls } = await request.json();
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (!braveApiKey) {
        return NextResponse.json({ error: "Configuración incompleta de API." }, { status: 500 });
    }

    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: "https://openrouter.ai/api/v1",
            defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "Judic-IA" }
        });

        // 1. FRESH BRAVE SEARCH
        // We purposely vary the query slightly or rely on fetching deeper results (count: 10)
        // and picking one that isn't in excludeUrls.
        const params = new URLSearchParams({
            q: query + " fallo sentencia completa argentina -manual -guía",
            count: 10,
            country: "ar",
            search_lang: "es"
        });

        const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
            headers: { "X-Subscription-Token": braveApiKey }
        });

        if (!res.ok) throw new Error("Brave Search Failed");

        const data = await res.json();
        const candidates = data.web?.results || [];

        // 2. FILTERING
        // Find the first result that is NOT in excludeUrls and is a valid legal domain if possible
        const cleanUrl = (u) => {
            try { return new URL(u).href; } catch { return u; }
        };

        const existingSet = new Set((excludeUrls || []).map(u => cleanUrl(u)));

        const bestMatch = candidates.find(c => {
            const u = cleanUrl(c.url);
            if (existingSet.has(u)) return false;
            // Basic quality filter
            const h = new URL(c.url).hostname;
            if (h.includes("youtube") || h.includes("facebook")) return false;
            return true;
        });

        if (!bestMatch) {
            return NextResponse.json({ error: "No se encontraron nuevos resultados relevantes." }, { status: 404 });
        }

        // 3. SYNTHESIS with GPT-4o-mini
        const prompt = `Analizá este resultado de búsqueda web y generá un resumen jurídico estructurado.
        
        RESULTADO:
        Título: ${bestMatch.title}
        URL: ${bestMatch.url}
        Snippet: ${bestMatch.description}
        
        TAREA:
        Devolver un JSON con el formato exacto para una tarjeta de jurisprudencia.
        {
          "title": "Título corto y formal del fallo (Autos)",
          "summary": "Resumen conciso del holding (max 30 palabras).",
          "url": "${bestMatch.url}",
          "source": "Dominio o Tribunal (ej: CSJN)"
        }
        
        Solo JSON plano.`;

        const completion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const newCase = JSON.parse(completion.choices[0].message.content);
        // Ensure URL is preserved if model hallucinates
        newCase.url = bestMatch.url;

        return NextResponse.json(newCase);

    } catch (error) {
        console.error("Refresh Error:", error);
        return NextResponse.json({ error: "Error al refrescar el fallo." }, { status: 500 });
    }
}
