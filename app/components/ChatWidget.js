"use client";
import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";

import { useSearchParams } from "next/navigation";

export default function ChatWidget({ mode = "client", initialMessage = "Hola...", startOpen = false, embedded = false, lawyerId = null }) {
    const [isOpen, setIsOpen] = useState(startOpen || embedded);
    const [messages, setMessages] = useState([
        { role: "assistant", content: initialMessage }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const messagesEndRef = useRef(null);
    const searchParams = useSearchParams();

    // Generate Session ID on Client & Fetch History (Persistence)
    useEffect(() => {
        const initSession = async () => {
            let activeSessionId = null;

            // Internal Support: Auth User
            if (mode === 'internal') {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    activeSessionId = `auth-${user.id}-${mode}`;
                }
            } else {
                // Public Intake: Check for Unique Client ID (cid)
                const cid = searchParams.get('cid');
                if (cid) {
                    activeSessionId = cid;
                } else {
                    // Fallback: Browser LocalStorage
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
                if (activeSessionId.length > 20 && !activeSessionId.startsWith('auth-')) {
                    try {
                        const res = await fetch(`/api/chat?sessionId=${activeSessionId}`);
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
    }, [mode, searchParams, sessionId]);

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
            let clientUserId = null;
            let clientEmail = null;

            if (mode === 'client' || mode === 'intake') {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    clientUserId = user.id;
                    clientEmail = user.email;
                }
            }

            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMsg,
                    history: messages,
                    mode,
                    sessionId,
                    lawyerId, // Pass the lawyer ID for attribution
                    clientUserId, // [NEW] Link to Auth User
                    clientEmail   // [NEW] Save Email automatically
                }),
            });
            const data = await res.json();
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
            default: return { name: "Asistente Legal", color: "#4ade80", icon: "💬" };
        }
    };

    const botConfig = getBotConfig();

    // Embedded vs Floating Styles
    const containerStyle = embedded ? {
        position: "relative", width: "100%", maxWidth: "450px", height: "100%", margin: "0 auto",
        display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", borderRadius: "12px",
        overflow: "hidden", fontFamily: 'var(--font-outfit)'
    } : {
        position: "fixed", bottom: "2rem", right: "2rem", zIndex: 1000, fontFamily: 'var(--font-outfit)'
    };

    return (
        <div style={containerStyle}>
            {!isOpen && !embedded && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => setIsOpen(true)}>
                    <span style={{
                        color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600,
                        background: 'rgba(15, 23, 42, 0.4)', padding: '0.4rem 0.8rem',
                        borderRadius: '20px', border: '1px solid var(--border)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        transition: 'all 0.3s ease',
                        whiteSpace: 'nowrap'
                    }}>
                        Asistente IA
                    </span>
                    <button
                        className="btn-primary"
                        style={{
                            width: "60px", height: "60px", borderRadius: "50%",
                            boxShadow: `0 8px 24px -4px ${botConfig.color}44`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: `2px solid ${botConfig.color}`,
                            cursor: 'pointer',
                            padding: 0,
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        <img src="/bot-icon.png" alt="Bot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                </div>
            )}

            {(isOpen || embedded) && (
                <div className={embedded ? "embedded-chat" : "glass-panel"} style={embedded ? {
                    display: 'flex', flexDirection: 'column', height: '100%',
                    background: 'transparent',
                    fontFamily: 'var(--font-outfit)'
                } : {
                    width: "350px", height: "500px", display: "flex", flexDirection: "column",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.3)", overflow: "hidden",
                    zIndex: 2000 // Higher than navbar
                }}>
                    {/* Header - Hidden in embedded intake to avoid redundancy, OR simplified */}
                    {!embedded && (
                        <div style={{
                            padding: "1rem", background: "rgba(15, 23, 42, 0.95)", borderBottom: "1px solid var(--border)",
                            display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden',
                                    border: `1px solid ${botConfig.color}`
                                }}>
                                    <img src="/bot-icon.png" alt="Bot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{botConfig.name}</span>
                            </div>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
                        </div>
                    )}

                    {/* Messages */}
                    <div style={{ flex: 1, padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {messages.filter(m => !m.content.startsWith('[SISTEMA:')).map((m, i) => (
                            <div key={i} style={{
                                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                                background: m.role === "user" ? "var(--primary)" : "rgba(30, 41, 59, 0.8)",
                                color: m.role === "user" ? "#0f172a" : "var(--foreground)",
                                padding: "0.8rem 1rem", borderRadius: "12px",
                                maxWidth: "85%", fontSize: "0.9rem", lineHeight: "1.4"
                            }}>
                                {m.content}
                            </div>
                        ))}
                        {loading && <div style={{ alignSelf: "flex-start", color: "var(--muted)", fontSize: "0.8rem" }}>Escribiendo...</div>}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div style={{
                        padding: "1rem",
                        borderTop: embedded ? "1px solid rgba(255,255,255,0.05)" : "1px solid var(--border)",
                        display: "flex", gap: "0.8rem", alignItems: 'flex-end',
                        background: embedded ? 'transparent' : 'inherit'
                    }}>
                        <label style={{ cursor: 'pointer', padding: '0.5rem', color: 'var(--muted)', transition: '0.2s', paddingBottom: '0.8rem' }} className="hover-icon">
                            <input type="file" style={{ display: 'none' }} onChange={async (e) => {
                                if (e.target.files?.[0]) {
                                    const file = e.target.files[0];
                                    if (!sessionId) {
                                        alert("Error: No hay sesión activa. Intenta recargar la página.");
                                        return;
                                    }

                                    // 1. Optimistic UI
                                    setMessages(prev => [...prev, { role: "user", content: `📎 Subiendo archivo: ${file.name}...` }]);

                                    try {
                                        // 2. Upload to Supabase Storage
                                        const fileExt = file.name.split('.').pop();
                                        const fileName = `${sessionId}/${Math.random()}.${fileExt}`;
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
                                            body: JSON.stringify({
                                                message: `[SYSTEM: El usuario subió un archivo real: ${file.name} (${publicUrl}). Confirma la recepción.]`,
                                                history: messages,
                                                mode,
                                                sessionId,
                                                lawyerId
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
                            }} accept=".pdf,.jpg,.png,.jpeg,.doc,.docx" />
                            📎
                        </label>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                                placeholder="Escribe tu consulta aquí..."
                                style={{
                                    width: '100%', padding: "1rem", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)",
                                    background: "rgba(15, 23, 42, 0.6)", color: "white", outline: "none",
                                    resize: 'none', height: '54px', fontSize: '0.95rem', fontFamily: 'inherit',
                                    boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.2)'
                                }}
                            />
                        </div>
                        <button onClick={sendMessage} className="btn-primary" style={{
                            width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.2rem', padding: 0
                        }}>➤</button>
                    </div>
                </div>
            )}
        </div>
    );
}
