import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

import { supabase as publicSupabase } from '../../lib/supabase';
import { routeContactChannel } from '../../lib/contact-router';

// GET: Fetch Chat History for a Session (Persistence)
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 🛡️ Identify User (Unified Cookie Lane for Stability)
    const AUTH_COOKIE = 'sb-judicia-auth';
    const cookieStore = await cookies();
    const authClient = createServerClient(supabaseUrl, anonKey, {
        cookies: {
            getAll() { return cookieStore.getAll() },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) =>
                    cookieStore.set(name, value, options)
                )
            },
        },
        cookieOptions: { name: AUTH_COOKIE }
    });

    const { data: { user } } = await authClient.auth.getUser();

    let db = publicSupabase;

    // Bypass RLS for internal operations (but we already have the user for auth check)
    if (serviceRoleKey) {
        db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    }

    try {
        // 🛡️ SECURITY: Verify Ownership
        // (User identified above)

        // 1. Get Inquiry to check assigned lawyer or client link
        const { data: inquiry, error: inqError } = await db
            .from('inquiries')
            .select('assigned_lawyer_id, client_auth_id')
            .eq('id', sessionId)
            .single();

        if (inqError || !inquiry) {
            return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
        }

        // 2. Authorization Guard
        // Allow if: 
        // A) User is the assigned lawyer OR user is the linked client
        // B) The inquiry is ANONYMOUS (Support/Login chats with no owners assigned) - SessionUUID acts as Bearer Token
        const isAnonymous = !inquiry.assigned_lawyer_id && !inquiry.client_auth_id;
        const isOwner = (user && (user.id === inquiry.assigned_lawyer_id || user.id === inquiry.client_auth_id)) || isAnonymous;

        if (!isOwner) {
            console.warn(`🚫 UNAUTHORIZED HISTORY ATTEMPT: User ${user?.id} tried to read session ${sessionId} (Anon: ${isAnonymous})`);
            return NextResponse.json({ error: "No tienes permiso para ver este historial." }, { status: 403 });
        }

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
    let db = publicSupabase;
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
        const {
            message, history, mode, sessionId, lawyerId,
            clientUserId, clientEmail, clientName, clientPhone,
            lawyerSpecialties
        } = body;

        let effectiveSessionId = sessionId;

        // [NEW] GLOBAL REVOCATION CHECK (The Kill Switch)
        if (sessionId) {
            const { data: isRevoked } = await db
                .from('revoked_access')
                .select('id')
                .eq('id', sessionId)
                .maybeSingle();

            if (isRevoked) {
                console.warn(`🚫 BLOCKED ACCESS: Session ${sessionId} is in the REVOKED_ACCESS blacklist.`);
                return NextResponse.json({
                    reply: "⛔ **ACCESO PERMANENTEMENTE REVOCADO**\n\nEste enlace de consulta ha sido invalidado por el profesional. Ya no es posible ingresar ni enviar mensajes con este acceso.",
                    error: "ACCESS_REVOKED_PERMANENTLY",
                    code: "BANNED_CID"
                }, { status: 403 });
            }
        }

        // [STRICT GATEKEEPER] Verify Profile existence for identified users IMMEDIATELY
        if (clientUserId && mode === 'intake') {
            const { data: profileExists } = await db
                .from('profiles')
                .select('id')
                .eq('id', clientUserId)
                .maybeSingle();

            if (!profileExists) {
                console.warn(`🚫 BLOCKED ACCESS: Profile for user ${clientUserId} no longer exists (Zombie attempt).`);
                return NextResponse.json({
                    reply: "⛔ **SESIÓN CERRADA**\n\nTu acceso ha sido revocado por el profesional. No es posible enviar más mensajes.",
                    error: "ACCESS_REVOKED",
                    code: "ZOMBIE_DETECTION"
                }, { status: 403 });
            }
        }

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

            // [NEW] CLIENT CONTEXT INJECTION (Prevents AI asking for known Name/Email)
            let clientContext = "";
            // We might receive 'clientName' in body or derive it from clientEmail if needed
            // Ideally, the frontend sends it via the 'message' hidden prefix or a new body param. 
            // For now, let's look at the body params 'clientEmail' and 'clientUserId'.

            // NOTE: The user requested the AI "La IA solo tiene que sacar la intencion".
            // We tell the AI: "You ALREADY KNOW the user."

            if (clientEmail) {
                clientContext += `\n\n=== DATOS DEL CLIENTE (YA CONOCIDOS) ===\nEMAIL: ${clientEmail}\n`;
            }
            // If we had a name passed in, we would add it. 
            // Since the IntakeFormContent has the Auth User, it has the email. 
            // The AI should address them politely but NOT ask for name/email again unless confirming.
            clientContext += `INSTRUCCION CLAVE: El cliente ya está registrado. NO pidas su nombre ni email ni teléfono salvo que sea estrictamente necesario para el caso.
            TU OBJETIVO PRINCIPAL: Determinar la intención legal ("Case Type") y un resumen del problema.
            Saluda cortésmente (ej: "Hola, veo que ya estás registrado. ¿En qué puedo ayudarte hoy?") y ve directo al punto legal.`;

            systemPrompt += clientContext;

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
            // [SECURITY CHECK] PREVENT RESURRECTION OF DELETED CHATS
            // If the client sends SIGNIFICANT history (implying an ongoing chat) but the inquiry is gone, block it.
            // New clients have: 1 (Greeting) + 1 (User Message) = 2. 
            // So we allow history <= 2. Only block if > 2.

            console.log(`🛡️ Security Check | Session: ${sessionId} | History Length: ${history?.length || 0}`);

            const isOngoingChat = history && history.length > 2; // Fixed: Allow Greeting + First Message (Len=2)

            if (isOngoingChat) {
                // Check if it exists FIRST
                const { data: existingInquiry } = await db
                    .from('inquiries')
                    .select('id')
                    .eq('id', sessionId)
                    .maybeSingle();

                if (!existingInquiry) {
                    console.warn(`🚫 BLOCKED RESURRECTION: Session ${sessionId} was deleted.`);
                    return NextResponse.json({
                        reply: "⛔ **SESIÓN REVOCADA**\n\nEl profesional ha cerrado este expediente. No es posible enviar más mensajes.",
                        error: "SESSION_REVOKED"
                    }, { status: 403 });
                }
            }

            // [SMART UPSERT] Only overwrite name/phone if they are empty or "Nuevo Cliente"
            const { data: currentInquiry } = await db
                .from('inquiries')
                .select('contact_name, contact_phone, id')
                .eq('id', sessionId)
                .maybeSingle();

            // [ZOMBIE REBIRTH PREVENTION 2.2]
            const isSystemSync = message.includes('[SISTEMA:');
            const isNewRegistration = message.includes('SISTEMA: Nuevo cliente registrado');

            // [ANTI-TRIPLICATION 3.0]
            // If we have both IDs, check if this client ALREADY has an inquiry with this lawyer
            if (lawyerId && clientUserId) {
                const { data: duplicate } = await db
                    .from('inquiries')
                    .select('id')
                    .eq('assigned_lawyer_id', lawyerId)
                    .eq('client_auth_id', clientUserId)
                    .maybeSingle();

                if (duplicate) {
                    console.log(`♻️ RECYCLING SESSION: Merging new CID ${sessionId} into existing Inquiry ${duplicate.id}`);
                    effectiveSessionId = duplicate.id;

                    // [ANTI-ZOMBIE 4.0]: Destroy the UNUSED placeholder ID (sessionId)
                    // If we don't do this, 10 clicks = 10 ghost rows in the DB.
                    if (effectiveSessionId !== sessionId) {
                        const { error: ghostErr } = await db.from('inquiries').delete().eq('id', sessionId);
                        if (ghostErr) console.warn("⚠️ Error creating ghost link:", ghostErr);
                        else console.log(`👻 GHOST BUSTED: Unused placeholder ${sessionId} deleted.`);
                    }
                }
            }

            if (!currentInquiry && effectiveSessionId === sessionId && mode === 'intake' && isSystemSync && !isNewRegistration) {
                console.warn(`💀 RESURRECTION BLOCKED: Refusing to recreate deleted inquiry ${sessionId} during sync.`);
                return NextResponse.json({
                    error: "EXPEDIENTE ELIMINADO",
                    code: "ZOMBIE_REBIRTH_PREVENTED"
                }, { status: 410 });
            }

            const upsertData = {
                id: effectiveSessionId,
                case_type: caseType,
                status: 'Nuevo'
            };

            // Only set names/phones if we have better data or if current is placeholder
            const nameIsPlaceholder = !currentInquiry?.contact_name ||
                currentInquiry.contact_name === 'Nuevo Cliente' ||
                currentInquiry.contact_name === 'Enlace Generado';
            if (clientName && nameIsPlaceholder) {
                upsertData.contact_name = clientName;
            } else if (nameIsPlaceholder) {
                upsertData.contact_name = 'Nuevo Cliente';
            }

            if (clientPhone && (!currentInquiry?.contact_phone)) {
                upsertData.contact_phone = clientPhone;
            }

            // CRITICAL: Assign Lawyer and Link Client Auth
            if (mode === 'intake' && lawyerId) {
                upsertData.assigned_lawyer_id = lawyerId;
                if (clientUserId) upsertData.client_auth_id = clientUserId;
                if (clientEmail) upsertData.contact_email = clientEmail;
            }

            const { error: upsertError } = await db
                .from('inquiries')
                .upsert(upsertData, { onConflict: 'id' });

            if (upsertError) {
                console.error("❌ Supabase Upsert Error:", upsertError);
                return NextResponse.json({ error: "Error al registrar la sesión de consulta." }, { status: 500 });
            }
        }

        // 3. SUPABASE: SAVE USER MESSAGE
        if (effectiveSessionId) {
            await db.from('messages').insert({
                inquiry_id: effectiveSessionId,
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
                    model: "openai/gpt-4o-mini",
                });
                const rawContent = completion.choices[0].message.content;

                // --- DATA EXTRACTION LOGIC (Robust) ---
                let extractedData = null;
                replyContent = rawContent;

                // Match XML <extraction> OR Markdown **[EXTRACCIÓN]**
                // Group 1: XML Content
                // Group 2: Markdown Content
                const extractionRegex = /(?:<extraction>([\s\S]*?)<\/extraction>)|(?:\*\*\[EXTRACCIÓN\]\*\*\s*({[\s\S]*?}))/i;
                const match = rawContent.match(extractionRegex);

                if (match) {
                    try {
                        const jsonStr = (match[1] || match[2] || "").trim().replace(/```json/g, '').replace(/```/g, '');
                        console.log("🕵️ Raw Extraction Found:", jsonStr);
                        extractedData = JSON.parse(jsonStr);

                        // Remove metadata from response shown to user
                        // We replace the WHOLE match with empty string
                        replyContent = rawContent.replace(match[0], "").trim();
                    } catch (e) {
                        console.error("❌ JSON Parse Error in Extraction:", e);
                    }
                }

                // Update Inquiry Data in Supabase
                if (extractedData && effectiveSessionId) {
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
                            .eq('id', effectiveSessionId);

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
        if (effectiveSessionId) {
            await db.from('messages').insert({
                inquiry_id: effectiveSessionId,
                role: 'assistant',
                content: replyContent
            });
        }

        return NextResponse.json({ reply: replyContent });

    } catch (error) {
        console.error("❌ SERVER ERROR in /api/chat POST:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
