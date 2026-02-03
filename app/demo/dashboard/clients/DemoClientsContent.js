"use client";
import React, { useEffect, useState } from 'react';
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
    FileText
} from 'lucide-react';
import '@/app/dashboard/clients/clients.css';

/* --------------------------------------------------------------------------------
 * DEMO TOAST COMPONENT (Redesigned: Dark Glass + Premium Accents)
 * ------------------------------------------------------------------------------*/
const DemoToast = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

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
                <span className="toast-icon-wrapper">
                    {theme.icon}
                </span>
                <div className="toast-body">
                    <p className="toast-title">
                        {message}
                    </p>
                    {type === 'warning' && (
                        <p className="toast-subtitle">
                            Simulación de Demo
                        </p>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="toast-close-x"
                >
                    ×
                </button>
            </div>
        </div>
    );
};

/* --------------------------------------------------------------------------------
 * CUSTOM CONFIRM MODAL (Replaces Native Window.Confirm)
 * ------------------------------------------------------------------------------*/
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className="confirm-overlay">
            <div className="confirm-card glass-panel">
                <div className="confirm-icon">🗑️</div>
                <h3 className="confirm-title">{title}</h3>
                <p className="confirm-message">{message}</p>
                <div className="confirm-actions">
                    <button onClick={onCancel} className="btn-cancel">Cancelar</button>
                    <button onClick={onConfirm} className="btn-confirm-delete">Eliminar</button>
                </div>
            </div>
        </div>
    );
};

import UsageGuideDemo from '@/app/components/UsageGuideDemo';
import { demoManuals } from '@/app/lib/demoManuals';

export default function DemoClientsPage() {
    const isDemo = true;
    const basePath = '/demo/dashboard';

    const [clients, setClients] = useState(demoClients);
    const [selectedClient, setSelectedClient] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [loadingChat, setLoadingChat] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showDetails, setShowDetails] = useState(true);
    const [attachments, setAttachments] = useState([]);

    // UI STATE
    const [toast, setToast] = useState(null); // { message, type }
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, clientId: null, clientName: '' });

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    // MOCK CHAT HISTORY
    const fetchChatHistory = (inquiryId) => {
        setLoadingChat(true);
        setTimeout(() => {
            setChatHistory([
                { id: 1, role: 'assistant', content: 'Hola, soy el asistente virtual de Judic-IA. ¿En qué puedo ayudarte hoy?', created_at: new Date(Date.now() - 1000000).toISOString() },
                { id: 2, role: 'user', content: 'Hola, necesito consultar por un despido.', created_at: new Date(Date.now() - 900000).toISOString() },
                { id: 3, role: 'assistant', content: 'Entiendo. ¿Podrías decirme hace cuánto ocurrió y si trabajabas registrado?', created_at: new Date(Date.now() - 800000).toISOString() },
                { id: 4, role: 'user', content: 'Fue hace dos semanas. Sí, estaba en blanco desde 2018.', created_at: new Date(Date.now() - 700000).toISOString() },
                { id: 5, role: 'assistant', content: 'Gracias por la información. Esto es muy útil para análisis preliminar. ¿Tenés la carta documento?', created_at: new Date(Date.now() - 600000).toISOString() }
            ]);
            setAttachments([]);
            setLoadingChat(false);
        }, 600);
    };

    const openClientModal = (client) => {
        setSelectedClient(client);
        fetchChatHistory(client.id);
        setShowDetails(true);
    };

    const closeModal = () => {
        setSelectedClient(null);
        setChatHistory([]);
        setAttachments([]);
    };

    const copySmartLink = () => {
        navigator.clipboard.writeText("https://judic-ia.com/consultas/demo/link");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        showToast("Enlace copiado al portapapeles", "success");
    };

    // --- NEW DELETION LOGIC WITH CUSTOM MODAL ---
    const requestDelete = (id, event) => {
        if (event) event.stopPropagation();

        const client = clients.find(c => c.id === id);
        const name = client?.contact_name || "Cliente";

        setDeleteModal({ isOpen: true, clientId: id, clientName: name });
    };

    const confirmDelete = () => {
        const id = deleteModal.clientId;

        // 1. Remove from UI
        setClients(prev => prev.filter(c => c.id !== id));

        // If modal was open, close it
        if (selectedClient?.id === id) {
            closeModal();
        }

        // Close Confirm Modal
        setDeleteModal({ isOpen: false, clientId: null, clientName: '' });

        // 2. Show Elegant Toast
        showToast(
            "Se eliminó la tarjeta del usuario y su chat. El expediente del abogado se conserva.",
            "success"
        );
    };
    // ---------------------------------------------

    const handleRestrictedAction = (actionName) => {
        showToast(`Funcionalidad "${actionName}" restringida en Demo`, "warning");
    };

    return (
        <div className="clients-container">
            {toast && <DemoToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <ConfirmModal
                isOpen={deleteModal.isOpen}
                title="¿Eliminar Consulta?"
                message={`Estás a punto de eliminar la tarjeta de ${deleteModal.clientName}. Esta acción solo afectará la vista de demostración.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ isOpen: false, clientId: null, clientName: '' })}
            />

            <nav className="clients-nav">
                <div className="breadcrumb">
                    <Link href={basePath} className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Gestión de Clientes (Demo)</span>
                </div>
            </nav>

            <header className="clients-header">
                <div className="header-flex">
                    <div className="header-icon-box"><Users size={32} /></div>
                    <div className="header-text">
                        <h1 className="dashboard-page-title">Mis Clientes</h1>
                        <p>Gestiona tus expedientes y consultas entrantes.</p>
                    </div>
                </div>

                <UsageGuideDemo content={demoManuals.clients} />
            </header>

            {/* SMART LINK CARD */}
            <div className="smart-link-card glass-panel">
                <div className="link-info">
                    <h3><Link2 size={24} className="inline-mr-0-8 text-amber-400" /> Tu Enlace de Consulta Inteligente</h3>
                    <p>Comparte este link con tus clientes para que la IA tome sus datos automáticamente.</p>
                </div>
                <button onClick={copySmartLink} className={`btn-copy ${copied ? 'copied' : ''}`} disabled={copied}>
                    {copied ? <><Check size={18} /> Enlace Copiado</> : <><Copy size={18} /> Copiar Enlace</>}
                </button>
            </div>

            {/* CLIENTS LIST */}
            <div className="clients-grid">
                {
                    clients.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon"><Inbox size={64} /></div>
                            <h3 className="text-muted mb-1rem">No hay consultas visibles</h3>
                            <p className="text-muted-foreground fs-0-9rem">En esta sesión de demo, has eliminado todos los clientes de prueba.</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="btn-refresh-demo">
                                <RefreshCw size={18} /> Reiniciar Demo
                            </button>
                        </div>
                    ) : (
                        clients.map(client => (
                            <div key={client.id} className="client-card glass-panel" onClick={() => openClientModal(client)}>
                                <button className="btn-delete btn-delete-absolute" onClick={(e) => requestDelete(client.id, e)} title="Eliminar Expediente">
                                    <Trash2 size={14} />
                                </button>

                                <h3 className="client-id client-id-card">
                                    {client.contact_name || `Consulta #${client.id.slice(0, 8)}`}
                                </h3>

                                {client.contact_name && (
                                    <p className="muted-small-text mb-0-2rem">ID: {client.id.slice(0, 8)}...</p>
                                )}

                                {client.contact_phone && (
                                    <p className="client-phone-demo"><Phone size={14} /> {client.contact_phone}</p>
                                )}

                                <p className="client-date">{new Date(client.created_at).toLocaleDateString()}</p>
                                <div className="client-footer">Ver Conversación <ArrowRight size={14} /></div>
                            </div>
                        ))
                    )
                }
            </div >

            {/* MODAL */}
            {
                selectedClient && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                            {/* HEADER */}
                            <div className="modal-header">
                                <h2 className="flex-center-gap-8">
                                    {selectedClient.contact_name ? selectedClient.contact_name : `Consulta #${selectedClient.id.slice(0, 6)}`}
                                </h2>
                                <div className="modal-actions flex-center-gap-8">
                                    <button
                                        className={`btn-toggle-details ${showDetails ? 'active' : ''}`}
                                        onClick={() => setShowDetails(!showDetails)}
                                        title={showDetails ? "Ocultar Detalles" : "Ver Datos del Cliente"}
                                    >
                                        {showDetails ? <><ChevronRight size={16} /> Cerrar Datos</> : <><ChevronLeft size={16} /> Ver Datos</>}
                                    </button>

                                    <div className="divider-vertical"></div>

                                    <button className="btn-delete flex-center" onClick={(e) => requestDelete(selectedClient.id, e)} title="Eliminar Expediente">
                                        <Trash2 size={16} />
                                    </button>

                                    <button
                                        className="btn-generate-action flex-center-gap-8"
                                        onClick={() => handleRestrictedAction("Generar Escrito")}
                                    >
                                        <Zap size={16} /> Generar Escrito
                                    </button>
                                    <button
                                        className="btn-convert-action flex-center-gap-8"
                                        onClick={() => handleRestrictedAction("Convertir a Expediente")}
                                        title="Convertir esta consulta en un expediente formal del estudio"
                                    >
                                        <Folder size={16} /> Convertir en Expediente
                                    </button>
                                    <button className="btn-agenda-action flex-center-gap-8" onClick={() => handleRestrictedAction("Crear Plazo")} title="Agendar Plazo">
                                        <Calendar size={16} /> Crear Plazo
                                    </button>
                                    <button onClick={closeModal} className="close-btn"><X size={24} /></button>
                                </div>
                            </div>

                            {/* BODY ROW: CHAT (LEFT) | SIDEBAR (RIGHT) */}
                            <div className="modal-body">

                                {/* CHAT SECTION (CENTRAL) */}
                                <div className="chat-section">
                                    <h3 className="chat-section-header"><MessageSquare size={18} /> Historial de Conversación</h3>
                                    <div className="chat-viewer">
                                        {loadingChat ? <p>Cargando chat...</p> : (
                                            chatHistory.length === 0 ? <p className="no-msgs">No hay mensajes aún.</p> :
                                                chatHistory
                                                    .filter(msg => !msg.content.startsWith('[SISTEMA:') && !msg.content.startsWith('[SYSTEM:'))
                                                    .map(msg => (
                                                        <div key={msg.id} className={`chat-msg ${msg.role}`}>
                                                            <strong>{msg.role === 'user' ? 'Cliente' : 'Asistente'}:</strong> {msg.content}
                                                        </div>
                                                    ))
                                        )}
                                    </div>
                                </div>

                                {/* DETAILS SIDEBAR (RIGHT) */}
                                <div className={`details-sidebar ${showDetails ? 'open' : 'closed'}`}>
                                    <div className="details-inner-wrapper">
                                        <h4 className="sidebar-section-title">Expediente</h4>

                                        <div className="details-card">
                                            <div className="details-content">
                                                <div className="detail-row">
                                                    <span className="label">ID</span>
                                                    <span className="value" title={selectedClient.id}>{selectedClient.id.slice(0, 8)}...</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="label"><Phone size={14} className="mr-0-5rem" /> Teléfono</span>
                                                    <p>{selectedClient.contact_phone || '-'}</p>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="label"><Mail size={14} className="mr-0-5rem" /> Email</span>
                                                    <p>{selectedClient.contact_email || '-'}</p>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="label"><Scale size={14} className="mr-0-5rem" /> Caso</span>
                                                    <p>{selectedClient.case_type || 'General'}</p>
                                                </div>
                                                <div className="detail-row detail-row-column">
                                                    <span className="label"><FileText size={14} className="icon-mr-5" /> Resumen IA</span>
                                                    <p className="ai-summary-text-clamped">
                                                        {selectedClient.ai_summary || 'Sin resumen disponible.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <h4 className="sidebar-section-title mt-1-5rem">Adjuntos ({attachments.length})</h4>

                                        <div className="details-card">
                                            <div className="details-content">
                                                <p className="opacity-70 fs-0-8rem">Sin archivos (Demo).</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
}
