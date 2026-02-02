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

    // Premium Dark Glass Theme
    const themes = {
        info: { border: '#3b82f6', icon: <Search size={20} style={{ color: '#3b82f6' }} /> },
        success: { border: '#10b981', icon: <Check size={20} style={{ color: '#10b981' }} /> },
        warning: { border: '#f59e0b', icon: <AlertTriangle size={20} style={{ color: '#f59e0b' }} /> },
        error: { border: '#ef4444', icon: <X size={20} style={{ color: '#ef4444' }} /> }
    };

    const theme = themes[type] || themes.info;

    return (
        <div className="demo-toast-slide-in">
            <div style={{
                background: 'rgba(15, 23, 42, 0.85)', // Dark premium background
                color: '#f8fafc',
                padding: '1rem 1.5rem',
                borderRadius: '16px',
                boxShadow: `0 10px 40px rgba(0,0,0,0.6), 0 0 0 1px ${theme.border}40`, // Colored border glow
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                minWidth: '360px',
                maxWidth: '480px',
                backdropFilter: 'blur(20px)',
                borderLeft: `5px solid ${theme.border}`
            }}>
                <span style={{ fontSize: '1.5rem', lineHeight: '1', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.3))' }}>
                    {theme.icon}
                </span>
                <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', lineHeight: '1.5', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                        {message}
                    </p>
                    {type === 'warning' && (
                        <p style={{ margin: '6px 0 0', fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Simulación de Demo
                        </p>
                    )}
                </div>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', lineHeight: '0.8', cursor: 'pointer', padding: 0, transition: '0.2s' }}
                    onMouseEnter={(e) => e.target.style.color = 'white'}
                    onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                >
                    ×
                </button>
            </div>
            <style jsx>{`
                .demo-toast-slide-in {
                    position: fixed;
                    bottom: 30px;
                    right: 30px;
                    z-index: 10000;
                    animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes slideUpFade {
                    from { opacity: 0; transform: translateY(40px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
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
            <style jsx>{`
                .confirm-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(8px);
                    z-index: 9990; /* Below Toast */
                    display: flex; align-items: center; justify-content: center;
                    animation: fadeIn 0.2s ease-out;
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                
                .confirm-card {
                    background: #1e293b;
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 2.5rem;
                    border-radius: 24px;
                    width: 90%; max-width: 420px;
                    text-align: center;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
                    transform: scale(1);
                    animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes popIn { from { transform: scale(0.9) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

                .confirm-icon {
                    display: flex; align-items: center; justify-content: center;
                    margin-bottom: 1.5rem;
                    background: rgba(239, 68, 68, 0.1);
                    width: 80px; height: 80px;
                    border-radius: 50%;
                    margin: 0 auto 1.5rem;
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #ef4444;
                }
                .confirm-title { color: white; margin-bottom: 0.8rem; font-size: 1.4rem; font-weight: 700; }
                .confirm-message { color: #94a3b8; font-size: 1rem; line-height: 1.6; margin-bottom: 2rem; }
                
                .confirm-actions { display: flex; gap: 1rem; justify-content: center; }
                .btn-cancel {
                    background: transparent; border: 1px solid rgba(255,255,255,0.15);
                    color: #cbd5e1; padding: 0.8rem 1.6rem; border-radius: 12px;
                    font-weight: 600; cursor: pointer; transition: 0.2s;
                    flex: 1;
                }
                .btn-cancel:hover { background: rgba(255,255,255,0.05); color: white; }
                
                .btn-confirm-delete {
                    background: #ef4444; border: none;
                    color: white; padding: 0.8rem 1.6rem; border-radius: 12px;
                    font-weight: 600; cursor: pointer; transition: 0.2s;
                    flex: 1;
                    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
                }
                .btn-confirm-delete:hover { background: #dc2626; transform: translateY(-2px); box-shadow: 0 8px 25px rgba(239, 68, 68, 0.5); }
            `}</style>
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
                    <h3><Link2 size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.8rem', color: '#fbbf24' }} /> Tu Enlace de Consulta Inteligente</h3>
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
                            <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#64748b' }}><Inbox size={64} /></div>
                            <h3 style={{ color: 'var(--muted)', marginBottom: '1rem' }}>No hay consultas visibles</h3>
                            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>En esta sesión de demo, has eliminado todos los clientes de prueba.</p>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    marginTop: '1.5rem',
                                    background: 'rgba(251, 191, 36, 0.1)',
                                    border: '1px solid #fbbf24',
                                    color: '#fbbf24',
                                    padding: '0.6rem 1.2rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    margin: '1.5rem auto 0'
                                }}>
                                <RefreshCw size={18} /> Reiniciar Demo
                            </button>
                        </div>
                    ) : (
                        clients.map(client => (
                            <div key={client.id} className="client-card glass-panel" onClick={() => openClientModal(client)}>
                                <button className="btn-delete" onClick={(e) => requestDelete(client.id, e)} title="Eliminar Expediente" style={{ position: 'absolute', top: '10px', right: '10px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Trash2 size={14} />
                                </button>

                                <h3 className="client-id" style={{ marginTop: '1.5rem', fontSize: '1.1rem' }}>
                                    {client.contact_name || `Consulta #${client.id.slice(0, 8)}`}
                                </h3>

                                {client.contact_name && (
                                    <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>ID: {client.id.slice(0, 8)}...</p>
                                )}

                                {client.contact_phone && (
                                    <p style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={14} /> {client.contact_phone}</p>
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
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {selectedClient.contact_name ? selectedClient.contact_name : `Consulta #${selectedClient.id.slice(0, 6)}`}
                                </h2>
                                <div className="modal-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <button
                                        className={`btn-toggle-details ${showDetails ? 'active' : ''}`}
                                        onClick={() => setShowDetails(!showDetails)}
                                        title={showDetails ? "Ocultar Detalles" : "Ver Datos del Cliente"}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        {showDetails ? <><ChevronRight size={16} /> Cerrar Datos</> : <><ChevronLeft size={16} /> Ver Datos</>}
                                    </button>

                                    <div className="divider-vertical"></div>

                                    <button className="btn-delete" onClick={(e) => requestDelete(selectedClient.id, e)} title="Eliminar Expediente" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Trash2 size={16} />
                                    </button>

                                    <button
                                        className="btn-generate-action"
                                        onClick={() => handleRestrictedAction("Generar Escrito")}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        <Zap size={16} /> Generar Escrito
                                    </button>
                                    <button
                                        className="btn-convert-action"
                                        onClick={() => handleRestrictedAction("Convertir a Expediente")}
                                        title="Convertir esta consulta en un expediente formal del estudio"
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        <Folder size={16} /> Convertir en Expediente
                                    </button>
                                    <button className="btn-agenda-action" onClick={() => handleRestrictedAction("Crear Plazo")} title="Agendar Plazo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Calendar size={16} /> Crear Plazo
                                    </button>
                                    <button onClick={closeModal} className="close-btn"><X size={24} /></button>
                                </div>
                            </div>

                            {/* BODY ROW: CHAT (LEFT) | SIDEBAR (RIGHT) */}
                            <div className="modal-body">

                                {/* CHAT SECTION (CENTRAL) */}
                                <div className="chat-section">
                                    <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}><MessageSquare size={18} /> Historial de Conversación</h3>
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
                                        <h4 style={{ marginBottom: '1rem', color: '#e2e8f0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Expediente</h4>

                                        <div className="details-card">
                                            <div className="details-content">
                                                <div className="detail-row">
                                                    <span className="label">ID</span>
                                                    <span className="value" title={selectedClient.id}>{selectedClient.id.slice(0, 8)}...</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="label"><Phone size={14} style={{ marginRight: '5px' }} /> Teléfono</span>
                                                    <span className="value highlight">{selectedClient.contact_phone || '-'}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="label"><Mail size={14} style={{ marginRight: '5px' }} /> Email</span>
                                                    <span className="value">{selectedClient.contact_email || '-'}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="label"><Scale size={14} style={{ marginRight: '5px' }} /> Caso</span>
                                                    <span className="value badge-text">{selectedClient.case_type || 'General'}</span>
                                                </div>
                                                <div className="detail-row" style={{ flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start', marginTop: '0.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                                                    <span className="label"><FileText size={14} style={{ marginRight: '5px' }} /> Resumen IA</span>
                                                    <p style={{ fontSize: '0.8rem', lineHeight: '1.4', lineClamp: 3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', color: 'var(--muted)', margin: 0 }}>
                                                        {selectedClient.ai_summary || 'Sin resumen disponible.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: '#e2e8f0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Adjuntos ({attachments.length})</h4>

                                        <div className="details-card">
                                            <div className="details-content">
                                                <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Sin archivos (Demo).</p>
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
