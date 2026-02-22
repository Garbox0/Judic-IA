"use client";
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { demoClients } from '../../lib/demoData';
import {
    Inbox,
    Trash2,
    AlertTriangle,
    X,
    Loader,
    Folder,
    FolderPlus,
    FolderOpen,
    PartyPopper,
    Check,
    Send,
    Search,
    Globe,
    ShieldCheck,
    Clock,
    ShieldAlert,
    AlertCircle,
    Settings,
    ChevronLeft,
    PanelRightOpen,
    PanelRightClose,
    MessageSquare,
    Paperclip
} from 'lucide-react';
import './clients.css';
import { dashboardManuals } from '../../lib/dashboardManuals';
import UsageGuide from '../../components/UsageGuide';

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
    const [showSidebar, setShowSidebar] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Lawyer Reply State
    const [replyInput, setReplyInput] = useState('');
    const [sendingReply, setSendingReply] = useState(false);

    // Case Conversion State
    const [converting, setConverting] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Refs for scrolling
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

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
                    const { data: profile } = await supabase.from('profiles').select('verification_status, rejection_reason').eq('id', user.id).single();
                    setVerificationStatus(profile?.verification_status || 'none');
                    setRejectionReason(profile?.rejection_reason || '');
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
                if (!error) {
                    const clients = data || [];
                    // Marcar qué inquiries ya tienen expediente creado
                    if (clients.length) {
                        const { data: casesData } = await supabase
                            .from('cases')
                            .select('inquiry_id')
                            .eq('assigned_to', user.id)
                            .not('inquiry_id', 'is', null);
                        if (casesData?.length) {
                            const caseSet = new Set(casesData.map(c => c.inquiry_id));
                            setClients(clients.map(c => ({ ...c, is_case: caseSet.has(c.id) })));
                        } else {
                            setClients(clients);
                        }
                    } else {
                        setClients(clients);
                    }
                }
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

    // --- FILE UPLOAD ---
    const uploadFile = async (file) => {
        if (!file || !selectedClient || isDemo) return;
        setUploadError(null);
        setUploadingFile(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const form = new FormData();
            form.append('file', file);
            form.append('inquiryId', selectedClient.id);
            form.append('role', 'lawyer');

            const res = await fetch('/api/chat/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
                body: form,
            });
            const data = await res.json();
            if (!res.ok) {
                setUploadError(data.error || 'Error al subir el archivo.');
            }
            // El mensaje aparece por Realtime
        } catch (err) {
            setUploadError('Error de conexión al subir el archivo.');
            console.error('[upload]', err);
        } finally {
            setUploadingFile(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) uploadFile(file);
    };

    const handleChatDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleChatDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleChatDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) uploadFile(file);
    };

    // --- MARKETPLACE MODERATION ---
    const [moderating, setModerating] = useState(false);

    const handleModeration = async (action) => {
        if (!selectedClient || moderating) return;
        setModerating(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch('/api/abogados/contact', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ inquiryId: selectedClient.id, action })
            });
            const data = await res.json();
            if (res.ok) {
                // Update local state
                const newStatus = data.status;
                setSelectedClient(prev => ({ ...prev, status: newStatus }));
                setClients(prev => prev.map(c =>
                    c.id === selectedClient.id ? { ...c, status: newStatus } : c
                ).filter(c => c.status !== 'rejected' && c.status !== 'blocked'));
                if (newStatus === 'rejected' || newStatus === 'blocked') {
                    setSelectedClient(null);
                }
            }
        } catch (err) {
            console.error('Moderation error:', err);
        } finally {
            setModerating(false);
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

    // ⏳ Wait for verification status before rendering anything
    if (!isDemo && !verificationStatus) {
        return (
            <div className="clients-page-wrapper">
                <div className="breadcrumb clients-breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Clientes</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                    <Loader className="animate-spin" size={24} style={{ opacity: 0.4 }} />
                </div>
            </div>
        );
    }

    // 🔒 FULL BLOCK for unverified lawyers
    if (!isDemo && verificationStatus !== 'verified') {
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
                        {isRejected && rejectionReason && (
                            <div className="clients-rejection-reason">
                                <AlertCircle size={14} />
                                <span><strong>Motivo:</strong> {rejectionReason}</span>
                            </div>
                        )}
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
            {/* GLOBAL HELP GUIDE */}
            <UsageGuide content={dashboardManuals.clients} />

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
                    <div className="inbox-header flex justify-between items-center px-6 h-[70px]">
                        <h1 className="inbox-title">Inbox</h1>
                        <div className="flex gap-2 items-center">
                            <Link href={isDemo ? basePath : "/dashboard"} className="btn-icon-ghost" title="Volver" aria-label="Volver al dashboard">
                                <ChevronLeft size={20} />
                            </Link>
                        </div>
                    </div>

                    {verificationStatus === 'verified' && (
                        <div className="smart-link-mini">
                            <button className="btn-mini-copy" onClick={() => {
                                navigator.clipboard.writeText("https://judic-ia.com/abogados/" + lawyerId);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            }}>
                                {copied ? <><Check size={14} /> Link Copiado</> : <><Globe size={14} /> Mi Perfil Público</>}
                            </button>
                        </div>
                    )}

                    <div className="search-inbox-container">
                        <div className="premium-search-box">
                            <Search className="search-icon-inside" size={14} aria-hidden="true" />
                            <label htmlFor="inbox-search" className="sr-only">Buscar clientes</label>
                            <input
                                id="inbox-search"
                                type="text"
                                placeholder="Buscar en clientes..."
                                className="premium-search-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="inbox-list custom-scrollbar">
                        {loading ? (
                            <div className="inbox-loader"><Loader className="animate-spin" /></div>
                        ) : clients.filter(c => {
                            if (!searchTerm.trim()) return true;
                            const q = searchTerm.toLowerCase();
                            return (c.contact_name || '').toLowerCase().includes(q)
                                || (c.contact_phone || '').toLowerCase().includes(q)
                                || (c.contact_email || '').toLowerCase().includes(q)
                                || (c.case_type || '').toLowerCase().includes(q);
                        }).length === 0 ? (
                            <div className="inbox-empty">
                                <Inbox size={48} strokeWidth={1} />
                                <p>{searchTerm ? 'Sin resultados.' : 'No hay consultas aún.'}</p>
                            </div>
                        ) : (
                            clients.filter(c => {
                                if (!searchTerm.trim()) return true;
                                const q = searchTerm.toLowerCase();
                                return (c.contact_name || '').toLowerCase().includes(q)
                                    || (c.contact_phone || '').toLowerCase().includes(q)
                                    || (c.contact_email || '').toLowerCase().includes(q)
                                    || (c.case_type || '').toLowerCase().includes(q);
                            }).map(client => (
                                <div
                                    key={client.id}
                                    className={`inbox-item ${selectedClient?.id === client.id ? 'active' : ''}`}
                                    onClick={() => selectClient(client)}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Abrir chat con ${client.contact_name || 'cliente'}`}
                                    aria-pressed={selectedClient?.id === client.id}
                                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && selectClient(client)}
                                >
                                    <div className="avatar-circle small">
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
                                            {client.status === 'pending_review' && (
                                                <span className="badge-pending-review">Pendiente</span>
                                            )}
                                            {client.source === 'marketplace' && client.status !== 'pending_review' && (
                                                <span className="badge-marketplace">Marketplace</span>
                                            )}
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
                                <div className="flex items-center gap-2">
                                    <button className="btn-back-mobile" onClick={() => setSelectedClient(null)} aria-label="Volver a la lista de clientes">
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div className="chat-client-info" onClick={() => setShowSidebar(!showSidebar)}>
                                        <div className="avatar-circle">
                                            {selectedClient.contact_name?.[0] || '?'}
                                        </div>
                                        <div className="info-text">
                                            <h2>{selectedClient.contact_name || 'Nuevo Cliente'}</h2>
                                            <p>{selectedClient.case_type || 'Consulta General'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="chat-actions flex items-center gap-2 mr-16 md:mr-12">
                                    {/* Expediente: icono + label como unidad */}
                                    <div className="chat-action-group">
                                        <button
                                            className={`btn-action-icon ${selectedClient.is_case ? 'text-amber-400' : ''}`}
                                            title={selectedClient.is_case ? "Expediente ya creado" : "Crear Expediente"}
                                            aria-label={selectedClient.is_case ? "Expediente ya creado" : "Crear expediente"}
                                            onClick={selectedClient.is_case ? undefined : convertToCase}
                                            disabled={selectedClient.is_case || converting}
                                        >
                                            {converting
                                                ? <Loader size={18} className="animate-spin" />
                                                : selectedClient.is_case
                                                    ? <FolderOpen size={18} />
                                                    : <FolderPlus size={18} />
                                            }
                                        </button>
                                        <span className="chat-action-label hidden md:block">
                                            {selectedClient.is_case ? 'Expediente' : 'Crear Expediente'}
                                        </span>
                                    </div>

                                    <div className="chat-action-divider hidden md:block" />

                                    {/* Ver/Ocultar Detalles: label + icono como unidad */}
                                    <div className="chat-action-group">
                                        <span className="chat-action-label hidden md:block">
                                            {showSidebar ? "Ocultar Detalles" : "Ver Detalles"}
                                        </span>
                                        <button
                                            className={`btn-action-icon ${showSidebar ? 'text-amber-400 bg-amber-400/10' : 'btn-toggle-discovery'}`}
                                            onClick={() => setShowSidebar(!showSidebar)}
                                            title={showSidebar ? "Ocultar Detalles" : "Ver Detalles"}
                                            aria-label={showSidebar ? "Ocultar panel de detalles" : "Ver detalles del cliente"}
                                            aria-expanded={showSidebar}
                                        >
                                            {showSidebar ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </header>

                            {/* FLEX CONTAINER FOR CHAT + SIDEBAR */}
                            <div className="chat-main-split">

                                {/* CHAT MESSAGES */}
                                <div
                                    className="chat-viewport custom-scrollbar"
                                    aria-live="polite"
                                    aria-label="Historial de mensajes"
                                    role="log"
                                    onDragOver={handleChatDragOver}
                                    onDragLeave={handleChatDragLeave}
                                    onDrop={handleChatDrop}
                                    style={{ position: 'relative' }}
                                >
                                    {isDragging && (
                                        <div className="chat-drop-overlay">
                                            <span>Soltá el archivo para adjuntarlo</span>
                                        </div>
                                    )}
                                    {loadingChat ? (
                                        <div className="loader-center"><Loader className="animate-spin" /></div>
                                    ) : (
                                        chatHistory.map(msg => {
                                            const isSystem = msg.content.startsWith('[SISTEMA:') || msg.content.startsWith('[SYSTEM:');
                                            if (isSystem) return null;

                                            return (
                                                <div key={msg.id} className={`chat-bubble ${msg.role}`}>
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
                                                                <audio controls src={msg.attachment_url} className="msg-audio-player" />
                                                            ) : isVideoFile(msg.attachment_name) ? (
                                                                <video controls src={msg.attachment_url} className="msg-video-player" preload="metadata" />
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
                                                        <div className="bubble-content">{msg.content}</div>
                                                    )}
                                                    <div className="bubble-time">{formatTime(msg.created_at)}</div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* DETAILS SIDEBAR (FLEX INLINE) */}
                                {showSidebar && (
                                    <div className="details-sidebar-flex custom-scrollbar">
                                        <div className="sidebar-header flex justify-between items-center pt-4 mb-4">
                                            <h3 className="font-semibold text-lg">Detalles</h3>
                                        </div>

                                        <div className="info-group">
                                            <label>Email</label>
                                            <p>{selectedClient.contact_email || '-'}</p>
                                        </div>
                                        <div className="info-group">
                                            <label>Teléfono</label>
                                            <p>{selectedClient.contact_phone || '-'}</p>
                                        </div>
                                        <div className="info-group">
                                            <label>Caso</label>
                                            <p>{selectedClient.case_type || 'General'}</p>
                                        </div>
                                        <div className="info-group">
                                            <label>Resumen IA</label>
                                            <p className="summary-text">{selectedClient.ai_summary || 'Sin resumen disponible.'}</p>
                                        </div>

                                        <div className="mt-8 border-t border-slate-700/50 pt-4 flex flex-col gap-2">
                                            {selectedClient.status !== 'pending_review' && (
                                                <button
                                                    className="btn-sidebar-block"
                                                    onClick={() => handleModeration('block')}
                                                    disabled={moderating}
                                                >
                                                    <ShieldAlert size={16} /> Bloquear Cliente
                                                </button>
                                            )}
                                            <button className="btn-sidebar-danger" onClick={() => setClientToDelete(selectedClient.id)}>
                                                <Trash2 size={16} /> Eliminar Consulta
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* INPUT AREA / MODERATION BAR */}
                            {selectedClient.status === 'pending_review' ? (
                                <div className="moderation-bar">
                                    <span className="moderation-label">Solicitud desde el marketplace</span>
                                    <div className="moderation-actions">
                                        <button
                                            className="mod-btn mod-accept"
                                            onClick={() => handleModeration('accept')}
                                            disabled={moderating}
                                        >
                                            <Check size={16} /> Aceptar
                                        </button>
                                        <button
                                            className="mod-btn mod-reject"
                                            onClick={() => handleModeration('reject')}
                                            disabled={moderating}
                                        >
                                            <X size={16} /> Rechazar
                                        </button>
                                        <button
                                            className="mod-btn mod-block"
                                            onClick={() => handleModeration('block')}
                                            disabled={moderating}
                                        >
                                            <ShieldAlert size={16} /> Bloquear
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <form className="chat-input-area" onSubmit={sendLawyerReply}>
                                    {uploadError && (
                                        <div className="upload-error-bar">{uploadError}</div>
                                    )}
                                    <div className="input-row">
                                        <label htmlFor="chat-reply-input" className="sr-only">Escribir mensaje</label>
                                        <input
                                            id="chat-reply-input"
                                            type="text"
                                            placeholder="Escribe un mensaje..."
                                            value={replyInput}
                                            onChange={e => setReplyInput(e.target.value)}
                                            disabled={sendingReply}
                                        />
                                        {/* Adjuntar archivo */}
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
                                            className="btn-attach"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingFile}
                                            title="Adjuntar archivo (PDF, imagen, DOCX — máx. 10 MB)"
                                            aria-label="Adjuntar archivo"
                                        >
                                            {uploadingFile ? <Loader className="animate-spin" size={18} /> : <Paperclip size={18} />}
                                        </button>
                                        <button type="submit" disabled={!replyInput.trim() || sendingReply} className="btn-send" aria-label="Enviar mensaje">
                                            {sendingReply ? <Loader className="animate-spin" size={18} /> : <Send size={18} />}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    ) : (
                        /* EMPTY STATE RIGHT PANEL */
                        <div className="chat-placeholder">
                            <div className="illustration-wrapper">
                                <MessageSquare size={48} className="placeholder-icon" />
                            </div>
                            <h3>Bandeja de Entrada</h3>
                            <p>Selecciona un cliente para ver el historial y los detalles del caso.</p>
                        </div>
                    )}
                </main>
            </div>

            {/* --- MODALS (Delete/Success) --- */}
            {clientToDelete && (
                <div className="modal-overlay-inline">
                    <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="delete-client-title">
                        <AlertTriangle size={40} className="text-amber" aria-hidden="true" />
                        <h3 id="delete-client-title">¿Eliminar Consulta?</h3>
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
