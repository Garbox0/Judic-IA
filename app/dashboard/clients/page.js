"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function ClientsPage() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lawyerId, setLawyerId] = useState(null);
    const [selectedClient, setSelectedClient] = useState(null); // For modal
    const [chatHistory, setChatHistory] = useState([]);
    const [loadingChat, setLoadingChat] = useState(false);
    const [copied, setCopied] = useState(false);
    const [clientToDelete, setClientToDelete] = useState(null);
    const [showDetails, setShowDetails] = useState(true); // Toggle sidebar
    const [attachments, setAttachments] = useState([]);

    // 1. INITIAL FETCH & AUTH
    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setLawyerId(user.id);
                const { data, error } = await supabase
                    .from('inquiries')
                    .select('*')
                    .neq('status', 'link_generated')
                    .order('created_at', { ascending: false });

                if (!error) setClients(data);
            }
            setLoading(false);
        };
        init();
    }, []);

    // 2. REALTIME SUBSCRIPTION: CLIENTS LIST (Global)
    useEffect(() => {
        if (!lawyerId) return;

        console.log("🟢 Subscribing to Inquiries for Lawyer:", lawyerId);
        const channel = supabase.channel('realtime-clients')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'inquiries', filter: `assigned_lawyer_id=eq.${lawyerId}` },
                (payload) => {
                    console.log("⚡ Realtime Inquiry Update:", payload);
                    if (payload.eventType === 'INSERT') {
                        if (payload.new.status !== 'link_generated') {
                            setClients(prev => [payload.new, ...prev]);
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        if (payload.new.status === 'link_generated') {
                            // If it was visible but now is hidden (unlikely but safe)
                            setClients(prev => prev.filter(c => c.id !== payload.new.id));
                        } else {
                            // Normal update or "first appearance" after confirmation
                            setClients(prev => {
                                const exists = prev.find(c => c.id === payload.new.id);
                                if (exists) return prev.map(c => c.id === payload.new.id ? payload.new : c);
                                return [payload.new, ...prev]; // First time appearing in list
                            });
                        }
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
    }, [lawyerId]);

    // 3. REALTIME SUBSCRIPTION: CHAT & ATTACHMENTS (Active Modal)
    useEffect(() => {
        if (!selectedClient) return;

        console.log("🔵 Subscribing to Chat/Attachments for Client:", selectedClient.id);
        const channel = supabase.channel(`realtime-chat-${selectedClient.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `inquiry_id=eq.${selectedClient.id}` },
                (payload) => {
                    // Prevent duplicates
                    setChatHistory(prev => {
                        if (prev.find(m => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'attachments', filter: `inquiry_id=eq.${selectedClient.id}` },
                (payload) => {
                    // Newest attachments first
                    setAttachments(prev => {
                        if (prev.find(a => a.id === payload.new.id)) return prev;
                        return [payload.new, ...prev];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedClient?.id]); // Only re-subscribe if client ID changes

    const fetchChatHistory = async (inquiryId) => {
        setLoadingChat(true);

        // Fetch Messages
        const { data: msgs, error: msgError } = await supabase
            .from('messages')
            .select('*')
            .eq('inquiry_id', inquiryId)
            .order('created_at', { ascending: true });

        if (!msgError) setChatHistory(msgs);

        // Fetch Attachments
        const { data: files, error: fileError } = await supabase
            .from('attachments')
            .select('*')
            .eq('inquiry_id', inquiryId)
            .order('created_at', { ascending: false });

        if (!fileError) setAttachments(files);

        setLoadingChat(false);
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

    const copySmartLink = async () => {
        const uniqueClientId = self.crypto.randomUUID();
        const link = `${window.location.origin}/consultas/${lawyerId}?cid=${uniqueClientId}`;

        // Create a placeholder inquiry so the CID is valid
        const { error } = await supabase
            .from('inquiries')
            .insert([{
                id: uniqueClientId,
                assigned_lawyer_id: lawyerId,
                case_type: 'Pendiente',
                status: 'link_generated'
            }]);

        if (error) {
            console.error("Error creating placeholder link:", error);
            alert("Error al generar el enlace. Intenta de nuevo.");
            return;
        }

        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const deleteClient = (inquiryId, event) => {
        if (event) event.stopPropagation();
        setClientToDelete(inquiryId);
    };

    const confirmDelete = async () => {
        if (!clientToDelete) return;
        const inquiryId = clientToDelete;

        // Optimistic UI update
        if (selectedClient?.id === inquiryId) setSelectedClient(null);
        setClients(prev => prev.filter(c => c.id !== inquiryId));
        setClientToDelete(null);

        const { error } = await supabase
            .from('inquiries')
            .delete()
            .eq('id', inquiryId);

        if (error) {
            console.error("Error deleting client:", error);
            alert("Hubo un error al eliminar. Intenta nuevamente.");
        }
    };

    return (
        <div className="clients-container">
            <nav className="clients-nav">
                <div className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Gestión de Clientes</span>
                </div>
            </nav>

            <header className="clients-header">
                <div className="header-flex">
                    <div className="header-icon-box">👥</div>
                    <div className="header-text">
                        <h1 className="glow-text">Mis Clientes</h1>
                        <p>Gestiona tus expedientes y consultas entrantes.</p>
                    </div>
                </div>
            </header>

            {/* SMART LINK CARD */}
            <div className="smart-link-card glass-panel">
                <div className="link-info">
                    <h3>🔗 Tu Enlace de Consulta Inteligente</h3>
                    <p>Comparte este link con tus clientes para que la IA tome sus datos automáticamente.</p>
                </div>
                <button onClick={copySmartLink} className={`btn-copy ${copied ? 'copied' : ''}`} disabled={copied}>
                    {copied ? '✅ Enlace Copiado' : 'Copiar Enlace'}
                </button>
            </div>

            {/* CLIENTS LIST */}
            <div className="clients-grid">
                {loading ? (
                    <p>Cargando clientes...</p>
                ) : clients.length === 0 ? (
                    <div className="empty-state glass-panel">
                        <div className="empty-icon">📭</div>
                        <h3>Aún no tienes consultas</h3>
                        <p>Comparte tu enlace inteligente para empezar a recibir casos.</p>
                    </div>
                ) : (
                    clients.map(client => (
                        <div key={client.id} className="client-card glass-panel" onClick={() => openClientModal(client)}>
                            <button className="btn-delete" onClick={(e) => deleteClient(client.id, e)} title="Eliminar Expediente" style={{ position: 'absolute', top: '10px', right: '10px', width: '28px', height: '28px', fontSize: '1rem' }}>
                                🗑️
                            </button>

                            <h3 className="client-id" style={{ marginTop: '1.5rem', fontSize: '1.1rem' }}>
                                {client.contact_name || `Consulta #${client.id.slice(0, 8)}`}
                            </h3>

                            {client.contact_name && (
                                <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>ID: {client.id.slice(0, 8)}...</p>
                            )}

                            {client.contact_phone && (
                                <p style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '0.5rem' }}>📞 {client.contact_phone}</p>
                            )}

                            <p className="client-date">{new Date(client.created_at).toLocaleDateString()}</p>
                            <div className="client-footer">Ver Conversación →</div>
                        </div>
                    ))
                )}
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            {clientToDelete && (
                <div className="modal-overlay" onClick={() => setClientToDelete(null)}>
                    <div className="modal-content glass-panel" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                        <h2 style={{ marginBottom: '1rem' }}>¿Eliminar Expediente?</h2>
                        <p style={{ color: 'var(--muted)', marginBottom: '2rem' }}>
                            Esta acción borrará el chat, los archivos adjuntos y todos los datos del cliente de forma permanente.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button onClick={() => setClientToDelete(null)} className="btn-cancel">
                                Cancelar
                            </button>
                            <button onClick={confirmDelete} className="btn-confirm-delete">
                                Sí, Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL */}
            {selectedClient && (
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
                                >
                                    {showDetails ? '▶ Cerrar Datos' : '◀ Ver Datos'}
                                </button>

                                <div className="divider-vertical"></div>

                                <button className="btn-delete" onClick={(e) => deleteClient(selectedClient.id, e)} title="Eliminar Expediente">
                                    🗑️
                                </button>
                                <Link href={`/dashboard/clients/${selectedClient.id}/generate`} className="btn-generate-action" >
                                    ⚡ Generar Escrito
                                </Link>
                                <button onClick={closeModal} className="close-btn">×</button>
                            </div>
                        </div>

                        {/* BODY ROW: CHAT (LEFT) | SIDEBAR (RIGHT) */}
                        <div className="modal-body">

                            {/* CHAT SECTION (CENTRAL) */}
                            <div className="chat-section">
                                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#fbbf24' }}>💬 Historial de Conversación</h3>
                                <div className="chat-viewer">
                                    {loadingChat ? <p>Cargando chat...</p> : (
                                        chatHistory.length === 0 ? <p className="no-msgs">No hay mensajes aún.</p> :
                                            chatHistory.map(msg => (
                                                <div key={msg.id} className={`chat-msg ${msg.role}`}>
                                                    <strong>{msg.role === 'user' ? 'Cliente' : 'Asistente'}:</strong> {msg.content}
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>

                            {/* DETAILS SIDEBAR (RIGHT) - COLLAPSIBLE */}
                            <div className={`details-sidebar ${showDetails ? 'open' : 'closed'}`}>
                                <div className="details-inner-wrapper">
                                    <h4 style={{ marginBottom: '1rem', color: '#e2e8f0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Expediente</h4>

                                    <div className="details-card">
                                        <div className="details-content">
                                            <div className="detail-row">
                                                <span className="label">🆔 ID</span>
                                                <span className="value" title={selectedClient.id}>{selectedClient.id.slice(0, 8)}...</span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="label">📞 Teléfono</span>
                                                <span className="value highlight">{selectedClient.contact_phone || '-'}</span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="label">📧 Email</span>
                                                <span className="value">{selectedClient.contact_email || '-'}</span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="label">⚖️ Caso</span>
                                                <span className="value badge-text">{selectedClient.case_type || 'General'}</span>
                                            </div>
                                            <div className="detail-row" style={{ flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start', marginTop: '0.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                                                <span className="label">📝 Resumen IA</span>
                                                <p style={{ fontSize: '0.8rem', lineHeight: '1.4', lineClamp: 3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', color: 'var(--muted)', margin: 0 }}>
                                                    {selectedClient.ai_summary || 'Sin resumen disponible.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: '#e2e8f0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Adjuntos ({attachments.length})</h4>

                                    <div className="details-card">
                                        <div className="details-content">
                                            {attachments.length === 0 ? (
                                                <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Sin archivos.</p>
                                            ) : (
                                                <div className="attachments-list">
                                                    {attachments.map(file => (
                                                        <a key={file.id} href={file.file_url} target="_blank" rel="noopener noreferrer" className="attachment-row-link">
                                                            <span className="file-icon-small">📄</span>
                                                            <span className="file-name">{file.file_name}</span>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .clients-container { padding: 3rem; max-width: 1200px; margin: 0 auto; color: white; }
                .clients-nav { margin-bottom: 3rem; }
                .breadcrumb { display: flex; align-items: center; gap: 0.8rem; font-size: 0.9rem; color: var(--muted); }
                .breadcrumb-item { color: var(--muted); text-decoration: none; } 
                .breadcrumb-current { color: white; font-weight: 600; }

                .clients-header { margin-bottom: 2rem; }
                .header-flex { display: flex; align-items: center; gap: 2rem; }
                .header-icon-box { width: 80px; height: 80px; background: rgba(197, 160, 33, 0.1); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: #fbbf24; }
                .glow-text { font-size: 2.5rem; font-weight: 700; color: white; margin-bottom: 0.5rem; }
                .header-text p { color: var(--muted); }

                .smart-link-card {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 2rem; margin-bottom: 3rem;
                    background: linear-gradient(135deg, rgba(197, 160, 33, 0.1), rgba(15, 23, 42, 0.6));
                    border: 1px solid rgba(197, 160, 33, 0.3); border-radius: 16px;
                }
                .link-info h3 { color: #fbbf24; margin-bottom: 0.5rem; }
                .btn-copy { background: #fbbf24; color: #0f172a; border: none; padding: 0.8rem 1.5rem; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.3s; }
                .btn-copy.copied { background: #4ade80; color: #0f172a; cursor: default; }

                .clients-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
                .empty-state { text-align: center; padding: 4rem; grid-column: 1 / -1; background: rgba(15, 23, 42, 0.4); border-radius: 20px; }
                .empty-icon { font-size: 4rem; margin-bottom: 1rem; opacity: 0.5; }

                .client-card {
                    padding: 1.5rem; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 16px; cursor: pointer; transition: 0.2s; position: relative; overflow: hidden;
                }
                .client-card:hover { transform: translateY(-3px); border-color: #fbbf24; }
                .client-id { font-size: 1.2rem; color: white; margin-bottom: 0.5rem; }
                .client-date { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.5rem; }
                .client-footer { color: #fbbf24; font-size: 0.9rem; font-weight: 600; }

                /* MODAL OVERLAY */
                .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 200; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
                
                .modal-content { 
                    width: 95%; max-width: 1200px; height: 85vh; 
                    background: #0f172a; border-radius: 20px; 
                    display: flex; flex-direction: column; overflow: hidden; 
                    border: 1px solid rgba(255,255,255,0.1); 
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                }
                .modal-header { 
                    padding: 1rem 1.5rem; background: rgba(30, 41, 59, 0.5); 
                    border-bottom: 1px solid rgba(255,255,255,0.05); 
                    display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
                }
                .divider-vertical { width: 1px; height: 24px; background: rgba(255,255,255,0.1); }
                .close-btn { background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; }
                
                .modal-body { display: flex; flex: 1; overflow: hidden; position: relative; }

                /* CHAT */
                .chat-section {
                    flex: 1; display: flex; flex-direction: column; padding: 2rem;
                    overflow: hidden; transition: 0.3s;
                }
                .chat-viewer { 
                    flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; padding-right: 1rem;
                }
                .chat-msg { padding: 1rem; border-radius: 12px; max-width: 85%; line-height: 1.5; font-size: 0.95rem; }
                .chat-msg.user { align-self: flex-end; background: #fbbf24; color: #0f172a; }
                .chat-msg.assistant { align-self: flex-start; background: rgba(30, 41, 59, 1); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.1); }

                /* SIDEBAR TRANSITIONS */
                .details-sidebar {
                    background: rgba(15, 23, 42, 0.6); border-left: 1px solid rgba(255,255,255,0.05);
                    overflow-y: auto; overflow-x: hidden;
                    transition: width 0.3s ease, padding 0.3s ease, opacity 0.3s ease;
                }
                .details-sidebar.open { width: 320px; opacity: 1; }
                .details-sidebar.closed { width: 0px; opacity: 0; padding: 0; border-left: none; }
                
                .details-inner-wrapper { padding: 1.5rem; width: 320px; } /* Ensures content doesn't squash during transition */

                .details-card {
                    background: rgba(255, 255, 255, 0.03); border-radius: 12px; 
                    border: 1px solid rgba(255,255,255,0.05); overflow: hidden;
                }
                
                .details-content { padding: 1rem; font-size: 0.85rem; }
                .detail-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; }
                .detail-row:last-child { margin-bottom: 0; }
                
                .label { color: var(--muted); }
                .value { font-weight: 500; text-align: right; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .value.highlight { color: #fbbf24; }
                .badge-text { background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 0.2rem 0.5rem; border-radius: 6px; }

                .attachments-list { display: flex; flex-direction: column; gap: 0.5rem; }
                .attachment-row-link {
                    display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem;
                    background: rgba(255,255,255,0.05); border-radius: 6px;
                    text-decoration: none; color: white; transition: 0.2s;
                }
                .attachment-row-link:hover { background: rgba(255,255,255,0.1); color: #fbbf24; }
                .file-icon-small { font-size: 1rem; }

                /* BUTTONS */
                .btn-toggle-details {
                    background: transparent; border: 1px solid rgba(255,255,255,0.2); color: var(--muted);
                    padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600;
                    cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 0.5rem;
                }
                .btn-toggle-details:hover, .btn-toggle-details.active { background: rgba(255,255,255,0.1); color: white; border-color: white; }
                
                .btn-generate-action {
                    background: #fbbf24; color: #0f172a; padding: 0.5rem 1rem; border-radius: 8px;
                    font-weight: 700; text-decoration: none; font-size: 0.9rem; transition: 0.2s;
                    display: flex; align-items: center; gap: 0.5rem;
                }
                .btn-generate-action:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3); }

                .btn-delete {
                    background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.5);
                    width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
                    font-size: 1.2rem; cursor: pointer; transition: 0.2s;
                }
                .btn-delete:hover { background: #ef4444; color: white; transform: scale(1.05); }

                /* DELETE CONFIRMATION */
                .btn-cancel {
                    background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white;
                    padding: 0.8rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s;
                }
                .btn-cancel:hover { background: rgba(255,255,255,0.1); }

                .btn-confirm-delete {
                    background: #ef4444; color: white; border: none;
                    padding: 0.8rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s;
                }
                .btn-confirm-delete:hover { background: #dc2626; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4); }

                .client-details-container { padding: 0 1.5rem; display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1rem; }
                .no-msgs { text-align:center; color: var(--muted); padding: 2rem; font-style: italic; }
            `}</style>
        </div>
    );
}
