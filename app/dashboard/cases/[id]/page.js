"use client";
import { useState, useEffect, use } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
// Reusing ChatWidget for context view
import ChatWidget from '../../../components/ChatWidget';
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
                        case_type,
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
            const { error } = await supabase
                .from('cases')
                .delete()
                .eq('id', id);

            if (error) throw error;

            router.push('/dashboard/cases');
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Error al eliminar el expediente. Verifica tus permisos.");
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
            alert("Archivo subido correctamente al expediente.");

        } catch (error) {
            console.error("Upload Error:", error);
            alert("Error al subir archivo.");
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
        } catch (error) {
            console.error("Status Update Error:", error);
            alert("Error al actualizar estado.");
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
                    <h1>{caseData.title}</h1>
                    <div className="badges">
                        <span className="badge badge-matter">{caseData.matter || 'General'}</span>
                        <select
                            className={`status-select ${caseData.status}`}
                            value={caseData.status}
                            onChange={(e) => handleStatusChange(e.target.value)}
                        >
                            <option value="open">🟢 Abierto</option>
                            <option value="in_progress">🟡 En Curso</option>
                            <option value="closed">🔴 Cerrado</option>
                            <option value="archived">📦 Archivado</option>
                        </select>
                    </div>
                </div>
                <div className="case-actions">
                    <button onClick={() => setShowDeleteModal(true)} className="btn-delete-case">🗑️ Eliminar Expediente</button>
                </div>
            </header>

            {/* TABS */}
            <div className="tabs-nav">
                <button className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>📋 Información</button>
                <button className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>📂 Archivos ({attachments.length})</button>
                <button className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>💬 Conversación</button>
            </div>

            {/* CONTENT */}
            <div className="tab-content glass-panel">

                {/* INFO TAB */}
                {activeTab === 'info' && (
                    <div className="info-grid">
                        <div className="info-group">
                            <label>Cliente</label>
                            <p>{caseData.inquiry?.contact_name || 'Desconocido'}</p>
                        </div>
                        <div className="info-group">
                            <label>Email</label>
                            <p>{caseData.inquiry?.contact_email || '-'}</p>
                        </div>
                        <div className="info-group">
                            <label>Teléfono</label>
                            <p className="highlight">{caseData.inquiry?.contact_phone || '-'}</p>
                        </div>
                        <div className="info-group">
                            <label>Resumen IA Inicial</label>
                            <p className="summary-text">{caseData.inquiry?.ai_summary || 'Sin resumen disponible.'}</p>
                        </div>
                    </div>
                )}

                {/* FILES TAB */}
                {activeTab === 'files' && (
                    <div className="files-section">
                        <div className="upload-zone">
                            <label className="btn-upload">
                                {uploading ? '⏳ Subiendo...' : '☁️ Subir Nuevo Archivo'}
                                <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
                            </label>
                            <p className="upload-hint">Documentos, imágenes o escritos. Se compartirán en el chat.</p>
                        </div>

                        <div className="files-list">
                            {attachments.length === 0 ? <p className="empty-msg">No hay archivos adjuntos.</p> : (
                                attachments.map(file => (
                                    <div key={file.id} className="file-row">
                                        <div className="file-icon">📄</div>
                                        <div className="file-info">
                                            <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="file-name">{file.file_name}</a>
                                            <span className="file-meta">{new Date(file.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* CHAT TAB */}
                {activeTab === 'chat' && (
                    <div className="chat-embed-wrapper" style={{ height: '600px', position: 'relative' }}>
                        {/* We use the ChatWidget in embedded mode, passing the sessionId (inquiry_id) */}
                        {/* Note: ChatWidget usually expects searchParams or explicit props. We depend on its internal fetching logic if sessionId matches */}
                        {/* Actually, ChatWidget logic is complex. For read-only context we might just show history. 
                           But user wants "context". Let's try to reuse or just fetch messages manually if simpler.
                           Reusing ChatWidget is best for consistency. We need to pass 'embedded=true' and ensure it uses correct ID.
                        */}
                        <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>
                            Visualización del chat original del cliente.
                        </p>
                        {/* Since we can't easily force ChatWidget into a specific session via props without refactoring it heavily (it reads URL/LocalStorage),
                           we will just show a placeholder or basic list.
                           WAIT: Currently ChatWidget logic is tied to URL 'cid' or 'mode'. 
                           Let's fetch stored messages manually here for stability in this view.
                        */}
                        <iframe
                            src={`/dashboard/clients?id=${caseData.inquiry_id}`}
                            style={{ width: '100%', height: '100%', border: 'none', borderRadius: '12px' }}
                            title="Chat Context"
                        />
                    </div>
                )}
            </div>

            {/* DELETE MODAL */}
            {showDeleteModal && (
                <div className="modal-overlay">
                    <div className="modal-box glass-panel">
                        <h2>⚠️ ¿Eliminar Expediente?</h2>
                        <p>Se borrará la "Carpeta Legal" del estudio.</p>
                        <p><strong>El usuario y su chat NO se borrarán.</strong></p>
                        <div className="modal-actions">
                            <button onClick={() => setShowDeleteModal(false)} className="btn-cancel">Cancelar</button>
                            <button onClick={handleDeleteCase} className="btn-confirm-delete">Sí, Eliminar</button>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}

