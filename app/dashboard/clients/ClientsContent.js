"use client";
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { demoClients } from '../../lib/demoData';
import {
    Inbox,
    Trash2,
    ArrowLeft,
    AlertTriangle,
    X,
    Loader,
    Folder,
    PartyPopper,
    Check,
    Send,
    MoreVertical,
    Search,
    Globe,
    ShieldCheck,
    Clock,
    ShieldAlert,
    AlertCircle,
    Settings
} from 'lucide-react';
import './clients.css';

export default function ClientsPage({ isDemo = false, basePath = '/dashboard' }) {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lawyerId, setLawyerId] = useState(null);
    const [selectedClient, setSelectedClient] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [loadingChat, setLoadingChat] = useState(false);
    const [copied, setCopied] = useState(false);
    const [clientToDelete, setClientToDelete] = useState(null);
    const [conversionSuccess, setConversionSuccess] = useState(false);
    const [showDetails, setShowDetails] = useState(false); // Sidebar closed by default on desktop
    const [attachments, setAttachments] = useState([]);

    // Lawyer Reply State
    const [replyInput, setReplyInput] = useState('');
    const [sendingReply, setSendingReply] = useState(false);

    // Case Conversion State
    const [converting, setConverting] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState(null);

    // Refs for scrolling
    const messagesEndRef = useRef(null);

    // 1. INITIAL FETCH & AUTH
    useEffect(() => {
        const init = async () => {
            if (isDemo) {
                setLawyerId('demo-lawyer-id');
                setClients(demoClients);
                setLoading(false);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setLawyerId(user.id);

                // 🛡️ Admin Verification Bypass
                const isAdmin = user.id === '365cd259-4f1e-4004-a677-1eda06a5147e' || user.email === 'gbrlescalada@gmail.com';

                if (isAdmin) {
                    setVerificationStatus('verified');
                } else {
                    const { data: profile } = await supabase.from('profiles').select('verification_status').eq('id', user.id).single();
                    setVerificationStatus(profile?.verification_status || 'none');
                }

                // FETCH CLIENTS ORDERED BY ACTIVITY
                const { data, error } = await supabase
                    .from('inquiries')
                    .select('*')
                    .eq('assigned_lawyer_id', user.id)
                    .neq('status', 'link_generated')
                    .neq('source', 'manual')
                    // NEW: Order by last_message_at (most recent first), fall back to created_at
                    .order('last_message_at', { ascending: false, nullsFirst: false })
                    .order('created_at', { ascending: false });

                if (error) console.error("❌ Error fetching inquiries:", error);
                if (!error) setClients(data || []);
            }
            setLoading(false);
        };
        init();
    }, [isDemo]);

    // 2. REALTIME SUBSCRIPTION
    useEffect(() => {
        if (!lawyerId || isDemo) return;

        const channel = supabase.channel('realtime-clients-inbox')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'inquiries', filter: `assigned_lawyer_id=eq.${lawyerId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        if (payload.new.status !== 'link_generated') {
                            setClients(prev => [payload.new, ...prev]);
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        // If updated (e.g. new message timestamp), move to top
                        setClients(prev => {
                            const filtered = prev.filter(c => c.id !== payload.new.id);
                            return [payload.new, ...filtered];
                        });

                        // Update selected client if active
                        setSelectedClient(prev => (prev && prev.id === payload.new.id) ? payload.new : prev);
                    } else if (payload.eventType === 'DELETE') {
                        setClients(prev => prev.filter(c => c.id !== payload.old.id));
                        setSelectedClient(prev => (prev && prev.id === payload.old.id) ? null : prev);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [lawyerId, isDemo]);

    // 3. CHAT SUBSCRIPTION
    useEffect(() => {
        if (!selectedClient || isDemo) return;

        const channel = supabase.channel(`realtime-chat-${selectedClient.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `inquiry_id=eq.${selectedClient.id}` },
                (payload) => {
                    setChatHistory(prev => {
                        if (prev.find(m => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new];
                    });
                    scrollToBottom();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedClient?.id, isDemo]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory]);

    const selectClient = async (client) => {
        if (selectedClient?.id === client.id) return;
        setSelectedClient(client);
        setLoadingChat(true); // Show loader immediately

        // Mobile: Scroll to top of page to show full chat
        if (window.innerWidth < 768) {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }

        if (isDemo) {
            setTimeout(() => {
                setChatHistory([
                    { id: 1, role: 'assistant', content: 'Resumen del caso: Cliente consulta por accidente laboral.', created_at: new Date().toISOString() },
                    { id: 2, role: 'user', content: 'Hola, quería consultar sobre mi caso.', created_at: new Date().toISOString() }
                ]);
                setLoadingChat(false);
            }, 500);
            return;
        }

        // Fetch Messages
        const { data: msgs, error } = await supabase
            .from('messages')
            .select('*')
            .eq('inquiry_id', client.id)
            .order('created_at', { ascending: true });

        if (!error) {
            setChatHistory(msgs);
            setLoadingChat(false);
            scrollToBottom();
        }

        // Fetch Attachments
        const { data: files } = await supabase
            .from('attachments')
            .select('*')
            .eq('inquiry_id', client.id)
            .order('created_at', { ascending: false });

        setAttachments(files || []);
    };

    const sendLawyerReply = async (e) => {
        e.preventDefault();
        if (!replyInput.trim() || sendingReply || !selectedClient) return;

        if (isDemo) {
            const mockMsg = {
                id: Date.now(),
                inquiry_id: selectedClient.id,
                role: 'lawyer',
                content: replyInput.trim(),
                created_at: new Date().toISOString()
            };
            setChatHistory(prev => [...prev, mockMsg]);
            setReplyInput('');
            scrollToBottom();
            return;
        }

        setSendingReply(true);
        try {
            const res = await fetch("/api/chat/reply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    inquiryId: selectedClient.id,
                    message: replyInput.trim()
                })
            });

            if (!res.ok) throw new Error("Error mensaje");
            setReplyInput('');
            // Realtime adds the message
        } catch (err) {
            console.error(err);
        } finally {
            setSendingReply(false);
        }
    };

    const convertToCase = async () => {
        if (!selectedClient || isDemo) return;
        setConverting(true);
        try {
            const res = await fetch("/api/cases/convert", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inquiryId: selectedClient.id, lawyerId })
            });
            if (res.ok) {
                setConversionSuccess(true);
                setSelectedClient(prev => ({ ...prev, is_case: true }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setConverting(false);
        }
    };

    // --- RENDER HELPERS ---

    // Format relative time (e.g. "14:30", "Ayer", "12/05")
    const formatTime = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diffDays === 1) return 'Ayer';
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    };

    // 🔒 FULL BLOCK for unverified lawyers
    if (!isDemo && verificationStatus && verificationStatus !== 'verified') {
        const isRejected = verificationStatus === 'rejected';
        const isPending = verificationStatus === 'pending';
        return (
            <div className="clients-page-wrapper">
                <div className="breadcrumb clients-breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Clientes</span>
                </div>
                <div className="clients-restricted-container">
                    <div className="clients-restricted-icon-box">
                        {isRejected ? <AlertCircle size={40} /> : isPending ? <ShieldCheck size={40} /> : <ShieldAlert size={40} />}
                    </div>
                    <h1 className="dashboard-page-title">
                        {isRejected ? 'Matrícula No Verificada' : isPending ? 'Verificación Necesaria' : 'Perfil Incompleto'}
                    </h1>
                    <p className="clients-restricted-desc">
                        {isRejected
                            ? 'No pudimos validar tu matrícula profesional. Revisá tus datos en Ajustes para corregir la información.'
                            : isPending
                            ? 'Para acceder a la Bandeja de Clientes, tu matrícula profesional debe ser verificada por nuestro equipo técnico.'
                            : 'Completá tu información profesional en Ajustes para poder recibir y gestionar consultas de clientes.'}
                    </p>
                    <div className="clients-restricted-status-box">
                        <h4 className="clients-restricted-status-title">
                            <Clock size={16} className="text-amber-400" />
                            Estado actual: {isRejected ? 'Rechazada' : isPending ? 'Pendiente de Revisión' : 'Acción Requerida'}
                        </h4>
                        <p className="clients-restricted-status-msg">
                            {isRejected
                                ? 'Verificá que tu número de matrícula y jurisdicción sean correctos.'
                                : isPending
                                ? 'Estamos validando tus credenciales con los colegios públicos correspondientes. Te notificaremos vía email cuando tu acceso sea habilitado.'
                                : 'Necesitás completar tu matrícula y jurisdicción para iniciar el proceso de verificación.'}
                        </p>
                    </div>
                    <div className="clients-restricted-btn-wrapper">
                        <a href="/dashboard/settings?tab=profile" className="clients-action-btn-gold">
                            <Settings size={16} />
                            {isRejected ? 'Corregir Datos' : isPending ? 'Ver Estado de Mi Perfil' : 'Completar Perfil'}
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="clients-page-wrapper">
            {/* BREADCRUMB */}
            <div className="breadcrumb clients-breadcrumb">
                <Link href={isDemo ? basePath : "/dashboard"} className="breadcrumb-item">Gabinete</Link>
                <span className="breadcrumb-separator">/</span>
                <span className="breadcrumb-current">Clientes</span>
            </div>

            {/* SPLIT LAYOUT CONTAINER */}
            <div className={`clients-split-container ${selectedClient ? 'chat-active' : 'list-active'}`}>

                {/* 1. LEFT PANEL: INBOX LIST */}
                <aside className="inbox-list-panel">
                    <div className="inbox-header">
                        <h1 className="inbox-title">Mensajes</h1>
                        <div className="inbox-actions">
                            <button className="btn-icon-ghost" title="Buscar"><Search size={18} /></button>
                        </div>
                    </div>


                    <div className="inbox-list">
                        {loading ? (
                            <div className="inbox-loader"><Loader className="animate-spin" /></div>
                        ) : clients.length === 0 ? (
                            <div className="inbox-empty">
                                <Inbox size={32} />
                                <p>No hay consultas aún.</p>
                            </div>
                        ) : (
                            clients.map(client => (
                                <div
                                    key={client.id}
                                    className={`inbox-item ${selectedClient?.id === client.id ? 'active' : ''}`}
                                    onClick={() => selectClient(client)}
                                >
                                    <div className="avatar-circle">
                                        {client.contact_name ? client.contact_name[0].toUpperCase() : '?'}
                                    </div>
                                    <div className="inbox-item-content">
                                        <div className="inbox-item-row-top">
                                            <span className="client-name-list">
                                                {client.contact_name || `Consulta #${client.id.slice(0, 4)}`}
                                            </span>
                                            <span className="msg-time">
                                                {formatTime(client.last_message_at || client.created_at)}
                                            </span>
                                        </div>
                                        <div className="inbox-item-row-bottom">
                                            <span className="msg-preview">
                                                {client.last_message_preview || 'Nueva consulta iniciada.'}
                                            </span>
                                            {/* Optional: Unread indicator if we had that field */}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </aside>

                {/* 2. RIGHT PANEL: CHAT VIEW */}
                <main className="inbox-chat-panel">
                    {selectedClient ? (
                        <>
                            {/* CHAT HEADER */}
                            <header className="chat-header-inline">
                                <button className="btn-back-mobile" onClick={() => setSelectedClient(null)}>
                                    <ArrowLeft size={20} />
                                </button>

                                <div className="chat-client-info" onClick={() => setShowDetails(!showDetails)}>
                                    <div className="avatar-circle small">
                                        {selectedClient.contact_name?.[0] || '?'}
                                    </div>
                                    <div className="info-text">
                                        <h2>{selectedClient.contact_name || 'Nuevo Cliente'}</h2>
                                        <p>{selectedClient.case_type || 'Consulta General'}</p>
                                    </div>
                                </div>

                                <div className="chat-actions">
                                    <button
                                        className="btn-action-icon"
                                        title="Convertir a Expediente"
                                        onClick={convertToCase}
                                        disabled={selectedClient.is_case || converting}
                                    >
                                        {selectedClient.is_case ? <Folder className="text-blue" size={20} /> : <Folder size={20} />}
                                    </button>
                                    {verificationStatus === 'verified' && (
                                        <button
                                            className="btn-action-icon"
                                            title="Mi Perfil Público"
                                            onClick={() => {
                                                navigator.clipboard.writeText("https://judic-ia.com/abogados/" + lawyerId);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}
                                        >
                                            {copied ? <Check size={20} /> : <Globe size={20} />}
                                        </button>
                                    )}
                                    <button
                                        className="btn-action-icon"
                                        title="Ver Detalles"
                                        onClick={() => setShowDetails(!showDetails)}
                                    >
                                        <MoreVertical size={20} />
                                    </button>
                                </div>
                            </header>

                            {/* CHAT MESSAGES */}
                            <div className="chat-viewport">
                                {loadingChat ? (
                                    <div className="loader-center"><Loader className="animate-spin" /></div>
                                ) : (
                                    chatHistory.map(msg => {
                                        const isSystem = msg.content.startsWith('[SISTEMA:') || msg.content.startsWith('[SYSTEM:');
                                        if (isSystem) return null;

                                        return (
                                            <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                                                <div className="bubble-content">{msg.content}</div>
                                                <div className="bubble-time">{formatTime(msg.created_at)}</div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* INPUT AREA */}
                            <div className="chat-input-area">
                                <form onSubmit={sendLawyerReply} className="input-row">
                                    <input
                                        type="text"
                                        placeholder="Escribe un mensaje..."
                                        value={replyInput}
                                        onChange={e => setReplyInput(e.target.value)}
                                        disabled={sendingReply}
                                    />
                                    <button type="submit" disabled={!replyInput.trim() || sendingReply} className="btn-send">
                                        {sendingReply ? <Loader className="animate-spin" size={18} /> : <Send size={18} />}
                                    </button>
                                </form>
                            </div>

                            {/* DETAILS SIDEBAR (OVERLAY) */}
                            {showDetails && (
                                <div className="details-sidebar-inline">
                                    <div className="sidebar-header">
                                        <h3>Detalles</h3>
                                        <button onClick={() => setShowDetails(false)}><X size={18} /></button>
                                    </div>
                                    <div className="sidebar-content">
                                        <div className="info-group">
                                            <label>Teléfono</label>
                                            <p>{selectedClient.contact_phone || '-'}</p>
                                        </div>
                                        <div className="info-group">
                                            <label>Email</label>
                                            <p>{selectedClient.contact_email || '-'}</p>
                                        </div>
                                        <div className="info-group">
                                            <label>Resumen IA</label>
                                            <p className="summary-text">{selectedClient.ai_summary || 'Sin resumen disponible.'}</p>
                                        </div>

                                        <div className="info-group">
                                            <label>Acciones</label>
                                            <button className="btn-sidebar-danger" onClick={() => setClientToDelete(selectedClient.id)}>
                                                <Trash2 size={16} /> Eliminar Consulta
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* EMPTY STATE RIGHT PANEL */
                        <div className="chat-placeholder">
                            <div className="illustration-wrapper">
                                <Inbox size={64} className="placeholder-icon" />
                            </div>
                            <h3>Tus Conversaciones</h3>
                            <p>Selecciona un cliente de la lista para ver el chat y responder.</p>
                        </div>
                    )}
                </main>
            </div>

            {/* --- MODALS (Delete/Success) --- */}
            {clientToDelete && (
                <div className="modal-overlay-inline">
                    <div className="modal-box">
                        <AlertTriangle size={40} className="text-amber" />
                        <h3>¿Eliminar Consulta?</h3>
                        <p>Esta acción es irreversible.</p>
                        <div className="modal-btns">
                            <button onClick={() => setClientToDelete(null)}>Cancelar</button>
                            <button className="btn-danger" onClick={async () => {
                                // Reusing delete logic inline for brevity
                                try {
                                    await fetch("/api/clients/delete", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ inquiryId: clientToDelete })
                                    });
                                    setClients(prev => prev.filter(c => c.id !== clientToDelete));
                                    if (selectedClient?.id === clientToDelete) setSelectedClient(null);
                                } catch (e) { console.error(e); }
                                setClientToDelete(null);
                            }}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {conversionSuccess && (
                <div className="modal-overlay-inline">
                    <div className="modal-box">
                        <PartyPopper size={40} className="text-green" />
                        <h3>¡Caso Creado!</h3>
                        <div className="modal-btns">
                            <button onClick={() => setConversionSuccess(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
