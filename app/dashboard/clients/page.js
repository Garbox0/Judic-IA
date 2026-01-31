"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import EventModal from '../../components/dashboard/EventModal';
import { demoClients } from '../../lib/demoData'; // [NEW] Mock Data
import {
    Users,
    Inbox,
    Phone,
    Trash2,
    ArrowRight,
    AlertTriangle,
    CheckCircle,
    X,
    MessageSquare,
    FileText,
    Zap,
    Loader,
    Folder,
    Calendar,
    PartyPopper,
    Link2,
    Copy,
    Check,
    Mail,
    Scale
} from 'lucide-react';
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';
import './clients.css';

export default function ClientsPage({ isDemo = false, basePath = '/dashboard' }) {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lawyerId, setLawyerId] = useState(null);
    const [selectedClient, setSelectedClient] = useState(null); // For modal
    const [chatHistory, setChatHistory] = useState([]);
    const [loadingChat, setLoadingChat] = useState(false);
    const [copied, setCopied] = useState(false);
    const [clientToDelete, setClientToDelete] = useState(null);
    const [conversionSuccess, setConversionSuccess] = useState(false); // New success state
    const [showDetails, setShowDetails] = useState(true); // Toggle sidebar
    const [attachments, setAttachments] = useState([]);

    // Agenda Modal State
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [eventInitialData, setEventInitialData] = useState(null);

    // Case Conversion State
    const [converting, setConverting] = useState(false);

    // 1. INITIAL FETCH & AUTH
    useEffect(() => {
        const init = async () => {
            if (isDemo) {
                // DEMO MODE INITIALIZATION
                setLawyerId('demo-lawyer-id');
                setClients(demoClients);
                setLoading(false);
                return;
            }

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            console.log("🔍 ClientsPage Init - User:", user?.id, "Error:", authError);
            if (user) {
                setLawyerId(user.id);
                const { data, error } = await supabase
                    .from('inquiries')
                    .select('*')
                    .eq('assigned_lawyer_id', user.id)
                    .neq('status', 'link_generated')
                    .order('created_at', { ascending: false });

                if (error) console.error("❌ Error fetching inquiries:", error);
                if (!error) setClients(data || []);
            } else {
                console.warn("⚠️ No user found in ClientsPage init");
            }
            setLoading(false);
        };
        init();
    }, [isDemo]);

    // 2. REALTIME SUBSCRIPTION: CLIENTS LIST (Global)
    useEffect(() => {
        if (!lawyerId || isDemo) return; // Disable Realtime in Demo

        // console.log("🟢 Subscribing to Inquiries for Lawyer:", lawyerId);
        const channel = supabase.channel('realtime-clients')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'inquiries', filter: `assigned_lawyer_id=eq.${lawyerId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        if (payload.new.status !== 'link_generated') {
                            setClients(prev => [payload.new, ...prev]);
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        if (payload.new.status === 'link_generated') {
                            setClients(prev => prev.filter(c => c.id !== payload.new.id));
                        } else {
                            setClients(prev => {
                                const exists = prev.find(c => c.id === payload.new.id);
                                if (exists) return prev.map(c => c.id === payload.new.id ? payload.new : c);
                                return [payload.new, ...prev];
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
    }, [lawyerId, isDemo]);

    // 3. REALTIME SUBSCRIPTION: CHAT & ATTACHMENTS (Active Modal)
    useEffect(() => {
        if (!selectedClient || isDemo) return; // Disable Realtime in Demo

        // console.log("🔵 Subscribing to Chat/Attachments for Client:", selectedClient.id);
        const channel = supabase.channel(`realtime-chat-${selectedClient.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `inquiry_id=eq.${selectedClient.id}` },
                (payload) => {
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
    }, [selectedClient?.id, isDemo]);

    const fetchChatHistory = async (inquiryId) => {
        setLoadingChat(true);

        if (isDemo) {
            // MOCK CHAT HISTORY
            setTimeout(() => {
                setChatHistory([
                    { id: 1, role: 'assistant', content: 'Hola, soy el asistente virtual del Dr. Martínez. ¿En qué puedo ayudarte hoy?', created_at: new Date(Date.now() - 1000000).toISOString() },
                    { id: 2, role: 'user', content: 'Hola, necesito consultar por un despido.', created_at: new Date(Date.now() - 900000).toISOString() },
                    { id: 3, role: 'assistant', content: 'Entiendo. ¿Podrías decirme hace cuánto ocurrió y si trabajabas registrado?', created_at: new Date(Date.now() - 800000).toISOString() },
                    { id: 4, role: 'user', content: 'Fue hace dos semanas. Sí, estaba en blanco desde 2018.', created_at: new Date(Date.now() - 700000).toISOString() },
                    { id: 5, role: 'assistant', content: 'Gracias por la información. Esto es muy útil para análisis preliminar. ¿Tenés la carta documento?', created_at: new Date(Date.now() - 600000).toISOString() }
                ]);
                setAttachments([]); // No attachments in demo for now
                setLoadingChat(false);
            }, 600);
            return;
        }

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

    const openEventModalForClient = () => {
        if (!selectedClient) return;
        if (isDemo) {
            alert("🔒 Funcionalidad restringida en DEMO.\n\nAquí podrías agendar audiencias o vencimientos vinculados a este cliente.");
            return;
        }

        // Smart Parsing: Try to find dates in AI summary
        const summary = selectedClient.ai_summary || '';
        const title = `Vencimiento: ${selectedClient.contact_name || 'Nuevo Cliente'}`;
        let date = new Date().toISOString().split('T')[0];

        const dateMatch = summary.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dateMatch) {
            date = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
        }

        setEventInitialData({
            title: title,
            description: `Relacionado al caso de ${selectedClient.contact_name}.\n\nContexto IA: ${summary}`,
            date: date,
            time: '09:00',
            type: 'hearing'
        });
        setEventModalOpen(true);
    };

    const copySmartLink = async () => {
        console.log("🖱️ copySmartLink clicked. Current lawyerId:", lawyerId);
        if (!lawyerId && !isDemo) {
            console.error("❌ lawyerId is null! Attempting emergency fetch...");
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                console.log("✅ Recovered lawyerId:", user.id);
                setLawyerId(user.id);
                // Continue with local variable to avoid race condition with state update
                var currentLawyerId = user.id;
            } else {
                alert("Error de sesión: No se pudo identificar al abogado. Por favor, recarga la página.");
                return;
            }
        } else {
            var currentLawyerId = lawyerId;
        }

        if (isDemo) {
            navigator.clipboard.writeText("https://judic-ia.com/consultas/dr-martinez/link-demo");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            return;
        }

        try {
            console.log("📡 Sending to API /api/intake/create-link with lawyerId:", currentLawyerId);
            const res = await fetch("/api/intake/create-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lawyerId: currentLawyerId })
            });

            const data = await res.json();
            if (data.link) {
                console.log("✅ Link generated successfully:", data.link);
                navigator.clipboard.writeText(data.link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } else {
                console.error("Error generating link:", data.error);
                alert("Error al generar el enlace. Intenta de nuevo.");
            }
        } catch (err) {
            console.error("Link copy failed:", err);
            alert("Error de conexión al generar el enlace.");
        }
    };

    const deleteClient = (inquiryId, event) => {
        if (event) event.stopPropagation();
        if (isDemo) {
            alert("🔒 Funcionalidad restringida en DEMO.\n\nEsta acción eliminaría permanentemente el expediente y bloquearía el acceso al cliente.");
            return;
        }
        setClientToDelete(inquiryId);
    };

    const confirmDelete = async () => {
        if (!clientToDelete) return;

        // Safety check again just in case
        if (isDemo) {
            setClientToDelete(null);
            return;
        }

        const inquiryId = clientToDelete;
        const clientObj = clients.find(c => c.id === inquiryId);
        const authId = clientObj?.client_auth_id;

        // Optimistic UI update
        if (selectedClient?.id === inquiryId) setSelectedClient(null);
        setClients(prev => prev.filter(c => c.id !== inquiryId));
        setClientToDelete(null);

        try {
            const apiRes = await fetch("/api/clients/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientAuthId: authId || null,
                    inquiryId: inquiryId
                })
            });

            if (!apiRes.ok) {
                throw new Error("Error en el servidor de borrado.");
            }
            console.log("✅ Atomic cleanup successful.");
        } catch (error) {
            console.error("❌ Error during full client deletion:", error);
        } finally {
            setClientToDelete(null);
        }
    };

    const convertToCase = async () => {
        if (!selectedClient || !lawyerId) return;

        if (isDemo) {
            alert("🔒 Funcionalidad restringida en DEMO.\n\nEsto convertiría la consulta en una 'Causa Oficial' (Expediente) con seguimiento judicial.");
            return;
        }

        setConverting(true);
        try {
            const res = await fetch("/api/cases/convert", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    inquiryId: selectedClient.id,
                    lawyerId: lawyerId
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al convertir en expediente.");

            setConversionSuccess(true);
            setSelectedClient(prev => ({ ...prev, is_case: true }));

        } catch (error) {
            console.error("❌ Conversion error:", error);
            alert(`Error: ${error.message}`);
        } finally {
            setConverting(false);
        }
    };

    const getLink = (path) => {
        return isDemo ? path.replace('/dashboard', basePath) : path;
    };

    return (
        <div className="clients-container">
            <nav className="clients-nav">
                <div className="breadcrumb">
                    <Link href={isDemo ? basePath : "/dashboard"} className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Gestión de Clientes</span>
                </div>
            </nav>

            <header className="clients-header">
                <div className="header-flex">
                    <div className="header-icon-box"><Users size={48} /></div>
                    <div className="header-text">
                        <h1 className="dashboard-page-title">Mis Clientes</h1>
                        <p>Gestiona tus expedientes y consultas entrantes.</p>
                    </div>
                    <UsageGuide content={dashboardManuals.clients} />
                </div>
            </header>

            <div className="smart-link-card glass-panel">
                <div className="link-info">
                    <h3><Link2 size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Tu Enlace de Consulta Inteligente</h3>
                    <p>Comparte este link con tus clientes para que la IA tome sus datos automáticamente.</p>
                </div>
                <button onClick={copySmartLink} className={`btn-copy ${copied ? 'copied' : ''}`} disabled={copied}>
                    {copied ? <><Check size={16} /> Enlace Copiado</> : <><Copy size={16} /> Copiar Enlace</>}
                </button>
            </div>

            {/* CLIENTS LIST */}
            <div className="clients-grid">
                {loading ? (
                    <p>Cargando clientes...</p>
                ) : clients.length === 0 ? (
                    <div className="empty-state glass-panel">
                        <div className="empty-icon"><Inbox size={64} style={{ opacity: 0.5 }} /></div>
                        <h3>Aún no tienes consultas</h3>
                        <p>Comparte tu enlace inteligente para empezar a recibir casos.</p>
                    </div>
                ) : (
                    clients.map(client => (
                        <div key={client.id} className="client-card glass-panel" onClick={() => openClientModal(client)}>
                            <button className="btn-delete" onClick={(e) => deleteClient(client.id, e)} title="Eliminar Expediente" style={{ position: 'absolute', top: '10px', right: '10px', width: '28px', height: '28px', fontSize: '1rem' }}>
                                <Trash2 size={14} />
                            </button>

                            <h3 className="client-id" style={{ marginTop: '1.5rem', fontSize: '1.1rem' }}>
                                {client.contact_name || `Consulta #${client.id.slice(0, 8)}`}
                            </h3>

                            {client.contact_name && (
                                <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>ID: {client.id.slice(0, 8)}...</p>
                            )}

                            {client.contact_phone && (
                                <p style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Phone size={14} /> {client.contact_phone}</p>
                            )}

                            <p className="client-date">{new Date(client.created_at).toLocaleDateString()}</p>
                            <div className="client-footer">Ver Conversación <ArrowRight size={14} style={{ display: 'inline', marginLeft: '5px' }} /></div>
                        </div>
                    ))
                )}
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            {clientToDelete && (
                <div className="modal-overlay" onClick={() => setClientToDelete(null)}>
                    <div className="modal-content glass-panel" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}><AlertTriangle size={48} className="text-amber-500" /></div>
                        <h2 style={{ marginBottom: '1rem' }}>¿Eliminar Expediente?</h2>
                        <p style={{ color: 'var(--muted)', marginBottom: '2rem' }}>
                            Esta acción borrará el chat, los archivos adjuntos y <strong>la cuenta de acceso del cliente</strong> de forma permanente.
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

            {/* SUCCESS CONVERSION MODAL */}
            {conversionSuccess && (
                <div className="modal-overlay" onClick={() => setConversionSuccess(false)}>
                    <div className="modal-content glass-panel" style={{ maxWidth: '450px', height: 'auto', padding: '2.5rem', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}><PartyPopper size={64} className="text-emerald-400" /></div>
                        <h2 style={{ marginBottom: '1rem', color: '#4ade80' }}>¡Expediente Creado!</h2>
                        <p style={{ color: '#e2e8f0', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                            La consulta se ha convertido exitosamente en un <strong>Caso Oficial</strong> del estudio.
                        </p>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
                            📁 Podrás gestionarlo, ver sus documentos y seguir su estado desde la nueva sección <strong>Expedientes</strong>.
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button onClick={() => setConversionSuccess(false)} className="btn-cancel">
                                Cerrar
                            </button>
                            <Link href="/dashboard/cases" className="btn-confirm-delete" style={{ background: '#10b981', textDecoration: 'none' }}>
                                Ir a Expedientes →
                            </Link>
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
                                    <Trash2 size={16} />
                                </button>
                                {/* Generate Document: Disabled in Demo? Or mocked? Let's leave it, but handled by the target page. 
                                    Ideally we pass isDemo in query param or route. 
                                    For now the link goes to /dashboard/clients/... which is PROD. 
                                    We should fix this link to respect basePath.
                                */}
                                <Link
                                    href={isDemo ? "#" : `/dashboard/clients/${selectedClient.id}/generate`}
                                    className="btn-generate-action"
                                    onClick={(e) => {
                                        if (isDemo) {
                                            e.preventDefault();
                                            alert("🔒 Generación de escritos deshabilitada en DEMO.");
                                        }
                                    }}
                                >
                                    <Zap size={16} className="text-amber-900" /> Generar Escrito
                                </Link>
                                <button
                                    className="btn-convert-action"
                                    onClick={convertToCase}
                                    disabled={converting || selectedClient.is_case}
                                    title="Convertir esta consulta en un expediente formal del estudio"
                                >
                                    {converting ? <><Loader size={16} className="animate-spin" /> Convirtiendo...</> : selectedClient.is_case ? <><Folder size={16} /> Ya es Expediente</> : <><Folder size={16} /> Convertir en Expediente</>}
                                </button>
                                <button className="btn-agenda-action" onClick={openEventModalForClient} title="Agendar Plazo">
                                    <Calendar size={16} /> Crear Plazo
                                </button>
                                <button onClick={closeModal} className="close-btn"><X size={24} /></button>
                            </div>
                        </div>

                        {/* BODY ROW: CHAT (LEFT) | SIDEBAR (RIGHT) */}
                        <div className="modal-body">

                            {/* CHAT SECTION (CENTRAL) */}
                            <div className="chat-section">
                                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquare size={18} /> Historial de Conversación</h3>
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
                                                <span className="label"><Phone size={14} style={{ display: 'inline', marginRight: '5px' }} /> Teléfono</span>
                                                <span className="value highlight">{selectedClient.contact_phone || '-'}</span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="label"><Mail size={14} style={{ display: 'inline', marginRight: '5px' }} /> Email</span>
                                                <span className="value">{selectedClient.contact_email || '-'}</span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="label"><Scale size={14} style={{ display: 'inline', marginRight: '5px' }} /> Caso</span>
                                                <span className="value badge-text">{selectedClient.case_type || 'General'}</span>
                                            </div>
                                            <div className="detail-row" style={{ flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start', marginTop: '0.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                                                <span className="label"><FileText size={14} style={{ display: 'inline', marginRight: '5px' }} /> Resumen IA</span>
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
                                                            <FileText size={16} />
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

            {/* AGENDA MODAL */}
            <EventModal
                isOpen={eventModalOpen}
                onClose={() => setEventModalOpen(false)}
                onEventCreated={() => { }} // No refresh needed for clients list
                initialData={eventInitialData}
            />


        </div >
    );
}
