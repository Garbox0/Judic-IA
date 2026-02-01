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
    Briefcase
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
        const { data } = await supabase
            .from('attachments')
            .select('*')
            .eq('inquiry_id', inquiryId)
            .order('created_at', { ascending: false });
        setAttachments(data || []);
    };

    const handleDeleteCase = async () => {
        try {
            // DEFENITIVE DELETE: Clean up case AND linked inquiry data
            const res = await fetch("/api/clients/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    inquiryId: caseData.inquiry_id
                })
            });

            if (!res.ok) {
                // If atomic delete fails, try deleting ONLY the case as fallback
                console.warn("Atomic delete failed, falling back to simple case delete.");
                const { error } = await supabase.from('cases').delete().eq('id', id);
                if (error) throw error;
            }

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

    // Simple markdown-ish parser for the summary
    const renderSummary = (text) => {
        if (!text) return 'Sin resumen disponible.';
        return text.split('\n').map((line, i) => {
            const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            return <div key={i} dangerouslySetInnerHTML={{ __html: formatted }} style={{ marginBottom: '0.4rem' }} />;
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
                <button className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}><FolderOpen size={18} /> Archivos ({attachments.length})</button>
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
                            <label className="btn-upload">
                                {uploading ? <><Clock className="animate-spin" size={20} /> Subiendo...</> : <><Upload size={20} /> Subir Nuevo Archivo</>}
                                <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
                            </label>
                            <p className="upload-hint">Documentos, imágenes o escritos legibles.</p>
                        </div>

                        <div className="files-list">
                            {attachments.length === 0 ? <p className="empty-msg">No hay archivos adjuntos.</p> : (
                                attachments.map(file => (
                                    <div key={file.id} className="file-row">
                                        <div className="file-icon"><FileText size={24} /></div>
                                        <div className="file-info">
                                            <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="file-name">{file.file_name}</a>
                                            <span className="file-meta">{new Date(file.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <button
                                            className="btn-delete-file-mini"
                                            onClick={() => handleDeleteAttachment(file.id, file.file_name)}
                                            title="Eliminar archivo"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
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

