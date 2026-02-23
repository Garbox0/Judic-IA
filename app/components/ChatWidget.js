"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader, Paperclip, Mic, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './chat.css';

function isImageFile(name) {
    return /\.(jpg|jpeg|png|webp)$/i.test(name || '');
}

function isAudioFile(name) {
    return /\.(mp3|webm|ogg|m4a)$/i.test(name || '');
}

function isVideoFile(name) {
    return /\.(mp4|mov)$/i.test(name || '');
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
    const [uploadError, setUploadError] = useState(null);

    // Compose panel state
    const [pendingFile, setPendingFile] = useState(null);
    const [pendingCaption, setPendingCaption] = useState('');
    const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);

    const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    // Preview URL for pending file
    useEffect(() => {
        if (!pendingFile) { setPendingPreviewUrl(null); return; }
        if (isImageFile(pendingFile.name) || isVideoFile(pendingFile.name) || isAudioFile(pendingFile.name)) {
            const url = URL.createObjectURL(pendingFile);
            setPendingPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setPendingPreviewUrl(null);
    }, [pendingFile]);

    // Cleanup recording on unmount
    useEffect(() => {
        return () => {
            clearInterval(recordingTimerRef.current);
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

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

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) { setPendingFile(file); setPendingCaption(''); setUploadError(null); }
    };

    const handleSendCompose = async () => {
        if (!pendingFile || isUploading || !sessionId) return;
        setUploadError(null);
        setIsUploading(true);
        try {
            const form = new FormData();
            form.append('file', pendingFile);
            form.append('inquiryId', sessionId);
            form.append('role', 'user');
            if (pendingCaption.trim()) form.append('caption', pendingCaption.trim());

            const res = await fetch('/api/chat/upload', { method: 'POST', body: form });
            if (!res.ok) {
                if (res.status === 413) {
                    setUploadError('El archivo es demasiado grande para enviar.');
                } else {
                    const data = await res.json().catch(() => ({}));
                    setUploadError(data.error || 'Error al subir el archivo.');
                }
                return;
            }
            setPendingFile(null);
            setPendingCaption('');
            // Message appears via Realtime
        } catch {
            setUploadError('Error de conexión al subir el archivo.');
        } finally {
            setIsUploading(false);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream);
            audioChunksRef.current = [];
            mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mr.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                clearInterval(recordingTimerRef.current);
                const mimeType = mr.mimeType || 'audio/webm';
                const blob = new Blob(audioChunksRef.current, { type: mimeType });
                const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm';
                const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mimeType });
                setPendingFile(file);
                setPendingCaption('');
                setUploadError(null);
                setIsRecording(false);
            };
            mr.start();
            mediaRecorderRef.current = mr;
            setIsRecording(true);
            setRecordingSeconds(0);
            recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
        } catch (err) {
            console.error('No se pudo acceder al micrófono:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
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
            <div className="chat-messages-area" aria-live="polite" role="log" aria-label="Historial de mensajes">
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
                                        alt={msg.attachment_name || 'Imagen adjunta'}
                                        className="msg-img-preview"
                                        onClick={() => window.open(msg.attachment_url, '_blank')}
                                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && window.open(msg.attachment_url, '_blank')}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`Ver imagen ${msg.attachment_name || 'adjunta'}`}
                                    />
                                ) : isAudioFile(msg.attachment_name) ? (
                                    <audio controls src={msg.attachment_url} className="msg-audio-player" aria-label={`Reproducir audio: ${msg.attachment_name || 'adjunto'}`} />
                                ) : isVideoFile(msg.attachment_name) ? (
                                    <video controls src={msg.attachment_url} className="msg-video-player" preload="metadata" aria-label={`Reproducir video: ${msg.attachment_name || 'adjunto'}`} />
                                ) : (
                                    <div className="msg-file-card">
                                        <div
                                            className="msg-file-ext-badge"
                                            style={{ background: getFileColor(getFileExt(msg.attachment_name)) }}
                                            aria-hidden="true"
                                        >
                                            {getFileExt(msg.attachment_name).toUpperCase()}
                                        </div>
                                        <span className="msg-file-name">{msg.attachment_name || 'Archivo adjunto'}</span>
                                    </div>
                                )}
                                {msg.content && !msg.content.startsWith('📎') && (
                                    <p className="msg-caption">{msg.content}</p>
                                )}
                                <div className="msg-file-actions">
                                    {!isImageFile(msg.attachment_name) && !isAudioFile(msg.attachment_name) && !isVideoFile(msg.attachment_name) && (
                                        <a
                                            href={msg.attachment_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-download-file"
                                            aria-label={`Abrir ${msg.attachment_name || 'archivo'} en nueva ventana`}
                                        >
                                            Abrir
                                        </a>
                                    )}
                                    <button
                                        className="btn-download-file"
                                        onClick={() => downloadFile(msg.attachment_url, msg.attachment_name)}
                                        aria-label={`Descargar ${msg.attachment_name || 'archivo'}`}
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

            {/* Compose panel */}
            {pendingFile && (
                <div className="compose-panel">
                    <div className="compose-preview-row">
                        {isImageFile(pendingFile.name) && pendingPreviewUrl ? (
                            <img src={pendingPreviewUrl} alt="Vista previa" className="compose-thumb" />
                        ) : isVideoFile(pendingFile.name) && pendingPreviewUrl ? (
                            <video src={pendingPreviewUrl} className="compose-thumb" muted aria-hidden="true" />
                        ) : (
                            <div className="compose-file-icon">
                                {isAudioFile(pendingFile.name) ? (
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                )}
                                <span className="compose-file-ext">{getFileExt(pendingFile.name)}</span>
                            </div>
                        )}
                        <div className="compose-file-details">
                            <span className="compose-filename">{pendingFile.name}</span>
                            <span className="compose-filesize">{(pendingFile.size / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                        <button
                            type="button"
                            className="compose-cancel-btn"
                            onClick={() => { setPendingFile(null); setPendingCaption(''); setUploadError(null); }}
                            aria-label="Cancelar adjunto"
                        >
                            <X size={15} aria-hidden="true" />
                        </button>
                    </div>
                    <div className="compose-caption-row">
                        <input
                            type="text"
                            className="compose-caption-input"
                            placeholder="Agregar descripción (opcional)..."
                            value={pendingCaption}
                            onChange={(e) => setPendingCaption(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendCompose(); } }}
                            maxLength={500}
                            aria-label="Descripción del archivo"
                            autoFocus
                        />
                        <button
                            type="button"
                            className="compose-send-btn"
                            onClick={handleSendCompose}
                            disabled={isUploading}
                            aria-label="Enviar archivo"
                        >
                            {isUploading ? <Loader size={16} className="animate-spin" /> : 'Enviar'}
                        </button>
                    </div>
                    {uploadError && (
                        <div className="chat-upload-error" role="alert" aria-live="assertive">{uploadError}</div>
                    )}
                </div>
            )}

            {/* Input Area */}
            <form className="chat-input-area" onSubmit={handleSendMessage}>
                <div className="chat-input-row">
                    {isRecording ? (
                        <>
                            <div className="recording-bar" role="status" aria-live="polite" aria-label={`Grabando: ${formatTime(recordingSeconds)}`}>
                                <span className="recording-dot" aria-hidden="true" />
                                <span className="recording-time">{formatTime(recordingSeconds)}</span>
                                <span className="recording-label">Grabando audio...</span>
                            </div>
                            <button
                                type="button"
                                className="recording-stop-btn"
                                onClick={stopRecording}
                                aria-label="Detener grabación"
                            >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><rect width="10" height="10" rx="2"/></svg>
                            </button>
                        </>
                    ) : (
                        <>
                            <input
                                type="text"
                                className="chat-input"
                                placeholder="Escribe tu mensaje..."
                                aria-label="Escribir mensaje"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                disabled={sending || !sessionId}
                            />
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="sr-only"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mp3,.webm,.ogg,.m4a,.docx,.txt"
                                onChange={handleFileChange}
                                aria-label="Adjuntar archivo"
                            />
                            <button
                                type="button"
                                className="chat-attach-btn"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!!pendingFile || !sessionId}
                                title="Adjuntar archivo"
                                aria-label="Adjuntar archivo"
                            >
                                <Paperclip size={16} />
                            </button>
                            <button
                                type="button"
                                className="chat-mic-btn"
                                onClick={startRecording}
                                disabled={!!pendingFile || !sessionId}
                                title="Grabar nota de voz"
                                aria-label="Grabar audio"
                            >
                                <Mic size={16} />
                            </button>
                            <button
                                type="submit"
                                className="chat-send-btn"
                                aria-label="Enviar mensaje"
                                disabled={sending || !messageInput.trim() || !sessionId}
                            >
                                {sending ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                            </button>
                        </>
                    )}
                </div>
            </form>
        </div>
    );
}
