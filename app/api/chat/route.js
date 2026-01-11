import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';
import { routeContactChannel } from '../../lib/contact-router';

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

import {
    SALES_SYSTEM_PROMPT,
    INTERNAL_HELP_SYSTEM_PROMPT,
    INTAKE_SYSTEM_PROMPT,
    CLIENT_AUTH_SYSTEM_PROMPT,
    LAWYER_AUTH_SYSTEM_PROMPT,
    LAWYER_RESET_SYSTEM_PROMPT,
    SPECIALTY_MODULES // [NEW] Import Modules
} from '../../lib/prompts';

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
        const { message, history, mode, sessionId, lawyerId, clientUserId, clientEmail, lawyerSpecialties } = body;

        // 1. CHOOSE SYSTEM PROMPT
        let systemPrompt = "";
        let caseType = 'Ventas';

        if (mode === 'sales') {
            systemPrompt = SALES_SYSTEM_PROMPT;
            caseType = 'Ventas';
        } else if (mode === 'internal') {
            systemPrompt = INTERNAL_HELP_SYSTEM_PROMPT;
            caseType = 'Soporte';
        } else if (mode === 'client_help') {
            systemPrompt = CLIENT_AUTH_SYSTEM_PROMPT;
            caseType = 'Ayuda Acceso';
        } else if (mode === 'lawyer_login') {
            systemPrompt = LAWYER_AUTH_SYSTEM_PROMPT;
            caseType = 'Soporte Login';
        } else if (mode === 'password_reset') {
            systemPrompt = LAWYER_RESET_SYSTEM_PROMPT;
            caseType = 'Recuperación Clave';
        } else if (mode === 'intake') {
            systemPrompt = INTAKE_SYSTEM_PROMPT;
            caseType = 'Nuevo Caso (Web)';

            // [NEW] DYNAMIC SPECIALTY INJECTION
            if (lawyerSpecialties && Array.isArray(lawyerSpecialties) && lawyerSpecialties.length > 0) {
                const specialtyInstructions = lawyerSpecialties
                    .map(spec => SPECIALTY_MODULES[spec]) // Get module text
                    .filter(text => text) // Remove undefined (if specialty has no module yet)
                    .join("\n\n");

                if (specialtyInstructions) {
                    systemPrompt += `\n\n=== REGLAS ESPECIALES SEGUN ESPECIALIDAD ===\n${specialtyInstructions}`;
                    console.log(`🧠 Injected ${lawyerSpecialties.length} specialty modules into prompt.`);
                }
            }

            if (!lawyerId) return NextResponse.json({ reply: "Error: Falta ID del Abogado." }, { status: 400 });
        } else if (mode === 'demo') {
            systemPrompt = INTAKE_SYSTEM_PROMPT; // Reuse Intake Prompt for Demo
            caseType = 'DEMO';

            // DEMO LIMIT CHECK (IP BASED)
            // Use x-forwarded-for from Vercel/Next.js or fallback for localhost
            const forwardedFor = request.headers.get('x-forwarded-for');
            let ip = forwardedFor ? forwardedFor.split(',')[0] : null;

            // Localhost Fallback
            if (!ip) {
                const realIp = request.headers.get('x-real-ip');
                ip = realIp || '127.0.0.1'; // Default to localhost ID for testing
            }

            if (ip) {
                // 1. Check Limit in DB
                const { data: limitData, error: limitError } = await db
                    .from('demo_limits')
                    .select('message_count')
                    .eq('ip_address', ip)
                    .single();

                let currentCount = 0;
                if (limitData) {
                    currentCount = limitData.message_count;
                }

                // 2. Reject if Limit Exceeded
                if (currentCount >= 5) {
                    return NextResponse.json({ reply: "🔒 **Fin de la Demo**\n\nAlcanzaste el límite de interacciones gratuitas por hoy para esta IP. \n\n¡La IA real tiene un costo, pero para tus clientes será ilimitada! 😉 Contactanos." });
                }

                // 3. Increment Limit
                const { error: upsertError } = await db
                    .from('demo_limits')
                    .upsert({
                        ip_address: ip,
                        message_count: currentCount + 1,
                        last_interaction: new Date().toISOString()
                    }, { onConflict: 'ip_address' });

                if (upsertError) console.error("Limit DB Error:", upsertError);
            }
        } else {
            systemPrompt = SALES_SYSTEM_PROMPT;
        }

        // 2. SUPABASE: CREATE/UPDATE INQUIRY
        if (sessionId) {
            const upsertData = {
                id: sessionId,
                case_type: caseType,
                contact_name: 'Nuevo Cliente', // Fixed: Avoid "usuario" placeholder
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
                // CONTACT ROUTING LOGIC
                const contactChannel = routeContactChannel(message);
                let contactInstruction = "";

                if (contactChannel) {
                    console.log("🔀 Contact Intent Detected:", contactChannel.key);
                    contactInstruction = `\n\n✋ [SYSTEM OVERRIDE]: EL USUARIO ESTÁ PREGUNTANDO SOBRE: ${contactChannel.label.toUpperCase()}.
                    
                    TU RESPUESTA DEBE INCLUIR OBLIGATORIAMENTE ESTA INFORMACIÓN DE CONTACTO AL FINAL:
                    "Para resolver esto rápidamente, te recomendamos escribir a: **${contactChannel.email}**"
                    (Asunto sugerido: "${contactChannel.defaultSubject}")
                    
                    Si es un problema técnico o de facturación, NO intentes debuggearlo tú. Derívalo al mail.`;
                }

                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: "system", content: systemPrompt + contactInstruction },
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
