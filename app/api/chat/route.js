import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

// GET: Fetch Chat History for a Session (Persistence)
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let db = supabase;

    // Bypass RLS to allow reading history for the public link holder
    if (serviceRoleKey) {
        db = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { persistSession: false } }
        );
    }

    try {
        const { data: messages, error } = await db
            .from('messages')
            .select('*')
            .eq('inquiry_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ history: messages || [] });
    } catch (error) {
        console.error("Error fetching history:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ============================================================================
// INLINE PROMPTS
// ============================================================================
const SALES_SYSTEM_PROMPT = `
Sos el Asistente Comercial Oficial de JUDIC-IA, una plataforma de inteligencia artificial diseñada exclusivamente para abogados y estudios jurídicos en Argentina.

TU OBJETIVO:
Informar, aclarar dudas y acompañar a abogados interesados en contratar la suscripción a JUDIC-IA.

ALCANCE:
Podés responder ÚNICAMENTE preguntas relacionadas con:
- Qué es JUDIC-IA
- Qué problemas soluciona para abogados
- Beneficios de usar JUDIC-IA
- Servicios incluidos en la suscripción
- Costos y modalidades de pago (El plan estándar es de $50 USD/mes).
- Proceso de alta y puesta en marcha
- Compatibilidad con WhatsApp y web
- Límites legales del sistema (no reemplaza al abogado)

NO PODÉS:
- Dar asesoramiento legal.
- Opinar sobre casos concretos.
- Responder preguntas ajenas a JUDIC-IA.

SI EL USUARIO PREGUNTA ALGO FUERA DEL CONTEXTO:
Respondé de forma educada y firme:
"Mi función es brindarte información sobre JUDIC-IA y su suscripción para abogados. Para otros temas, te recomiendo consultar directamente con un profesional."

TONO:
- Profesional, Claro, Cercano, Orientado a abogados argentinos.
`;

const INTERNAL_HELP_SYSTEM_PROMPT = `
Sos el Asistente de Soporte Interno de JUDIC-IA. Estás dentro del panel del abogado.

TU OBJETIVO:
Ayudar al abogado a utilizar la plataforma Judic-IA de manera eficiente.

FUNCIONES CLAVE QUE PODÉS EXPLICAR:
1. INVESTIGACIÓN LEGAL (Dashboard > Investigación): El abogado puede realizar consultas sobre jurisprudencia y normativa nacional o provincial. Puede generar informes en PDF brandeados.
2. BANDEJA DE ENTRADA (Dashboard): Aquí llegan las consultas que los clientes hacen a través del ChatWidget instalado en su web o desde WhatsApp.
3. MIS CLIENTES (Dashboard): Gestión de contactos y expedientes (Próximamente).
4. CONFIGURACIÓN: Ajustes de perfil, matrícula y firma.

TONO:
- Eficiente, Técnico pero Amigable, Facilitador.

REGLAS DE ORO:
1. NO DES CONSEJOS LEGALES. Solo ayuda a navegar y usar las herramientas de la app.
2. NO RESPONDAS PREGUNTAS DE CULTURA GENERAL, RECETAS, DEPORTES, ETC.
   - Si te preguntan algo fuera de tema (ej: "Cómo hacer un guiso", "Quién ganó el mundial"), responde:
     "Disculpa, soy un asistente técnico de Judic-IA. Solo puedo ayudarte con el uso de la plataforma o la gestión de tu estudio."
3. MANTENTE EN CONTEXTO SIEMPRE. Tu única función es el soporte técnico/operativo de Judic-IA.
`;

// ============================================================================
// DYNAMIC PROMPT FOR INTAKE
// ============================================================================
const INTAKE_SYSTEM_PROMPT = `
Sos el Asistente Legal y Secretario del Estudio. Tu trabajo NO es solo charlar, es RECOPILAR INFORMACIÓN Y DOCUMENTACIÓN para que el abogado pueda trabajar.

TU PERSONALIDAD:
- Eficiente, Profesional, Directo.
- No pierdas tiempo con saludos largos. Ve al grano.
- Si el cliente da evasivas, INSISTE amablemente pero con firmeza.

OBJETIVO PRINCIPAL:
Obtener Nombre, Teléfono y los DOCUMENTOS CLAVE según el tipo de caso.

--------------------------------------------------------
PROTOCOLOS DE ACTUACIÓN POR TIPO DE CASO:
--------------------------------------------------------

CASE 1: DIVORCIOS / FAMILIA
Si detectas intenciones de divorcio, separación o alimentos:
1. PIDE DATOS: Nombre completo y Teléfono.
2. INDAGA: ¿Hay hijos menores? ¿Hay bienes en común (casa, auto)?
3. SOLICITA DOCUMENTACIÓN (Imperativo):
   - "Para avanzar con el análisis de viabilidad, necesito que subas foto de:"
   - DNI (frente y dorso).
   - Libreta o Acta de Matrimonio.
   - Partidas de Nacimiento de los hijos (si hay).
   - Títulos de propiedad (si hay bienes).

CASE 2: SUCESIONES
Si hablan de un fallecimiento o herencia:
1. PIDE DATOS: Nombre y Teléfono.
2. INDAGA: ¿Quién falleció? ¿Fecha? ¿Lugar? ¿Herederos conocidos?
3. SOLICITA DOCUMENTACIÓN:
   - "Por favor, adjunta la siguiente documentación para iniciar el trámite:"
   - Partida de Defunción.
   - DNI de los herederos.
   - Títulos de Propiedad de los bienes a heredar.
   - Testamento (si existe).

CASE 3: LABORAL / DESPIDOS
Si hablan de despido, trabajo en negro, ART:
1. PIDE DATOS: Nombre y Teléfono.
2. INDAGA: Fecha de ingreso, sueldo aproximado, motivo del despido.
3. SOLICITA DOCUMENTACIÓN:
   - "Es fundamental que me envíes ahora:"
   - Telegramas o Cartas Documento recibidas (fotos claras).
   - Recibos de sueldo (los últimos).
   - DNI.

CASE 4: OTROS / GENÉRICO
1. PIDE DATOS: Nombre y Teléfono.
2. SOLICITA: "Cualquier documentación, contrato o notificación que tengas relacionada con el caso."

--------------------------------------------------------
INSTRUCCIONES DE "UPLOAD" (SUBIDA DE ARCHIVOS):
- Si el usuario dice "Ya lo tengo", "Cómo lo mando" o "Acá está":
- Responde: "Perfecto. Toca el ícono del CLIP 📎 que figura abajo a la izquierda del chat y selecciona las fotos o PDFs. Yo los guardaré en tu expediente."
--------------------------------------------------------

--------------------------------------------------------
    
CRITICAL: DATA EXTRACTION (JSON):
Every time the user provides their Name, Phone, or describes their Case, you MUST output a hidden JSON block at the very end of your response.
    
FORMAT:
<extraction>
{
    "contact_name": "Extract Name if present, else null",
    "contact_phone": "Extract Phone if present, else null",
    "case_type": "Classify: 'Divorcio', 'Sucesión', 'Despido', 'ART', 'Penal', or 'Civil'",
    "ai_summary": "Brief 1-sentence summary of the case facts known so far",
    "priority_score": 50 (Adjust 1-100 based on urgency)
}
</extraction>
    
RULES FOR EXTRACTION:
1. YOU MUST ALWAYS output the <extraction> block at the end of your response.
2. STATE & CORRECTIONS:
   - Generally, maintain the known data from previous turns.
   - EXCEPTION: If the user explicitly CORRECTS a field (e.g., "My name is actually Gerardo", "New phone is..."), YOU MUST OVERWRITE the old value with the new one.
3. Do NOT invent data. Use null if unknown.
4. The JSON must be the VERY LAST thing in your response.
5. Do NOT mention the JSON to the user.
    
--------------------------------------------------------
`;

export async function POST(request) {
    // Check API Key for OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Use Service Role Key if available to bypass RLS (Crucial for Public Intake)
    let db = supabase;
    console.log("🔑 Checking Permissions: Service Role Key is", serviceRoleKey ? "LOADED ✅" : "MISSING ❌");

    if (serviceRoleKey) {
        db = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { persistSession: false } }
        );
    } else {
        console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY missing. Update operations might fail due to RLS.");
    }

    let openai = null;
    if (apiKey) {
        openai = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://openrouter.ai/api/v1",
            defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "Judic-IA MVP" }
        });
    }

    try {
        const body = await request.json();
        const { message, history, mode, sessionId, lawyerId, clientUserId, clientEmail } = body;

        // 1. CHOOSE SYSTEM PROMPT
        let systemPrompt = "";
        let caseType = 'Ventas';

        if (mode === 'sales') {
            systemPrompt = SALES_SYSTEM_PROMPT;
            caseType = 'Ventas';
        } else if (mode === 'internal') {
            systemPrompt = INTERNAL_HELP_SYSTEM_PROMPT;
            caseType = 'Soporte';
        } else if (mode === 'intake') {
            systemPrompt = INTAKE_SYSTEM_PROMPT;
            caseType = 'Nuevo Caso (Web)';

            if (!lawyerId) return NextResponse.json({ reply: "Error: Falta ID del Abogado." }, { status: 400 });
        } else {
            systemPrompt = SALES_SYSTEM_PROMPT;
        }

        // 2. SUPABASE: CREATE/UPDATE INQUIRY
        if (sessionId) {
            const upsertData = {
                id: sessionId,
                case_type: caseType,
                status: 'Nuevo'
            };

            // CRITICAL: Assign Lawyer and Link Client Auth
            if (mode === 'intake' && lawyerId) {
                upsertData.assigned_lawyer_id = lawyerId;
                if (clientUserId) upsertData.client_auth_id = clientUserId;
                if (clientEmail) upsertData.contact_email = clientEmail;
            }

            const { error: upsertError } = await db
                .from('inquiries')
                .upsert(upsertData, { onConflict: 'id', ignoreDuplicates: true });

            if (upsertError) console.error("❌ Supabase Upsert Error:", upsertError);
        }

        // 3. SUPABASE: SAVE USER MESSAGE
        if (sessionId) {
            await db.from('messages').insert({
                inquiry_id: sessionId,
                role: 'user',
                content: message
            });
        }

        // 4. GENERATE AI RESPONSE
        let replyContent = "";
        if (openai) {
            try {
                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...(history || []),
                        { role: "user", content: message }
                    ],
                    model: "openai/gpt-3.5-turbo",
                });
                const rawContent = completion.choices[0].message.content;

                // --- DATA EXTRACTION LOGIC ---
                let extractedData = null;
                replyContent = rawContent;

                const extractionMatch = rawContent.match(/<extraction>([\s\S]*?)<\/extraction>/);
                if (extractionMatch) {
                    try {
                        const cleanJson = extractionMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
                        console.log("🕵️ Raw Extraction:", cleanJson);
                        extractedData = JSON.parse(cleanJson);

                        // Remove metadata from response shown to user
                        replyContent = rawContent.replace(/<extraction>[\s\S]*?<\/extraction>/, "").trim();
                    } catch (e) {
                        console.error("❌ JSON Parse Error in Extraction:", e);
                    }
                }

                // Update Inquiry Data in Supabase
                if (extractedData && sessionId) {
                    console.log("📝 Attempting to Update Inquiry:", extractedData);

                    const updatePayload = {};
                    if (extractedData.contact_name) updatePayload.contact_name = extractedData.contact_name;
                    if (extractedData.contact_phone) updatePayload.contact_phone = extractedData.contact_phone;
                    if (extractedData.case_type) updatePayload.case_type = extractedData.case_type;
                    if (extractedData.ai_summary) updatePayload.ai_summary = extractedData.ai_summary;
                    if (extractedData.priority_score) updatePayload.priority_score = extractedData.priority_score;

                    if (Object.keys(updatePayload).length > 0) {
                        const { error: updateError } = await db
                            .from('inquiries')
                            .update(updatePayload)
                            .eq('id', sessionId);

                        if (updateError) {
                            console.error("❌ DATABASE UPDATE FAILED:", updateError);
                        } else {
                            console.log("✅ Database Updated Successfully");
                        }
                    }
                }
                // -----------------------------

            } catch (err) {
                console.error("❌ OpenRouter Error:", err);
                replyContent = `⚠️ Error de conexión IA: ${err.message}`;
            }
        } else {
            replyContent = "Hola (Modo Respaldo). Configura OPENROUTER_API_KEY.";
        }


        // 5. SUPABASE: SAVE BOT RESPONSE (Cleaned)
        if (sessionId) {
            await db.from('messages').insert({
                inquiry_id: sessionId,
                role: 'assistant',
                content: replyContent
            });
        }

        return NextResponse.json({ reply: replyContent });

    } catch (error) {
        console.error("❌ SERVER ERROR:", error);
        return NextResponse.json({ reply: `💥 ERROR TÉCNICO: ${error.message}` });
    }
}
