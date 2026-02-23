"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from '../../page.module.css';
import './IntakeFormContent.css';
import '../../components/chat.css';

// Estado de la UI: 'loading' | 'show-form' | 'pending' | 'chat' | 'rejected' | 'restricted'

export default function IntakeFormContent({ id }) {
    const searchParams = useSearchParams();

    const [uiState, setUiState] = useState('loading');
    const [lawyer, setLawyer] = useState(null);
    const [cid, setCid] = useState(null);
    const [clientEmail, setClientEmail] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');

    // Chat
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);

    // UI
    const [isLightMode, setIsLightMode] = useState(true);
    const pollingRef = useRef(null);
    const uiStateRef = useRef('loading');
    const cidRef = useRef(null);

    // Mantener refs sincronizados con el estado
    useEffect(() => { uiStateRef.current = uiState; }, [uiState]);
    useEffect(() => { cidRef.current = cid; }, [cid]);

    // Aplicar light theme por defecto al montar
    useEffect(() => {
        document.body.classList.add('light-theme');
        return () => document.body.classList.remove('light-theme');
    }, []);

    // Scroll al último mensaje
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Inicialización: leer CID desde URL o localStorage
    useEffect(() => {
        if (!id) return;

        async function init() {
            const urlCid = searchParams.get('cid');
            const storedCid = typeof window !== 'undefined'
                ? localStorage.getItem(`judic_ia_cid_${id}`)
                : null;
            const activeCid = urlCid || storedCid;

            // Cargar perfil del abogado siempre
            const lawyerPromise = fetch(`/api/intake/lawyer-profile?id=${id}`)
                .then(r => r.ok ? r.json() : null)
                .catch(() => null);

            if (!activeCid) {
                const lawyerData = await lawyerPromise;
                setLawyer(lawyerData);
                setUiState('show-form');
                return;
            }

            try {
                const [messagesRes, lawyerData] = await Promise.all([
                    fetch(`/api/intake/messages?cid=${activeCid}`),
                    lawyerPromise
                ]);

                setLawyer(lawyerData);

                if (!messagesRes.ok) {
                    // CID inválido o expirado
                    localStorage.removeItem(`judic_ia_cid_${id}`);
                    setUiState('show-form');
                    return;
                }

                const data = await messagesRes.json();

                // Guardar CID y actualizar URL si no estaba
                setCid(activeCid);
                localStorage.setItem(`judic_ia_cid_${id}`, activeCid);
                if (!urlCid) {
                    const url = new URL(window.location.href);
                    url.searchParams.set('cid', activeCid);
                    window.history.replaceState({}, '', url.toString());
                }

                // Restaurar datos del cliente desde la inquiry
                if (data.contact_name) setClientName(data.contact_name);
                if (data.contact_email) setClientEmail(data.contact_email);
                if (data.contact_phone) setClientPhone(data.contact_phone);

                applyStatus(data.status, data.messages || [], activeCid);
            } catch (err) {
                console.error('Error en init:', err);
                setUiState('show-form');
            }
        }

        init();

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [id, searchParams]);

    function applyStatus(status, msgs, activeCid) {
        setMessages(msgs);
        if (status === 'rejected' || status === 'blocked') {
            clearInterval(pollingRef.current);
            // Limpiar CID local al ser bloqueado/rechazado
            if (typeof window !== 'undefined') {
                localStorage.removeItem(`judic_ia_cid_${id}`);
            }
            setUiState('rejected');
        } else if (status === 'pending_review') {
            setUiState('pending');
            startPolling(activeCid);
        } else {
            setUiState('chat');
            startPolling(activeCid);
        }
    }

    function startPolling(activeCid) {
        if (pollingRef.current) clearInterval(pollingRef.current);

        pollingRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/intake/messages?cid=${activeCid}`);
                if (!res.ok) return;

                const data = await res.json();
                setMessages(data.messages || []);

                if (data.status === 'rejected' || data.status === 'blocked') {
                    clearInterval(pollingRef.current);
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem(`judic_ia_cid_${id}`);
                    }
                    setUiState('rejected');
                } else if (uiStateRef.current === 'pending' && data.status !== 'pending_review') {
                    setUiState('chat');
                }
            } catch (err) {
                console.error('Error en polling:', err);
            }
        }, 5000);
    }

    // Envío del formulario de intake anónimo
    const handleFormSubmit = async (formData) => {
        const { firstName, lastName, email, phone, dni, idType } = formData;

        const res = await fetch('/api/intake/anonymous', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lawyerId: id, firstName, lastName, email, phone, dni, idType })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al enviar');

        const newCid = data.cid;

        localStorage.setItem(`judic_ia_cid_${id}`, newCid);
        setCid(newCid);
        setClientEmail(email.toLowerCase().trim());
        setClientName(`${firstName.trim()} ${lastName.trim()}`);
        setClientPhone(phone.trim());

        const url = new URL(window.location.href);
        url.searchParams.set('cid', newCid);
        window.history.replaceState({}, '', url.toString());

        // Usar el status real devuelto por la API (recovery puede ya estar en 'Nuevo')
        const actualStatus = data.status || 'pending_review';
        applyStatus(actualStatus, [], newCid);
    };

    // Envío de mensajes en el chat
    const refreshMessages = useCallback(async () => {
        const activeCid = cidRef.current;
        if (!activeCid) return;
        try {
            const res = await fetch(`/api/intake/messages?cid=${activeCid}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
            }
        } catch (err) {
            console.error('Error al refrescar mensajes:', err);
        }
    }, []);

    const handleSendMessage = useCallback(async (e) => {
        e.preventDefault();
        const activeCid = cidRef.current;
        if (!messageInput.trim() || sending || !activeCid) return;

        const content = messageInput.trim();
        setMessageInput('');
        setSending(true);

        try {
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: content,
                    history: [],
                    mode: 'intake',
                    sessionId: activeCid,
                    lawyerId: id,
                    clientUserId: null,
                    clientEmail,
                    clientName,
                    clientPhone
                })
            });
            await refreshMessages();
        } catch (err) {
            console.error('Error al enviar mensaje:', err);
        } finally {
            setSending(false);
        }
    }, [messageInput, sending, id, clientEmail, clientName, clientPhone, refreshMessages]);

    const toggleTheme = () => {
        setIsLightMode(prev => !prev);
        document.body.classList.toggle('light-theme');
    };

    // ─── Pantallas de estado ───────────────────────────────────────────────────

    if (uiState === 'loading') {
        return <div className="loading-screen">Cargando...</div>;
    }

    if (uiState === 'rejected') {
        return (
            <div className="error-screen" role="alert">
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '440px', borderRadius: '20px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(15,23,42,0.9)' }}>
                    <div style={{ width: '70px', height: '70px', background: 'rgba(239,68,68,0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid rgba(239,68,68,0.3)' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    </div>
                    <h2 style={{ color: '#fbbf24', marginBottom: '1rem', fontFamily: 'Playfair Display, serif' }}>Consulta no disponible</h2>
                    <p style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
                        El profesional no puede atender tu consulta en este momento.
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                        Podés buscar otro profesional en el marketplace.
                    </p>
                    <a href="/abogados" style={{ display: 'inline-block', marginTop: '2rem', padding: '0.75rem 2rem', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', borderRadius: '99px', border: '1px solid rgba(251,191,36,0.3)', textDecoration: 'none', fontSize: '0.9rem' }}>
                        Ver otros abogados
                    </a>
                </div>
            </div>
        );
    }

    // ─── Layout principal ──────────────────────────────────────────────────────

    const lawyerInitial = lawyer?.full_name?.charAt(0) || '?';

    return (
        <main className={`${styles.main} intake-main`}>
            {/* Navbar */}
            <nav className="glass-navbar" style={{ justifyContent: 'space-between' }}>
                <div className="nav-brand">
                    <img src="/judic-ia-mark.png" alt="Logo" className="nav-logo" style={{ height: '32px', width: 'auto' }} />
                    <span className="nav-title">Judic-IA Consultas</span>
                </div>
                <button
                    onClick={toggleTheme}
                    aria-label={isLightMode ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isLightMode ? '#fbbf24' : '#94a3b8', transition: '0.3s' }}
                >
                    {isLightMode ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    )}
                </button>
            </nav>

            <section className="intake-container">
                <div className="unified-card">
                    {/* Panel izquierdo: info del abogado */}
                    <div className="lawyer-side">
                        <div className={`avatar-lg ${lawyer?.avatar_url ? 'has-image' : ''}`}>
                            {lawyer?.avatar_url ? (
                                <img src={lawyer.avatar_url} alt={lawyer.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : lawyerInitial}
                        </div>

                        <h1 className="lawyer-name">{lawyer?.full_name || 'Profesional'}</h1>

                        {lawyer?.matricula && (
                            <span style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', display: 'block' }}>
                                Matrícula: {lawyer.matricula}
                            </span>
                        )}

                        <div className="welcome-text">
                            {uiState === 'show-form' && (
                                <>
                                    <p>👋 <strong>Hola.</strong></p>
                                    <p>Completá tus datos para iniciar una consulta con {lawyer?.full_name || 'el profesional'}.</p>
                                </>
                            )}
                            {uiState === 'pending' && (
                                <>
                                    <p>⏳ <strong>Consulta enviada.</strong></p>
                                    <p>{lawyer?.full_name || 'El profesional'} revisará tu caso y habilitará el chat a la brevedad.</p>
                                    <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', opacity: 0.7 }}>Te enviamos un email con el link de acceso.</p>
                                </>
                            )}
                            {uiState === 'chat' && (
                                <>
                                    <p>💬 <strong>Consulta activa.</strong></p>
                                    <p>Escribí tu consulta y {lawyer?.full_name || 'el profesional'} te responderá personalmente.</p>
                                </>
                            )}
                        </div>

                        {/* Identidad del cliente (cuando tiene sesión) */}
                        {clientEmail && uiState !== 'show-form' && (
                            <div className="user-session">
                                <div className="session-info">
                                    <div className={`status-dot ${uiState === 'pending' ? 'pending-dot' : ''}`} aria-hidden="true"></div>
                                    <span>{clientEmail}</span>
                                </div>
                                {uiState === 'pending' && (
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                        Esperando aprobación...
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Panel derecho: formulario / espera / chat */}
                    <div className="chat-side">
                        {uiState === 'show-form' && (
                            <AnonymousIntakeForm
                                lawyerName={lawyer?.full_name}
                                onSubmit={handleFormSubmit}
                            />
                        )}

                        {uiState === 'pending' && (
                            <PendingScreen />
                        )}

                        {uiState === 'chat' && (
                            <AnonymousChat
                                messages={messages}
                                messageInput={messageInput}
                                setMessageInput={setMessageInput}
                                onSend={handleSendMessage}
                                sending={sending}
                                messagesEndRef={messagesEndRef}
                                lawyerName={lawyer?.full_name}
                                cid={cid}
                                onMessagesRefresh={refreshMessages}
                            />
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}

// ─── Formulario de intake anónimo ─────────────────────────────────────────────

function AnonymousIntakeForm({ lawyerName, onSubmit }) {
    const [form, setForm] = useState({
        firstName: '', lastName: '', email: '', phone: '', dni: '', idType: 'DNI'
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await onSubmit(form);
        } catch (err) {
            setError(err.message || 'Ocurrió un error. Intentá de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="intake-form-wrapper">
            <div className="intake-form-header">
                <h2>Iniciá tu consulta</h2>
                <p>Completá tus datos para contactar a {lawyerName || 'el profesional'}.</p>
            </div>

            <form onSubmit={handleSubmit} className="intake-form" noValidate>
                <div className="intake-row">
                    <div className="intake-field">
                        <label htmlFor="firstName">Nombre <span aria-hidden="true">*</span></label>
                        <input
                            id="firstName"
                            name="firstName"
                            type="text"
                            autoComplete="given-name"
                            required
                            maxLength={80}
                            value={form.firstName}
                            onChange={handleChange}
                            placeholder="Tu nombre"
                        />
                    </div>
                    <div className="intake-field">
                        <label htmlFor="lastName">Apellido <span aria-hidden="true">*</span></label>
                        <input
                            id="lastName"
                            name="lastName"
                            type="text"
                            autoComplete="family-name"
                            required
                            maxLength={80}
                            value={form.lastName}
                            onChange={handleChange}
                            placeholder="Tu apellido"
                        />
                    </div>
                </div>

                <div className="intake-field">
                    <label htmlFor="email">Email <span aria-hidden="true">*</span></label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={200}
                        value={form.email}
                        onChange={handleChange}
                        placeholder="tu@email.com"
                    />
                </div>

                <div className="intake-field">
                    <label htmlFor="phone">Teléfono <span aria-hidden="true">*</span></label>
                    <input
                        id="phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        maxLength={30}
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="+54 11 1234-5678"
                    />
                </div>

                <div className="intake-row">
                    <div className="intake-field intake-field-sm">
                        <label htmlFor="idType">Documento</label>
                        <select id="idType" name="idType" value={form.idType} onChange={handleChange}>
                            <option value="DNI">DNI</option>
                            <option value="CUIL">CUIL</option>
                            <option value="CUIT">CUIT</option>
                        </select>
                    </div>
                    <div className="intake-field" style={{ flex: 2 }}>
                        <label htmlFor="dni">Número (opcional)</label>
                        <input
                            id="dni"
                            name="dni"
                            type="text"
                            maxLength={20}
                            value={form.dni}
                            onChange={handleChange}
                            placeholder="20123456"
                        />
                    </div>
                </div>

                {error && (
                    <div className="intake-error" role="alert">
                        {error}
                    </div>
                )}

                <button type="submit" className="btn-intake-submit" disabled={submitting}>
                    {submitting ? 'Enviando...' : 'Iniciar consulta'}
                </button>

                <p className="intake-privacy">
                    Tus datos son confidenciales y solo serán compartidos con el profesional seleccionado.
                </p>
                <p className="intake-recovery-hint">
                    ¿Ya iniciaste una consulta? Ingresá el mismo email para recuperar el acceso.
                </p>
            </form>
        </div>
    );
}

// ─── Pantalla de espera ────────────────────────────────────────────────────────

function PendingScreen() {
    return (
        <div className="pending-screen" role="status" aria-live="polite">
            <div className="pending-icon" aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
            </div>
            <h3>Consulta recibida</h3>
            <p>El profesional revisará tu caso y habilitará el chat a la brevedad.</p>
            <p className="pending-hint">Esta pantalla se actualizará automáticamente.</p>
            <div className="pending-dots" aria-hidden="true">
                <span></span><span></span><span></span>
            </div>
        </div>
    );
}

// ─── Helpers de adjuntos ───────────────────────────────────────────────────────

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

// ─── Chat anónimo ──────────────────────────────────────────────────────────────

function AnonymousChat({ messages, messageInput, setMessageInput, onSend, sending, messagesEndRef, lawyerName, cid, onMessagesRefresh }) {
    const [isDragging, setIsDragging] = useState(false);

    // Compose panel state
    const [pendingFile, setPendingFile] = useState(null);
    const [pendingCaption, setPendingCaption] = useState('');
    const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);

    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const fileInputRef = useRef(null);

    // Generate preview URL for file
    useEffect(() => {
        if (!pendingFile) { setPendingPreviewUrl(null); return; }
        if (isImageFile(pendingFile.name) || isVideoFile(pendingFile.name) || isAudioFile(pendingFile.name)) {
            const url = URL.createObjectURL(pendingFile);
            setPendingPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setPendingPreviewUrl(null);
    }, [pendingFile]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearInterval(recordingTimerRef.current);
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const getRoleBubbleClass = (role) => role === 'user' ? 'sent' : 'received';
    const getRoleLabel = (role) => {
        if (role === 'lawyer') return lawyerName || 'Abogado';
        if (role === 'assistant') return 'Asistente IA';
        return null;
    };
    const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const formatMsgTime = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
        const msgDay = new Date(date); msgDay.setHours(0, 0, 0, 0);
        if (msgDay.getTime() === today.getTime()) return `Hoy · ${time}`;
        if (msgDay.getTime() === yesterday.getTime()) return `Ayer · ${time}`;
        return `${date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} · ${time}`;
    };

    // Edit message state
    const [editingMsgId, setEditingMsgId] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    const startEdit = (msg) => { setEditingMsgId(msg.id); setEditingContent(msg.content); };
    const cancelEdit = () => { setEditingMsgId(null); setEditingContent(''); };

    const saveEdit = async (msgId) => {
        if (!editingContent.trim() || savingEdit || !cid) return;
        setSavingEdit(true);
        try {
            const res = await fetch('/api/chat/edit-message', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: msgId, content: editingContent.trim(), cid }),
            });
            if (res.ok) {
                const { message: updated } = await res.json();
                // Update message in the messages array (via onMessagesRefresh or local patch)
                await onMessagesRefresh();
                cancelEdit();
            }
        } catch (err) {
            console.error('[edit]', err);
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) { setPendingFile(file); setPendingCaption(''); setUploadError(null); }
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) { setPendingFile(file); setPendingCaption(''); setUploadError(null); }
    };

    const handleSendCompose = async () => {
        if (!pendingFile || isUploading || !cid) return;
        setIsUploading(true);
        setUploadError(null);
        try {
            const form = new FormData();
            form.append('file', pendingFile);
            form.append('inquiryId', cid);
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
            await onMessagesRefresh();
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

    return (
        <div
            className="chat-widget-inline embedded"
            style={{ position: 'relative' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="chat-drop-overlay" aria-live="assertive" aria-atomic="true">
                    <span>Soltá el archivo para adjuntarlo</span>
                </div>
            )}

            <div
                className="chat-messages-area"
                role="log"
                aria-live="polite"
                aria-label="Historial de mensajes"
            >
                {messages.length === 0 && (
                    <div className="message-bubble received welcome-msg">
                        <p>Bienvenido. Escribí tu consulta y {lawyerName || 'el profesional'} te responderá a la brevedad.</p>
                        <span className="message-time">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                )}

                {messages.map(msg => (
                    <div key={msg.id} className={`message-bubble ${getRoleBubbleClass(msg.role)}`}>
                        {getRoleLabel(msg.role) && (
                            <span className={`msg-role-tag ${msg.role === 'lawyer' ? 'lawyer-tag' : 'assistant-tag'}`}>
                                {getRoleLabel(msg.role)}
                            </span>
                        )}
                        {/* Edit button for client's own text messages */}
                        {msg.role === 'user' && !msg.attachment_url && editingMsgId !== msg.id && (
                            <button className="msg-edit-btn" onClick={() => startEdit(msg)} aria-label="Editar mensaje" title="Editar">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
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
                                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="btn-download-file" aria-label={`Abrir ${msg.attachment_name || 'archivo'} en nueva ventana`}>Abrir</a>
                                    )}
                                    <button className="btn-download-file" onClick={() => downloadFile(msg.attachment_url, msg.attachment_name)} aria-label={`Descargar ${msg.attachment_name || 'archivo'}`}>↓ Descargar</button>
                                </div>
                            </div>
                        ) : editingMsgId === msg.id ? (
                            <div className="msg-edit-row">
                                <input
                                    className="msg-edit-input"
                                    value={editingContent}
                                    onChange={e => setEditingContent(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(msg.id); } if (e.key === 'Escape') cancelEdit(); }}
                                    autoFocus
                                    maxLength={5000}
                                    aria-label="Editar mensaje"
                                />
                                <button className="msg-edit-save" onClick={() => saveEdit(msg.id)} disabled={savingEdit || !editingContent.trim()}>Guardar</button>
                                <button className="msg-edit-cancel" onClick={cancelEdit}>Cancelar</button>
                            </div>
                        ) : (
                            <p>{msg.content}{msg.edited_at && <span className="msg-edited-tag">(editado)</span>}</p>
                        )}
                        <span className="message-time">
                            {formatMsgTime(msg.created_at)}
                        </span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Compose panel: file preview before sending */}
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
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
                            {isUploading ? 'Enviando...' : 'Enviar'}
                        </button>
                    </div>
                    {uploadError && (
                        <div className="chat-upload-error" role="alert" aria-live="assertive">{uploadError}</div>
                    )}
                </div>
            )}

            <form className="chat-input-area" onSubmit={onSend}>
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
                                placeholder="Escribí tu mensaje..."
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                disabled={sending}
                                maxLength={5000}
                                aria-label="Escribí tu mensaje"
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
                                disabled={!!pendingFile}
                                title="Adjuntar archivo"
                                aria-label="Adjuntar archivo"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                            </button>
                            <button
                                type="button"
                                className="chat-mic-btn"
                                onClick={startRecording}
                                disabled={!!pendingFile}
                                aria-label="Grabar audio"
                                title="Grabar nota de voz"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                            </button>
                            <button
                                type="submit"
                                className="chat-send-btn"
                                disabled={sending || !messageInput.trim()}
                                aria-label="Enviar mensaje"
                            >
                                {sending ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </form>
        </div>
    );
}
