"use client";
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { demoClients } from '@/app/lib/demoData';
import {
    Users,
    Link2,
    Copy,
    Check,
    Inbox,
    Trash2,
    Phone,
    ArrowRight,
    X,
    MessageSquare,
    Zap,
    Folder,
    Calendar,
    AlertTriangle,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Search,
    Mail,
    Scale,
    FileText,
    Globe,
    Send,
    PanelRightOpen,
    PanelRightClose
} from 'lucide-react';
import '@/app/dashboard/clients/clients.css';

/* --------------------------------------------------------------------------------
 * DEMO TOAST & MODAL
 * ------------------------------------------------------------------------------*/
const DemoToast = ({ message, type = 'info', onClose }) => {
    useEffect(() => { const timer = setTimeout(onClose, 5000); return () => clearTimeout(timer); }, [onClose]);
    const themes = {
        info: { class: 'info', icon: <Search size={20} /> },
        success: { class: 'success', icon: <Check size={20} /> },
        warning: { class: 'warning', icon: <AlertTriangle size={20} /> },
        error: { class: 'error', icon: <X size={20} /> }
    };
    const theme = themes[type] || themes.info;
    return (
        <div className={`demo-toast-slide-in ${theme.class}`}>
            <div className="toast-wrapper">
                <span className="toast-icon-wrapper">{theme.icon}</span>
                <div className="toast-body">
                    <p className="toast-title">{message}</p>
                    {type === 'warning' && <p className="toast-subtitle">Simulación de Demo</p>}
                </div>
                <button onClick={onClose} className="toast-close-x">×</button>
            </div>
        </div>
    );
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay-inline">
            <div className="modal-box glass-panel">
                <div className="confirm-icon text-amber center-mx text-2xl mb-4">🗑️</div>
                <h3 className="confirm-title">{title}</h3>
                <p className="confirm-message">{message}</p>
                <div className="modal-btns">
                    <button onClick={onCancel} className="btn-cancel">Cancelar</button>
                    <button onClick={onConfirm} className="btn-danger">Eliminar</button>
                </div>
            </div>
        </div>
    );
};

/* --------------------------------------------------------------------------------
 * MOCK CHAT DATA GENERATOR
 * ------------------------------------------------------------------------------*/
const getMockChat = (clientId) => {
    const now = Date.now();
    const commonIntro = { id: 1, role: 'assistant', content: 'Hola, soy el asistente virtual de Judic-IA. ¿En qué puedo ayudarte hoy?', created_at: new Date(now - 1000000).toISOString() };

    // DETECT TYPE BY ID OR NAME (Simple heuristics for demo)
    // demo-c1 -> Juan Perez (Laboral)
    // demo-c2 -> Maria Gonzalez (Familia)
    // demo-c3 -> Roberto Gomez (Civil/Sucesion)

    if (clientId.includes('c2') || clientId.includes('Maria')) { // DIVORCIO
        return [
            commonIntro,
            { id: 2, role: 'user', content: 'Hola, necesito consultar por un divorcio.', created_at: new Date(now - 900000).toISOString() },
            { id: 3, role: 'assistant', content: 'Entiendo. ¿Es de común acuerdo o hay conflictos sobre bienes o hijos?', created_at: new Date(now - 800000).toISOString() },
            { id: 4, role: 'user', content: 'Tenemos dos hijos menores, pero estamos de acuerdo en todo.', created_at: new Date(now - 700000).toISOString() },
            { id: 5, role: 'assistant', content: 'Perfecto. Para avanzar necesitaré las partidas de nacimiento y acta de matrimonio. ¿Tenés esos documentos?', created_at: new Date(now - 600000).toISOString() }
        ];
    }
    else if (clientId.includes('c3') || clientId.includes('Roberto')) { // SUCESION
        return [
            commonIntro,
            { id: 2, role: 'user', content: 'Falleció mi padre y necesitamos iniciar la sucesión.', created_at: new Date(now - 950000).toISOString() },
            { id: 3, role: 'assistant', content: 'Lamento tu pérdida. Para asesorarte mejor, ¿dónde fue el último domicilio de tu padre?', created_at: new Date(now - 850000).toISOString() },
            { id: 4, role: 'user', content: 'En Capital Federal. Somos 3 hermanos y mi madre.', created_at: new Date(now - 750000).toISOString() },
            { id: 5, role: 'assistant', content: 'Bien. Al haber cónyuge e hijos, la declaratoria de herederos es el primer paso. ¿Tenés la partida de defunción?', created_at: new Date(now - 650000).toISOString() }
        ];
    }
    else { // LABORAL (Default)
        return [
            commonIntro,
            { id: 2, role: 'user', content: 'Hola, me despidieron ayer y no sé qué hacer.', created_at: new Date(now - 900000).toISOString() },
            { id: 3, role: 'assistant', content: 'Entiendo. ¿El despido fue verbal o recibiste carta documento?', created_at: new Date(now - 800000).toISOString() },
            { id: 4, role: 'user', content: 'Fue verbal, no me dejaron entrar a la fábrica.', created_at: new Date(now - 700000).toISOString() },
            { id: 5, role: 'assistant', content: 'Es importante intimar de inmediato para que aclaren situación laboral. ¿Trabajabas en blanco?', created_at: new Date(now - 600000).toISOString() }
        ];
    }
};

import UsageGuideDemo from '@/app/components/UsageGuideDemo';
import { demoManuals } from '@/app/lib/demoManuals';

/* --------------------------------------------------------------------------------
 * MAIN COMPONENT
 * ------------------------------------------------------------------------------*/
export default function DemoClientsPage() {
    const basePath = '/demo/dashboard';

    // Data State
    const [clients, setClients] = useState(demoClients);
    const [selectedClient, setSelectedClient] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [loadingChat, setLoadingChat] = useState(false);
    const [replyText, setReplyText] = useState("");

    // UI State
    const [copiedLink, setCopiedLink] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [toast, setToast] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false); // Toggle logic
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, clientId: null, clientName: '' });

    const messagesEndRef = useRef(null);

    // Initial Sort
    useEffect(() => {
        const sorted = [...demoClients].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setClients(sorted);
    }, []);

    const scrollToBottom = () => {
        if (!messagesEndRef.current) return;
        messagesEndRef.current.scrollIntoView({
            behavior: "smooth",
            block: "nearest", // Evita que el navegador mueva toda la ventana
            inline: "start"
        });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, showSidebar]); // Scroll when sidebar toggles too

    const showToast = (message, type = 'info') => setToast({ message, type });

    // LOAD CLIENT CHAT
    const handleSelectClient = (client) => {
        setSelectedClient(client);
        setLoadingChat(true);
        // Simulate fetch
        setTimeout(() => {
            const msgs = getMockChat(client.id + (client.contact_name || ''));
            setChatHistory(msgs);
            setLoadingChat(false);
        }, 300);
        // On mobile, auto-close sidebar? Let's keep distinct state per device if needed, 
        // but for now default open on desktop is fine.
        if (window.innerWidth < 768) setShowSidebar(false);
    };

    const handleCloseChat = () => {
        setSelectedClient(null);
        setChatHistory([]);
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText("https://judic-ia.com/perfil/demo-lawyer");
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        showToast("Enlace de Perfil copiado", "success");
    };

    const handleSendReply = (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;

        const newMessage = {
            id: Date.now(),
            role: 'lawyer',
            content: replyText,
            created_at: new Date().toISOString()
        };

        setChatHistory(prev => [...prev, newMessage]);
        setReplyText("");
    };

    const requestDelete = (e) => {
        e?.stopPropagation();
        if (!selectedClient) return;
        setDeleteModal({ isOpen: true, clientId: selectedClient.id, clientName: selectedClient.contact_name });
    };

    const confirmDelete = () => {
        const id = deleteModal.clientId;
        setClients(prev => prev.filter(c => c.id !== id));
        handleCloseChat();
        setDeleteModal({ isOpen: false, clientId: null, clientName: '' });
        showToast("Cliente eliminado de la demo.", "success");
    };

    const handleRestrictedAction = (actionName) => {
        showToast(`Funcionalidad "${actionName}" restringida en Demo`, "warning");
    };

    // Helper for formatting time (FIX HYDRATION)
    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        // Use fixed locale to avoid server/client mismatch
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="clients-page-wrapper">
            {toast && <DemoToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <ConfirmModal
                isOpen={deleteModal.isOpen}
                title="¿Eliminar Cliente?"
                message={`Estás a punto de eliminar a ${deleteModal.clientName}.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ isOpen: false, clientId: null, clientName: '' })}
            />

            <div className={`clients-split-container ${selectedClient ? 'chat-active' : ''}`}>

                {/* 1. LEFT PANEL: INBOX LIST */}
                <aside className="inbox-list-panel">
                    <div className="inbox-header flex justify-between items-center px-6 h-[70px]">
                        <h1 className="inbox-title">Inbox</h1>
                        <div className="flex gap-2 items-center">
                            <Link href={basePath} className="btn-icon-ghost" title="Volver">
                                <ChevronLeft size={20} />
                            </Link>
                        </div>
                    </div>

                    <div className="smart-link-mini">
                        <button className="btn-mini-copy" onClick={handleCopyLink}>
                            {copiedLink ? <><Check size={14} /> Link Copiado</> : <><Globe size={14} /> Mi Perfil Público</>}
                        </button>
                    </div>

                    <div className="search-inbox-container">
                        <div className="premium-search-box">
                            <Search className="search-icon-inside" size={14} />
                            <label htmlFor="demo-search-input" className="sr-only">Buscar cliente</label>
                            <input
                                id="demo-search-input"
                                type="text"
                                placeholder="Buscar en clientes..."
                                className="premium-search-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="inbox-list custom-scrollbar">
                        {clients.length === 0 ? (
                            <div className="inbox-empty">
                                <Inbox size={48} strokeWidth={1} />
                                <p>No hay clientes.</p>
                                <button onClick={() => window.location.reload()} className="text-amber-400 text-sm hover:underline">Reiniciar Demo</button>
                            </div>
                        ) : (
                            clients.map(client => (
                                <div
                                    key={client.id}
                                    className={`inbox-item ${selectedClient?.id === client.id ? 'active' : ''}`}
                                    onClick={() => handleSelectClient(client)}
                                >
                                    <div className="avatar-circle small">
                                        {client.contact_name ? client.contact_name.charAt(0) : '#'}
                                    </div>
                                    <div className="inbox-item-content">
                                        <div className="inbox-item-row-top">
                                            <span className="client-name-list">{client.contact_name}</span>
                                            <span className="msg-time" suppressHydrationWarning>{formatTime(client.created_at)}</span>
                                        </div>
                                        <div className="inbox-item-row-bottom">
                                            <span className="msg-preview">
                                                {client.ai_summary ? client.ai_summary.slice(0, 35) + '...' : 'Nueva consulta...'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </aside>

                {/* 2. RIGHT PANEL: CHAT AREA + SIDEBAR */}
                <main className="inbox-chat-panel">
                    {selectedClient ? (
                        <>
                            {/* CHAT HEADER */}
                            <header className="chat-header-inline">
                                <div className="flex items-center gap-2">
                                    <button className="btn-back-mobile" onClick={handleCloseChat}>
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div className="chat-client-info" onClick={() => setShowSidebar(!showSidebar)}>
                                        <div className="avatar-circle">
                                            {selectedClient.contact_name ? selectedClient.contact_name.charAt(0) : '#'}
                                        </div>
                                        <div className="info-text">
                                            <h2>{selectedClient.contact_name}</h2>
                                            <p>{selectedClient.contact_phone}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="chat-actions flex items-center gap-3 mr-16 md:mr-12">
                                    <span className="discovery-hint hidden md:block">
                                        {showSidebar ? "Ocultar Detalles" : "Ver Detalles"}
                                    </span>
                                    <button
                                        className={`btn-action-icon ${showSidebar ? 'text-amber-400 bg-amber-400/10' : 'btn-toggle-discovery'}`}
                                        onClick={() => setShowSidebar(!showSidebar)}
                                        title={showSidebar ? "Ocultar Detalles" : "Ver Detalles"}
                                    >
                                        {showSidebar ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                                    </button>
                                </div>
                            </header>

                            {/* FLEX CONTAINER FOR CHAT + SIDEBAR */}
                            <div className="chat-main-split">

                                {/* CHAT MESSAGES */}
                                <div className="chat-viewport custom-scrollbar">
                                    {loadingChat ? (
                                        <div className="loader-center">Cargando conversación...</div>
                                    ) : (
                                        chatHistory.map(msg => (
                                            <div key={msg.id} className={`chat-bubble ${msg.role === 'user' ? 'user' : (msg.role === 'lawyer' ? 'lawyer' : 'assistant')}`}>
                                                <p>{msg.content}</p>
                                                <div className="bubble-time">{formatTime(msg.created_at)}</div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* DETAILS SIDEBAR (Conditioned rendering or CSS toggle?) */}
                                {showSidebar && (
                                    <div className="details-sidebar-flex custom-scrollbar">
                                        <div className="sidebar-header flex justify-between items-center pt-4 mb-4">
                                            <h3 className="font-semibold text-lg">Detalles</h3>
                                        </div>


                                        <div className="info-group">
                                            <label htmlFor="detail-email">Email</label>
                                            <p id="detail-email">{selectedClient.contact_email || "-"}</p>
                                        </div>
                                        <div className="info-group">
                                            <label htmlFor="detail-phone">Teléfono</label>
                                            <p id="detail-phone">{selectedClient.contact_phone || "-"}</p>
                                        </div>
                                        <div className="info-group">
                                            <label htmlFor="detail-case">Caso</label>
                                            <p id="detail-case">{selectedClient.case_type || "General"}</p>
                                        </div>

                                        <div className="mt-8 border-t border-slate-700/50 pt-4">
                                            <button className="btn-sidebar-danger" onClick={requestDelete}>
                                                <Trash2 size={16} /> Eliminar Cliente
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* INPUT AREA */}
                            <form className="chat-input-area" onSubmit={handleSendReply}>
                                <div className="input-row">
                                    <label htmlFor="demo-chat-input" className="sr-only">Escribe una respuesta</label>
                                    <input
                                        id="demo-chat-input"
                                        type="text"
                                        placeholder="Escribe una respuesta..."
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                    // autoFocus removido para evitar saltos de pantalla (jumping layout)
                                    />
                                    <button type="submit" className="btn-send" disabled={!replyText.trim()} aria-label="Enviar respuesta">
                                        <Send size={20} />
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
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

            {/* FLOATING HELP TOOLTIP - Posicionado junto al theme toggle del layout */}
            <UsageGuideDemo content={demoManuals.clients} />
        </div>
    );
}
