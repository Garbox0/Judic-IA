"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader, Paperclip } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './chat.css';

function isImageFile(name) {
    return /\.(jpg|jpeg|png|webp)$/i.test(name || '');
}

function isAudioFile(name) {
    return /\.(mp3)$/i.test(name || '');
}

function isVideoFile(name) {
    return /\.(mp4)$/i.test(name || '');
}

function getFileExt(name) {
    const m = (name || '').match(/\.(\w+)$/);
    return m ? m[1].toLowerCase() : 'file';
}

function getFileColor(ext) {
    return { pdf: '#ef4444', docx: '#3b82f6', mp4: '#10b981', mp3: '#8b5cf6', txt: '#64748b' }[ext] || '#6b7280';
}

async function downloadFile(url, name) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name || 'archivo';
        a.click();
        URL.revokeObjectURL(a.href);
    } catch {
        window.open(url, '_blank');
    }
}

export default function ChatWidget({
    mode = 'intake',
    lawyerId,
    embedded = false,
    initialMessage,
    clientEmail,
    clientUserId,
    clientName,
    clientPhone,
    lawyerSpecialties,
    lawyerAvatar
}) {
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [sending, setSending] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [initialized, setInitialized] = useState(false);
    const messagesEndRef = useRef(null);
    const channelRef = useRef(null);
    const fileInputRef = useRef(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadError, setUploadError] = useState(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // 1. INITIALIZE: Load history & sync session
    useEffect(() => {
        if (!lawyerId || !clientUserId || initialized) return;

        async function initChat() {
            // Get CID from URL if available
            const params = new URLSearchParams(window.location.search);
            const cid = params.get('cid');

            if (!cid) {
                console.warn("ChatWidget: No CID found in URL");
                setInitialized(true);
                return;
            }

            setSessionId(cid);

            // Sync session (upsert inquiry + link client)
            try {
                const syncRes = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: `[SISTEMA: Cliente conectado: ${clientEmail}]`,
                        history: [],
                        mode: 'intake',
                        sessionId: cid,
                        lawyerId,
                        clientUserId,
                        clientEmail,
                        clientName,
                        clientPhone,
                        lawyerSpecialties,
                        syncOnly: true
                    }),
                });

                const syncData = await syncRes.json();
                const effectiveId = syncData.sessionId || cid;
                setSessionId(effectiveId);

                // Load existing chat history
                const historyRes = await fetch(`/api/chat?sessionId=${effectiveId}`);
                const historyData = await historyRes.json();

                if (historyData.history && historyData.history.length > 0) {
                    const filtered = historyData.history.filter(
                        m => !m.content.startsWith('[SISTEMA:') && !m.content.startsWith('[SYSTEM:')
                    );
                    setMessages(filtered);
                }
            } catch (err) {
                console.error("ChatWidget init error:", err);
            }

            setInitialized(true);
        }

        initChat();
    }, [lawyerId, clientUserId, clientEmail, clientName, clientPhone, lawyerSpecialties, initialized]);

    // 2. REALTIME: Subscribe to new messages
    useEffect(() => {
        if (!sessionId) return;

        const channel = supabase.channel(`chat-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `inquiry_id=eq.${sessionId}`
                },
                (payload) => {
                    const newMsg = payload.new;
                    // Skip system messages
                    if (newMsg.content.startsWith('[SISTEMA:') || newMsg.content.startsWith('[SYSTEM:')) return;

                    setMessages(prev => {
                        if (prev.find(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionId]);

    // 3. SEND MESSAGE
    const handleSendMessage = useCallback(async (e) => {
        e.preventDefault();
        if (!messageInput.trim() || sending || !sessionId) return;

        const content = messageInput.trim();
        setMessageInput('');
        setSending(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: content,
                    history: [],
                    mode: 'intake',
                    sessionId,
                    lawyerId,
                    clientUserId,
                    clientEmail,
                    clientName,
                    clientPhone
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                console.error("Send error:", errData);
            }
            // Message will appear via Realtime subscription
        } catch (err) {
            console.error("Send failed:", err);
        } finally {
            setSending(false);
        }
    }, [messageInput, sending, sessionId, lawyerId, clientUserId, clientEmail, clientName, clientPhone]);

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !sessionId) return;
        e.target.value = '';

        setUploadError(null);
        setUploadingFile(true);
        try {
            const form = new FormData();
            form.append('file', file);
            form.append('inquiryId', sessionId);
            form.append('role', 'user');

            const res = await fetch('/api/chat/upload', {
                method: 'POST',
                body: form,
            });
            const data = await res.json();
            if (!res.ok) {
                setUploadError(data.error || 'Error al subir el archivo.');
            }
            // El mensaje aparece por Realtime
        } catch {
            setUploadError('Error de conexión al subir el archivo.');
        } finally {
            setUploadingFile(false);
        }
    };

    const getRoleLabel = (role) => {
        if (role === 'user') return 'Tú';
        if (role === 'lawyer') return 'Abogado';
        if (role === 'assistant') return 'Asistente';
        return role;
    };

    const getRoleBubbleClass = (role) => {
        if (role === 'user') return 'sent';
        return 'received';
    };

    // Don't render anything if we have no lawyer context (e.g. SafeChatWidget in dashboard layout)
    if (!lawyerId || !clientUserId) return null;

    return (
        <div className={`chat-widget-inline ${embedded ? 'embedded' : ''}`}>
            {/* Messages Area */}
            <div className="chat-messages-area">
                {/* Welcome message if no history */}
                {messages.length === 0 && initialized && (
                    <div className="message-bubble received welcome-msg">
                        <p>{initialMessage || 'Bienvenido. Escriba su consulta y un profesional le responderá a la brevedad.'}</p>
                        <span className="message-time">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                )}

                {messages.map(msg => (
                    <div key={msg.id} className={`message-bubble ${getRoleBubbleClass(msg.role)}`}>
                        {msg.role === 'lawyer' && (
                            <span className="msg-role-tag lawyer-tag">Abogado</span>
                        )}
                        {msg.role === 'assistant' && (
                            <span className="msg-role-tag assistant-tag">Asistente IA</span>
                        )}
                        {msg.attachment_url ? (
                            <div className="msg-attachment-wrap">
                                {isImageFile(msg.attachment_name) ? (
                                    <img
                                        src={msg.attachment_url}
                                        alt={msg.attachment_name}
                                        className="msg-img-preview"
                                        onClick={() => window.open(msg.attachment_url, '_blank')}
                                    />
                                ) : isAudioFile(msg.attachment_name) ? (
                                    <audio controls className="msg-audio-player">
                                        <source src={msg.attachment_url} type="audio/mpeg" />
                                    </audio>
                                ) : isVideoFile(msg.attachment_name) ? (
                                    <video controls className="msg-video-player">
                                        <source src={msg.attachment_url} type="video/mp4" />
                                    </video>
                                ) : (
                                    <div className="msg-file-card">
                                        <div
                                            className="msg-file-ext-badge"
                                            style={{ background: getFileColor(getFileExt(msg.attachment_name)) }}
                                        >
                                            {getFileExt(msg.attachment_name).toUpperCase()}
                                        </div>
                                        <span className="msg-file-name">{msg.attachment_name || 'Archivo adjunto'}</span>
                                    </div>
                                )}
                                <div className="msg-file-actions">
                                    {!isImageFile(msg.attachment_name) && !isAudioFile(msg.attachment_name) && !isVideoFile(msg.attachment_name) && (
                                        <a
                                            href={msg.attachment_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-download-file"
                                        >
                                            Abrir
                                        </a>
                                    )}
                                    <button
                                        className="btn-download-file"
                                        onClick={() => downloadFile(msg.attachment_url, msg.attachment_name)}
                                    >
                                        ↓ Descargar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p>{msg.content}</p>
                        )}
                        <span className="message-time">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form className="chat-input-area" onSubmit={handleSendMessage}>
                {uploadError && (
                    <div className="chat-upload-error">{uploadError}</div>
                )}
                <div className="chat-input-row">
                    <input
                        type="text"
                        className="chat-input"
                        placeholder="Escribe tu mensaje..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        disabled={sending || !sessionId}
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="sr-only"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mp3,.docx,.txt"
                        onChange={handleFileUpload}
                        aria-label="Adjuntar archivo"
                    />
                    <button
                        type="button"
                        className="chat-attach-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFile || !sessionId}
                        title="Adjuntar archivo (PDF, imagen, DOCX — máx. 10 MB)"
                        aria-label="Adjuntar archivo"
                    >
                        {uploadingFile ? <Loader size={16} className="animate-spin" /> : <Paperclip size={16} />}
                    </button>
                    <button
                        type="submit"
                        className="chat-send-btn"
                        disabled={sending || !messageInput.trim() || !sessionId}
                    >
                        {sending ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
            </form>
        </div>
    );
}
