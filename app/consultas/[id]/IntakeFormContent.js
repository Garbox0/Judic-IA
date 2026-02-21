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
    const [isLightMode, setIsLightMode] = useState(false);
    const pollingRef = useRef(null);
    const uiStateRef = useRef('loading');
    const cidRef = useRef(null);

    // Mantener refs sincronizados con el estado
    useEffect(() => { uiStateRef.current = uiState; }, [uiState]);
    useEffect(() => { cidRef.current = cid; }, [cid]);

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
        if (status === 'rejected') {
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

                if (data.status === 'rejected') {
                    clearInterval(pollingRef.current);
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

            // Actualizar mensajes inmediatamente después de enviar
            const res = await fetch(`/api/intake/messages?cid=${activeCid}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
            }
        } catch (err) {
            console.error('Error al enviar mensaje:', err);
        } finally {
            setSending(false);
        }
    }, [messageInput, sending, id, clientEmail, clientName, clientPhone]);

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
            <div className="error-screen">
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

// ─── Chat anónimo ──────────────────────────────────────────────────────────────

function AnonymousChat({ messages, messageInput, setMessageInput, onSend, sending, messagesEndRef, lawyerName }) {
    const getRoleBubbleClass = (role) => role === 'user' ? 'sent' : 'received';

    const getRoleLabel = (role) => {
        if (role === 'lawyer') return lawyerName || 'Abogado';
        if (role === 'assistant') return 'Asistente IA';
        return null;
    };

    return (
        <div className="chat-widget-inline embedded">
            <div className="chat-messages-area">
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
                        <p>{msg.content}</p>
                        <span className="message-time">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-area" onSubmit={onSend}>
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
            </form>
        </div>
    );
}
