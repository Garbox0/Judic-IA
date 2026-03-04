"use client";
import { useState, useEffect, use } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Edit,
    Archive,
    Trash2,
    ArrowLeft,
    FileText,
    MessageSquare,
    FolderOpen,
    Clock,
    CheckCircle2,
    RotateCcw,
    Upload,
    AlertTriangle,
    Info,
    X,
    User,
    Shield,
    Bot,
    Briefcase,
    Eye,
    Download
} from 'lucide-react';
// Reusing ChatWidget for context view
import ChatWidget from '../../../components/ChatWidget';
import EditCaseModal from './EditCaseModal';
import './case-details.css';

export default function CaseDetailPage({ params }) {
    // Unwrap params using React.use()
    const resolvedParams = use(params);
    const { id } = resolvedParams;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [caseData, setCaseData] = useState(null);
    const [activeTab, setActiveTab] = useState('info'); // info, files, chat
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [notification, setNotification] = useState(null);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    useEffect(() => {
        if (id) fetchCaseDetails();
    }, [id]);

    const fetchCaseDetails = async () => {
        try {
            // Get Case + Linked Inquiry
            const { data, error } = await supabase
                .from('cases')
                .select(`
                    *,
                    inquiry:inquiry_id (
                        id,
                        contact_name,
                        contact_phone,
                        contact_email,
                        dni,
                        id_type,
                        case_type,
                        source,
                        ai_summary
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setCaseData(data);

            if (data.inquiry_id) {
                fetchAttachments(data.inquiry_id);
            }

        } catch (error) {
            console.error("❌ Error fetching case:", error);
            // alert("No se pudo cargar el expediente.");
        } finally {
            setLoading(false);
        }
    };

    const fetchAttachments = async (inquiryId) => {
        // 1. Manually uploaded attachments (Supabase Storage)
        const { data: manual } = await supabase
            .from('attachments')
            .select('*')
            .eq('inquiry_id', inquiryId)
            .order('created_at', { ascending: false });

        // 2. Chat attachments (from messages table)
        const { data: chatMsgs } = await supabase
            .from('messages')
            .select('id, attachment_url, attachment_name, created_at, role')
            .eq('inquiry_id', inquiryId)
            .not('attachment_url', 'is', null)
            .order('created_at', { ascending: false });

        const chatAttachments = (chatMsgs || []).map(msg => ({
            id: `chat-${msg.id}`,
            inquiry_id: inquiryId,
            file_name: msg.attachment_name || 'Archivo adjunto',
            file_url: msg.attachment_url,
            file_type: null,
            created_at: msg.created_at,
            from_chat: true,
            chat_role: msg.role,
        }));

        const all = [...(manual || []), ...chatAttachments]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setAttachments(all);
    };

    const handleDeleteCase = async () => {
        try {
            // Solo borra la carpeta/expediente, no la conversación ni la inquiry
            const { error } = await supabase.from('cases').delete().eq('id', id);
            if (error) throw error;

            router.push('/dashboard/cases');
        } catch (error) {
            console.error("Delete Error:", error);
            showNotification("Error al eliminar el expediente definitivamente.", "error");
        }
    };

    const handleDeleteAttachment = async (fileId, fileName) => {
        if (!confirm(`¿Estás seguro de eliminar el archivo "${fileName}"?`)) return;

        try {
            const { error } = await supabase
                .from('attachments')
                .delete()
                .eq('id', fileId);

            if (error) throw error;
            setAttachments(prev => prev.filter(f => f.id !== fileId));
            showNotification("Archivo eliminado del expediente.");
        } catch (error) {
            console.error("Delete Attachment Error:", error);
            showNotification("Error al eliminar el archivo.", "error");
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !caseData?.inquiry_id) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${caseData.inquiry_id}/${Math.random()}.${fileExt}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('inquiry-attachments')
                .upload(fileName, file);
            if (uploadError) throw uploadError;

            // 2. Get URL
            const { data: { publicUrl } } = supabase.storage
                .from('inquiry-attachments')
                .getPublicUrl(fileName);

            // 3. Insert into Attachments Table
            const { error: dbError } = await supabase.from('attachments').insert({
                inquiry_id: caseData.inquiry_id,
                file_name: file.name,
                file_url: publicUrl,
                file_type: file.type,
                file_size: file.size
            });
            if (dbError) throw dbError;

            // Refresh list
            fetchAttachments(caseData.inquiry_id);
            showNotification("Archivo subido correctamente al expediente.");

        } catch (error) {
            console.error("Upload Error:", error);
            showNotification("Error al subir archivo.", "error");
        } finally {
            setUploading(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        try {
            const { error } = await supabase
                .from('cases')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            setCaseData(prev => ({ ...prev, status: newStatus }));
            showNotification("Estado actualizado con éxito.");
        } catch (error) {
            console.error("Status Update Error:", error);
            showNotification("Error al actualizar estado.", "error");
        }
    };

    // Simple markdown-ish parser for the summary (safe - no dangerouslySetInnerHTML)
    const renderSummary = (text) => {
        if (!text) return 'Sin resumen disponible.';
        return text.split('\n').map((line, i) => {
            // Split by **bold** markers and render safely with React
            const parts = line.split(/\*\*(.*?)\*\*/g);
            return (
                <div key={i} style={{ marginBottom: '0.4rem' }}>
                    {parts.map((part, j) =>
                        j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                    )}
                </div>
            );
        });
    };

    const [messages, setMessages] = useState([]);
    const [loadingChat, setLoadingChat] = useState(false);

    useEffect(() => {
        if (activeTab === 'chat' && caseData?.inquiry_id) {
            fetchChatHistory();
        }
    }, [activeTab, caseData?.inquiry_id]);

    const fetchChatHistory = async () => {
        setLoadingChat(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('inquiry_id', caseData.inquiry_id)
                .order('created_at', { ascending: true });
            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error("Error fetching chat:", error);
        } finally {
            setLoadingChat(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-white">Cargando expediente...</div>;
    if (!caseData) return <div className="p-10 text-center text-white">Expediente no encontrado.</div>;

    return (
        <div className="case-detail-container">
            {/* NAV */}
            <nav className="breadcrumb">
                <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link> /
                <Link href="/dashboard/cases" className="breadcrumb-item">Expedientes</Link> /
                <span className="breadcrumb-current">Caso #{caseData.id.slice(0, 6)}</span>
            </nav>

            {/* HEADER */}
            <header className="case-header glass-panel">
                <div className="case-title-block">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
                        {caseData.inquiry?.source === 'manual' ? <Shield size={18} className="text-blue-400" title="Caso Manual" /> : <Bot size={18} className="text-amber-400" title="Caso IA" />}
                        <h1 style={{ margin: 0 }}>{caseData.title}</h1>
                    </div>
                    <div className="badges">
                        <span className="badge badge-matter"><Briefcase size={12} style={{ marginRight: '5px' }} /> {caseData.matter || 'General'}</span>
                        <select
                            className={`status-select ${caseData.status}`}
                            value={caseData.status}
                            onChange={(e) => handleStatusChange(e.target.value)}
                        >
                            <option value="open">Abierto</option>
                            <option value="in_progress">En Curso</option>
                            <option value="closed">Cerrado</option>
                            <option value="archived">Archivado</option>
                        </select>
                    </div>
                </div>
                <div className="case-actions">
                    <button onClick={() => setShowEditModal(true)} className="btn-edit-case">
                        <Edit size={16} /> Editar Información
                    </button>
                    {caseData.status === 'archived' ? (
                        <button onClick={() => handleStatusChange('open')} className="btn-archive-case">
                            <RotateCcw size={16} /> Restaurar Expediente
                        </button>
                    ) : (
                        <button onClick={() => handleStatusChange('archived')} className="btn-archive-case">
                            <Archive size={16} /> Archivar Expediente
                        </button>
                    )}
                    <button onClick={() => setShowDeleteModal(true)} className="btn-delete-case">
                        <Trash2 size={16} /> Eliminar Definitivamente
                    </button>
                </div>
            </header>

            {/* TABS */}
            <div className="tabs-nav">
                <button className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}><FileText size={18} /> Información</button>
                <button className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}><FolderOpen size={18} /> Archivos {attachments.length > 0 && `(${attachments.length})`}</button>
                <button
                    className={`tab-btn ${activeTab === 'chat' ? 'active' : ''} ${caseData.inquiry?.source === 'manual' ? 'disabled' : ''}`}
                    onClick={() => caseData.inquiry?.source !== 'manual' && setActiveTab('chat')}
                    title={caseData.inquiry?.source === 'manual' ? "No disponible para casos manuales" : ""}
                >
                    <MessageSquare size={18} /> Conversación
                </button>
            </div>

            {/* CONTENT */}
            <div className="tab-content glass-panel">

                {/* INFO TAB */}
                {activeTab === 'info' && (
                    <div className="info-tab-wrapper">
                        <div className="info-grid">
                            <div className="info-card">
                                <label>Cliente</label>
                                <p>{caseData.inquiry?.contact_name || 'Desconocido'}</p>
                            </div>
                            <div className="info-card">
                                <label>Email</label>
                                <p>{caseData.inquiry?.contact_email || '-'}</p>
                            </div>
                            <div className="info-card">
                                <label>Teléfono</label>
                                <p className="highlight">{caseData.inquiry?.contact_phone || '-'}</p>
                            </div>
                            <div className="info-card">
                                <label>{caseData.inquiry?.id_type || 'ID'}</label>
                                <p className="highlight">{caseData.inquiry?.dni || '-'}</p>
                            </div>
                        </div>

                        <div className="summary-section">
                            <div className="section-title">
                                <FileText size={18} />
                                <h3>Resumen Ejecutivo e Inicial</h3>
                            </div>
                            <div className="summary-box">
                                {renderSummary(caseData.inquiry?.ai_summary)}
                            </div>
                        </div>
                    </div>
                )}

                {/* FILES TAB */}
                {activeTab === 'files' && (
                    <div className="files-section">
                        <div className="upload-zone">
                            <label className="btn-upload" htmlFor="case-file-upload">
                                {uploading ? <><Clock className="animate-spin" size={20} aria-hidden="true" /> Subiendo...</> : <><Upload size={20} aria-hidden="true" /> Subir Nuevo Archivo</>}
                                <input id="case-file-upload" type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} aria-label="Subir archivo al expediente" />
                            </label>
                            <p className="upload-hint">Documentos, imágenes o escritos legibles.</p>
                        </div>

                        {/* Documentos PJN desde actuaciones */}
                        {caseData.pjn_data?.actuaciones?.some(a => a.linkVer || a.linkDescargar) && (
                            <div className="pjn-docs-section">
                                <div className="pjn-docs-header">
                                    <FileText size={15} aria-hidden="true" />
                                    <span>Documentos del expediente PJN</span>
                                    <span className="pjn-docs-badge">PJN</span>
                                </div>
                                <div className="files-list">
                                    {caseData.pjn_data.actuaciones
                                        .filter(a => a.linkVer || a.linkDescargar)
                                        .map((act, idx) => (
                                            <div key={`pjn-doc-${idx}`} className="file-row">
                                                <div className="file-icon"><FileText size={24} aria-hidden="true" /></div>
                                                <div className="file-info">
                                                    <span className="file-name" style={{ color: '#e2e8f0' }}>
                                                        {act.tipo || act.descripcion || `Actuación ${idx + 1}`}
                                                    </span>
                                                    <span className="file-meta">
                                                        {act.fecha || '-'}
                                                        {act.descripcion && <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>{act.descripcion}</span>}
                                                    </span>
                                                </div>
                                                <div className="exp-doc-btns" style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
                                                    {act.linkVer && (
                                                        <a
                                                            href={act.linkVer}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="exp-doc-btn exp-doc-btn-ver"
                                                            aria-label={`Ver documento de actuación ${act.fecha}`}
                                                        >
                                                            <Eye size={12} aria-hidden="true" /> Ver en PJN
                                                        </a>
                                                    )}
                                                    {act.linkDescargar && (
                                                        <a
                                                            href={act.linkDescargar}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="exp-doc-btn exp-doc-btn-dl"
                                                            aria-label={`Descargar PDF de actuación ${act.fecha}`}
                                                        >
                                                            <Download size={12} aria-hidden="true" /> PDF
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}

                        {/* Archivos manuales */}
                        <div className="files-list" style={{ marginTop: caseData.pjn_data?.actuaciones?.some(a => a.linkVer || a.linkDescargar) ? '1.5rem' : '0' }}>
                            {attachments.length === 0
                                ? <p className="empty-msg">{caseData.source === 'pjn_import' ? 'No hay archivos subidos manualmente.' : 'No hay archivos adjuntos.'}</p>
                                : attachments.map(file => (
                                    <div key={file.id} className="file-row">
                                        <div className="file-icon"><FileText size={24} aria-hidden="true" /></div>
                                        <div className="file-info">
                                            <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="file-name">{file.file_name}</a>
                                            <span className="file-meta">
                                                {new Date(file.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                {file.from_chat && (
                                                    <span aria-label={file.chat_role === 'lawyer' ? 'Enviado por vos en el chat' : 'Enviado por el cliente en el chat'} style={{ marginLeft: '0.5rem', fontSize: '0.7rem', background: 'rgba(251,191,36,0.2)', color: '#f5c842', padding: '1px 6px', borderRadius: '99px', border: '1px solid rgba(251,191,36,0.4)' }}>
                                                        {file.chat_role === 'lawyer' ? 'Enviado por vos' : 'Del cliente'}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        {!file.from_chat && (
                                            <button
                                                className="btn-delete-file-mini"
                                                onClick={() => handleDeleteAttachment(file.id, file.file_name)}
                                                aria-label={`Eliminar archivo ${file.file_name}`}
                                                title="Eliminar archivo"
                                            >
                                                <Trash2 size={14} aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}

                {/* CHAT TAB */}
                {activeTab === 'chat' && (
                    <div className="chat-history-wrapper">
                        <div className="chat-header-info">
                            <MessageSquare size={16} />
                            <span>Historial de interacción con el cliente</span>
                        </div>
                        <div className="chat-messages-scroll">
                            {loadingChat ? (
                                <p className="loading-chat">Cargando conversación...</p>
                            ) : messages.length === 0 ? (
                                <div className="empty-chat">
                                    <MessageSquare size={48} />
                                    <p>No hay mensajes registrados para este caso.</p>
                                    <small>Los casos manuales no suelen tener un historial de chat de IA.</small>
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div key={msg.id || i} className={`chat-bubble-row ${msg.role}`}>
                                        <div className="chat-bubble">
                                            <div className="bubble-meta">{msg.role === 'user' ? 'Cliente' : 'IA Judic-IA'}</div>
                                            <div className="bubble-content">{msg.content}</div>
                                            <div className="bubble-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* DELETE MODAL */}
            {showDeleteModal && (
                <div className="modal-overlay">
                    <div className="modal-box glass-panel">
                        <div className="modal-icon-alert"><AlertTriangle size={48} /></div>
                        <h2>¿Eliminar Definitivamente?</h2>
                        <p>Esta acción es irreversible.</p>
                        <p>Se borrará el <strong>expediente, toda la documentación y los chats asociados</strong> de forma definitiva.</p>
                        <div className="modal-actions">
                            <button onClick={() => setShowDeleteModal(false)} className="btn-cancel">Cancelar</button>
                            <button onClick={handleDeleteCase} className="btn-confirm-delete">Sí, Borrar Todo</button>
                        </div>
                    </div>
                </div>
            )}

            {/* NOTIFICATION UI */}
            {notification && (
                <div className={`notification-toast ${notification.type}`}>
                    {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    <span>{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="btn-close-toast"><X size={14} /></button>
                </div>
            )}
            {/* EDIT MODAL */}
            <EditCaseModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                caseData={caseData}
                onRefresh={fetchCaseDetails}
            />

        </div>
    );
}

