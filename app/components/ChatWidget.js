"use client";
import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";

import { useSearchParams } from "next/navigation";
import "./chat-widget.css";

export default function ChatWidget({
    mode = "client",
    initialMessage = "Hola...",
    startOpen = false,
    embedded = false,
    lawyerId = null,
    clientEmail = null,
    clientUserId = null,
    clientName = null,
    clientPhone = null,
    lawyerSpecialties = [],
    lawyerAvatar = null // [NEW] Accept avatar from props
}) {
    const [isOpen, setIsOpen] = useState(startOpen || embedded);
    const [messages, setMessages] = useState([
        { role: "assistant", content: initialMessage }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [activeAvatar, setActiveAvatar] = useState(lawyerAvatar);
    const messagesEndRef = useRef(null);
    const searchParams = useSearchParams();

    // Fetch Lawyer Avatar ONLY if not provided via props
    useEffect(() => {
        if (!lawyerAvatar && lawyerId && mode === 'intake') {
            const fetchLawyerAvatar = async () => {
                const { data } = await supabase
                    .from('profiles')
                    .select('avatar_url')
                    .eq('id', lawyerId)
                    .single();
                if (data?.avatar_url) {
                    setActiveAvatar(data.avatar_url);
                }
            };
            fetchLawyerAvatar();
        } else if (lawyerAvatar) {
            setActiveAvatar(lawyerAvatar);
        }
    }, [lawyerId, mode, lawyerAvatar]);

    // Generate Session ID on Client & Fetch History (Persistence)
    useEffect(() => {
        const initSession = async () => {
            let activeSessionId = null;

            // Internal Support: Ephemeral (Per User Request: Fresh start on refresh)
            if (mode === 'internal') {
                // Fix: Only generate if not already set to prevent infinite loop
                activeSessionId = sessionId || crypto.randomUUID();
            } else {
                // Public Intake: Check for Unique Client ID (cid)
                // SKIP for client_help mode - it should have its own session, not use the inquiry CID
                const cid = searchParams.get('cid');
                if (cid && mode !== 'client_help') {
                    activeSessionId = cid;
                } else if (mode === 'demo') {
                    // Demo Mode: Always Fresh Session (No Persistence)
                    activeSessionId = sessionId || crypto.randomUUID();
                } else {
                    // Fallback: Browser LocalStorage (Persistence for returning clients)
                    let storedId = localStorage.getItem(`judic-ia-session-${mode}`);
                    if (!storedId) {
                        storedId = crypto.randomUUID();
                        localStorage.setItem(`judic-ia-session-${mode}`, storedId);
                    }
                    activeSessionId = storedId;
                }
            }

            if (activeSessionId && activeSessionId !== sessionId) {
                setSessionId(activeSessionId);

                // FETCH HISTORY FROM API (Persistence)
                // Only if sessionId is UUID (avoid fetching for mock 'auth-' ids which cause 500 errors)
                // AND not 'demo'/'internal'/'client_help' mode (which are ephemeral or support-only)
                if (activeSessionId.length > 20 && !activeSessionId.startsWith('auth-') && mode !== 'demo' && mode !== 'lawyer_login' && mode !== 'internal' && mode !== 'client_help') {
                    try {
                        const res = await fetch(`/api/chat?sessionId=${activeSessionId}`, {
                            credentials: 'include'
                        });
                        if (res.status === 404) {
                            // Session new or not found. Silent return.
                            return;
                        }
                        if (!res.ok) throw new Error(`API Error: ${res.status}`);

                        const data = await res.json();
                        if (data.history && data.history.length > 0) {
                            setMessages(data.history.map(msg => ({
                                role: msg.role,
                                content: msg.content
                            })));
                        }
                    } catch (err) {
                        console.error("Error restoring chat history:", err);
                    }
                }
            }
        };
        initSession();
    }, [mode, searchParams]); // Removed sessionId to prevent infinite loop

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setInput("");
        setLoading(true);

        try {
            // Check for Authenticated Client User
            // 1. Prefer Props (from IntakeForm)
            // 2. Fallback to Supabase Auth check (for standalone usage)
            let userIdToSend = clientUserId;
            let emailToSend = clientEmail;

            if (!userIdToSend && (mode === 'client' || mode === 'intake')) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    userIdToSend = user.id;
                    emailToSend = user.email;
                }
            }

            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({
                    message: userMsg,
                    history: messages,
                    mode,
                    sessionId,
                    lawyerId, // Pass the lawyer ID for attribution
                    clientUserId: userIdToSend,
                    clientEmail: emailToSend,
                    clientName,
                    clientPhone,
                    lawyerSpecialties: lawyerSpecialties || [] // [NEW] Pass specialties to AI logic
                }),
            });

            const data = await res.json();

            // [NEW] QUOTA LIMIT HANDLER
            if (res.status === 403 && data.code === 'LIMIT_REACHED') {
                // Remove user message to not confuse them? Or leave it?
                // Current UX: Leave it, show modal.
                setShowLimitModal(true);
                // Optional: Add a system message in chat history too?
                setMessages(prev => [...prev, { role: "assistant", content: "⛔ **Límite Mensual Alcanzado.** Contacta al profesional para más información." }]);
                return;
            }

            setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: "assistant", content: "Lo siento, tuve un error de conexión." }]);
        } finally {
            setLoading(false);
        }
    };

    // Visuals based on mode
    const getBotConfig = () => {
        switch (mode) {
            case 'sales': return { name: "Ventas Judic-IA", color: "#c5a021", icon: "🤖" };
            case 'internal': return { name: "Soporte Interno", color: "#38bdf8", icon: "🛠️" };
            case 'demo': return { name: "Asistente Dr. Martínez", color: "#fbbf24", icon: "⚖️" };
            default: return { name: "Asistente Legal", color: "#4ade80", icon: "💬" };
        }
    };

    const botConfig = getBotConfig();

    const [isBubbleHidden, setIsBubbleHidden] = useState(false);
    const [showLimitModal, setShowLimitModal] = useState(false);

    // Auto-hide bubble on mobile by default
    useEffect(() => {
        const checkMobile = () => {
            if (window.innerWidth <= 768 && !embedded) {
                setIsBubbleHidden(true);
            }
        };
        checkMobile();
    }, [embedded]);

    return (
        <div className={embedded ? "chat-widget-wrapper" : "chat-widget-container"}>
            {/* LIMIT REACHED MODAL */}
            {showLimitModal && (
                <div className="limit-modal-overlay">
                    <div className="limit-modal-content">
                        <div className="limit-modal-icon">
                            <span className="limit-modal-emoji">👑</span>
                        </div>
                        <h3 className="limit-modal-title">Límite Alcanzado</h3>
                        <p className="limit-modal-text">
                            El profesional ha agotado su cupo mensual de consultas gratuitas.
                        </p>
                        <button
                            onClick={() => setShowLimitModal(false)}
                            className="limit-modal-btn"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {!isOpen && !embedded && (
                <>

                    {/* STANDARD BUBBLE (Visible) */}
                    {!isBubbleHidden && (
                        <div className="chat-toggle-wrapper">
                            {/* Hide Button (Integrated Badge) */}
                            <button
                                className="chat-hide-btn"
                                onClick={(e) => { e.stopPropagation(); setIsBubbleHidden(true); }}
                                title="Ocultar temporalmente"
                                aria-label="Ocultar asistente"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>

                            <div className="chat-toggle" onClick={() => setIsOpen(true)}>
                                {/* Label is hidden on mobile by CSS, visible on desktop */}
                                <span className="chat-label">Asistente IA</span>
                                <button
                                    className="btn-primary chat-toggle-btn-premium"
                                    style={{
                                        boxShadow: `0 8px 32px rgba(212, 178, 76, 0.25)`,
                                        border: `2px solid ${botConfig.color}`
                                    }}
                                >
                                    <img src={activeAvatar || "/bot-icon.png"} alt="Bot" className="chat-avatar-img" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* HIDDEN TAB (When minimized) - With IA Label */}
                    {isBubbleHidden && (
                        <button
                            className="chat-minimized-tab chat-minimized-tab-v3"
                            onClick={() => { setIsBubbleHidden(false); setIsOpen(true); }}
                            style={{ borderLeft: `3px solid ${botConfig.color}` }}
                        >
                            {/* Robot/AI Icon */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={botConfig.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="10" rx="2"></rect>
                                <circle cx="12" cy="5" r="2"></circle>
                                <path d="M12 7v4"></path>
                                <line x1="8" y1="16" x2="8" y2="16"></line>
                                <line x1="16" y1="16" x2="16" y2="16"></line>
                            </svg>
                            {/* IA Label */}
                            <span className="chat-ia-label" style={{ color: botConfig.color }}>IA</span>
                        </button>
                    )}
                </>
            )}

            {(isOpen || embedded) && (
                <div className={embedded ? "embedded-chat" : "glass-panel chat-window"} style={embedded ? {
                    display: 'flex', flexDirection: 'column', height: '100%',
                    background: 'transparent',
                    fontFamily: 'var(--font-outfit)'
                } : {
                    // Removed fixed width/height/shadow here because CSS class handles it
                    // But keep display logic just in case override needed? No, CSS handles flex column.
                }}>
                    {/* Header - Hidden in embedded intake to avoid redundancy, OR simplified */}
                    {!embedded && (
                        <div className="chat-header-v3">
                            <div className="chat-header-info">
                                <div className="chat-header-avatar" style={{ border: `1px solid ${botConfig.color}` }}>
                                    <img src={activeAvatar || "/bot-icon.png"} alt="Bot" className="chat-avatar-img" />
                                </div>
                                <span className="chat-header-name">{botConfig.name}</span>
                            </div>
                            <button onClick={() => {
                                setIsOpen(false);
                                // On mobile, go directly back to minimized tab
                                if (window.innerWidth <= 768) setIsBubbleHidden(true);
                            }} className="chat-close-btn" aria-label="Cerrar chat">×</button>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="chat-messages-area">
                        {messages.filter(m => m.content && !m.content.startsWith('[SISTEMA:')).map((m, i) => (
                            <div key={i} className={`chat-msg ${m.role === "user" ? "user" : "assistant"}`}>
                                {m.content}
                            </div>
                        ))}
                        {loading && <div className="chat-typing">Escribiendo...</div>}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="chat-input-wrapper">
                        {/* 🔒 SECURITY: Only allow attachments in 'intake' mode to reduce attack surface */}
                        {(mode === 'intake' || mode === 'client') && (
                            <label htmlFor="chat_file_upload" className="chat-file-label hover-icon">
                                <input id="chat_file_upload" name="chat_attachment" type="file" style={{ display: 'none' }} onChange={async (e) => {
                                    if (e.target.files?.[0]) {
                                        const file = e.target.files[0];

                                        // 🔒 FRONTE-END SECURITY SHIELD 1: Type Validation
                                        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
                                        if (!allowedTypes.includes(file.type)) {
                                            alert("❌ Formato no permitido. Solo se aceptan PDF, JPG o PNG.");
                                            return;
                                        }

                                        // 🔒 FRONTE-END SECURITY SHIELD 2: Size Validation (5MB Limit)
                                        const maxSize = 5 * 1024 * 1024; // 5MB
                                        if (file.size > maxSize) {
                                            alert("❌ El archivo es demasiado grande. El límite es de 5MB.");
                                            return;
                                        }

                                        if (!sessionId) {
                                            alert("Error: No hay sesión activa. Intenta recargar la página.");
                                            return;
                                        }

                                        // 1. Optimistic UI
                                        setMessages(prev => [...prev, { role: "user", content: `📎 Subiendo archivo: ${file.name}...` }]);

                                        try {
                                            // 2. Upload to Supabase Storage
                                            const fileExt = file.name.split('.').pop();
                                            // 🔒 SECURITY SHIELD 3: Filename Sanitization
                                            const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_').toLowerCase();
                                            const fileName = `${sessionId}/${Math.random().toString(36).substring(7)}_${cleanName}`;

                                            const { data: uploadData, error: uploadError } = await supabase.storage
                                                .from('inquiry-attachments')
                                                .upload(fileName, file);

                                            if (uploadError) throw uploadError;

                                            // 3. Get Public URL
                                            const { data: { publicUrl } } = supabase.storage
                                                .from('inquiry-attachments')
                                                .getPublicUrl(fileName);

                                            // 4. CALL API FIRST (Ensures Inquiry exists in DB via Service Role Upsert)
                                            // We send a system message about the upload
                                            const apiRes = await fetch("/api/chat", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                credentials: 'include',
                                                body: JSON.stringify({
                                                    message: `[SISTEMA: El usuario subió un archivo real: ${file.name} (${publicUrl}). Confirma la recepción.]`,
                                                    history: messages,
                                                    mode,
                                                    sessionId,
                                                    lawyerId,
                                                    clientUserId: userIdToSend,
                                                    clientEmail: emailToSend,
                                                    clientName,
                                                    clientPhone
                                                }),
                                            });
                                            const apiData = await apiRes.json();

                                            // 5. Save Metadata to DB (attachments table)
                                            // Now it's safe because API call guaranteed the inquiry row exists
                                            const { error: dbError } = await supabase.from('attachments').insert({
                                                inquiry_id: sessionId,
                                                file_name: file.name,
                                                file_url: publicUrl,
                                                file_type: file.type,
                                                file_size: file.size
                                            });

                                            if (dbError) console.error("Attachment DB Error:", dbError);

                                            // 6. Notify UI
                                            setMessages(prev => [...prev, { role: "assistant", content: "✅ Archivo recibido correctamente." }]);
                                            if (apiData.reply) {
                                                setMessages(prev => [...prev, { role: "assistant", content: apiData.reply }]);
                                            }

                                        } catch (err) {
                                            console.error("Upload Error:", err);
                                            setMessages(prev => [...prev, { role: "assistant", content: "❌ Hubo un error al subir el archivo. Intenta de nuevo." }]);
                                        }
                                    }
                                }} accept=".pdf,.jpg,.png,.jpeg" />
                                📎
                            </label>
                        )}
                        <div style={{ flex: 1, position: 'relative' }}>
                            <label htmlFor="chat_input" className="sr-only">Escribe tu consulta</label>
                            <textarea
                                id="chat_input"
                                name="chat_message"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                                placeholder="Escribe tu consulta aquí..."
                                className="chat-textarea"
                            />
                        </div>
                        <button onClick={sendMessage} className="btn-primary chat-send-btn" aria-label="Enviar mensaje">➤</button>
                    </div>
                </div>
            )}
        </div>
    );
}
