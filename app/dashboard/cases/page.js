"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import {
    Folder,
    Briefcase,
    Archive,
    FolderOpen,
    MessageSquare,
    Trash2,
    AlertTriangle,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

export default function CasesPage() {
    const [loading, setLoading] = useState(true);
    const [cases, setCases] = useState([]);
    const [stats, setStats] = useState({ open: 0, in_progress: 0, closed: 0 });
    const [caseToDelete, setCaseToDelete] = useState(null);
    const [showVault, setShowVault] = useState(false); // Vault toggle

    const activeCases = cases.filter(c => c.status !== 'archived');
    const archivedCases = cases.filter(c => c.status === 'archived');

    useEffect(() => {
        fetchCases();
    }, []);

    const fetchCases = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch cases where lawyer is assigned or belongs to their org
            // First get lawyer org
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('org_id')
                .eq('id', user.id)
                .maybeSingle();

            if (profileError) {
                console.error("❌ Profile fetch error:", profileError.message);
                // Non-fatal, we'll fall back to assigned_to filter
            }

            let query = supabase.from('cases').select(`
                *,
                inquiry:inquiry_id (
                    id,
                    contact_name,
                    contact_phone,
                    contact_email,
                    case_type
                )
            `);

            if (profile?.org_id) {
                query = query.eq('org_id', profile.org_id);
            } else {
                query = query.eq('assigned_to', user.id);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                console.error("❌ Query error details:", {
                    message: error.message,
                    hint: error.hint,
                    details: error.details,
                    code: error.code
                });
                throw error;
            }
            setCases(data || []);

            // Calculate stats
            const newStats = (data || []).reduce((acc, c) => {
                acc[c.status] = (acc[c.status] || 0) + 1;
                return acc;
            }, { open: 0, in_progress: 0, closed: 0 });
            setStats(newStats);

        } catch (error) {
            console.error("❌ Detailed error fetching cases:", error.message || error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCase = async () => {
        if (!caseToDelete) return;
        try {
            const { error } = await supabase
                .from('cases')
                .delete()
                .eq('id', caseToDelete.id);

            if (error) throw error;

            setCases(prev => prev.filter(c => c.id !== caseToDelete.id));
            setCaseToDelete(null);
            fetchCases();

        } catch (error) {
            console.error("Delete Error:", error);
            alert("Error al eliminar el expediente. Verifica tus permisos.");
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return '#60a5fa'; // Blue
            case 'in_progress': return '#fbbf24'; // Yellow
            case 'closed': return '#94a3b8'; // Muted
            default: return 'var(--muted)';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'open': return 'Abierto';
            case 'in_progress': return 'En Curso';
            case 'closed': return 'Cerrado';
            default: return status;
        }
    };

    return (
        <div className="cases-container">
            <nav className="cases-nav">
                <div className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Expedientes</span>
                </div>
            </nav>

            <header className="cases-header">
                <div className="header-flex">
                    <div className="header-icon-box"><Briefcase size={48} /></div>
                    <div className="header-text">
                        <h1 className="dashboard-page-title">Expedientes del Estudio</h1>
                        <p>Gestión centralizada de casos oficiales y carpetas legales.</p>
                    </div>
                </div>
            </header>

            {/* STATS OVERVIEW */}
            <div className="stats-grid">
                <div className="stat-card glass-panel">
                    <span className="stat-label">Total Expedientes</span>
                    <span className="stat-value">{cases.length}</span>
                </div>
                <div className="stat-card glass-panel" style={{ borderLeft: `4px solid ${getStatusColor('open')}` }}>
                    <span className="stat-label">Abiertos</span>
                    <span className="stat-value">{stats.open}</span>
                </div>
                <div className="stat-card glass-panel" style={{ borderLeft: `4px solid ${getStatusColor('in_progress')}` }}>
                    <span className="stat-label">En Curso</span>
                    <span className="stat-value">{stats.in_progress}</span>
                </div>
            </div>

            {/* CASES LIST */}
            <div className="cases-list-container">
                <div className="cases-list-wrapper glass-panel">
                    <table className="cases-table">
                        <thead>
                            <tr>
                                <th>Título / Cliente</th>
                                <th>Materia</th>
                                <th>Estado</th>
                                <th>Apertura</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>Cargando expedientes...</td></tr>
                            ) : activeCases.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                                        <div className="empty-state">
                                            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}><Archive size={64} style={{ opacity: 0.5 }} /></div>
                                            <h3>No hay expedientes activos</h3>
                                            <p>Convierte tus consultas entrantes en expedientes para empezar a gestionarlos aquí.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                activeCases.map(item => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="case-title-cell">
                                                <strong>{item.title}</strong>
                                                <small>{item.inquiry?.contact_email || 'Sin email'}</small>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="matter-badge">{item.matter}</span>
                                        </td>
                                        <td>
                                            <span className="status-badge" style={{ backgroundColor: `${getStatusColor(item.status)}20`, color: getStatusColor(item.status), border: `1px solid ${getStatusColor(item.status)}40` }}>
                                                {getStatusLabel(item.status)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="date-cell">{new Date(item.created_at).toLocaleDateString()}</span>
                                        </td>
                                        <td>
                                            <div className="action-cell">
                                                <Link href={`/dashboard/cases/${item.id}`} className="btn-view" title="Abrir Carpeta"><FolderOpen size={16} /></Link>
                                                <Link href={`/dashboard/clients?id=${item.inquiry_id}`} className="btn-chat" title="Ver Chat Original"><MessageSquare size={16} /></Link>
                                                <button onClick={() => setCaseToDelete(item)} className="btn-delete" title="Eliminar Expediente"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* VAULT SECTION */}
            <div className="vault-section">
                <button
                    className={`btn-vault-toggle ${showVault ? 'active' : ''}`}
                    onClick={() => setShowVault(!showVault)}
                >
                    <span style={{ fontSize: '1.2rem', display: 'flex' }}>{showVault ? <FolderOpen size={20} /> : <Folder size={20} />}</span>
                    Archivos del Estudio ({archivedCases.length})
                    <span className="vault-arrow">{showVault ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                </button>

                {showVault && (
                    <div className="vault-content glass-panel">
                        {archivedCases.length === 0 ? (
                            <p className="vault-empty">No hay expedientes archivados.</p>
                        ) : (
                            <table className="cases-table vault-table">
                                <thead>
                                    <tr>
                                        <th>Título / Cliente (Archivado)</th>
                                        <th>Materia</th>
                                        <th>Fecha Archivo</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {archivedCases.map(item => (
                                        <tr key={item.id}>
                                            <td style={{ opacity: 0.7 }}>
                                                <div className="case-title-cell">
                                                    <strong>{item.title}</strong>
                                                    <small>{item.inquiry?.contact_email}</small>
                                                </div>
                                            </td>
                                            <td style={{ opacity: 0.7 }}><span className="matter-badge">{item.matter}</span></td>
                                            <td style={{ opacity: 0.7 }}><span className="date-cell">{new Date(item.updated_at).toLocaleDateString()}</span></td>
                                            <td>
                                                <div className="action-cell">
                                                    <Link href={`/dashboard/cases/${item.id}`} className="btn-view" title="Abrir y Recuperar"><FolderOpen size={16} /></Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* DELETE MODAL */}
            {caseToDelete && (
                <div className="modal-overlay">
                    <div className="modal-box glass-panel">
                        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}><AlertTriangle size={48} className="text-amber-500" /></div>
                        <h2>¿Eliminar Expediente?</h2>
                        <p>Se borrará la "Carpeta Legal" <strong>{caseToDelete.title}</strong>.</p>
                        <p>El usuario y su chat NO se verán afectados.</p>
                        <div className="modal-actions">
                            <button onClick={() => setCaseToDelete(null)} className="btn-cancel">Cancelar</button>
                            <button onClick={handleDeleteCase} className="btn-confirm-delete">Sí, Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .cases-container { padding: 0 3rem 3rem; max-width: 1200px; margin: 0 auto; color: white; }
                
                @media (max-width: 900px) {
                    .cases-container { padding: 0 1.5rem 2rem; }
                }
                
                .breadcrumb { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 2rem; color: var(--muted); }
                .breadcrumb-item { color: var(--muted); text-decoration: none; transition: 0.2s; }
                .breadcrumb-item:hover { color: #fbbf24; }
                .breadcrumb-separator { opacity: 0.5; }
                .breadcrumb-current { color: #fbbf24; font-weight: 600; }

                .cases-header { margin-bottom: 2.5rem; }
                .header-flex { display: flex; align-items: center; gap: 2rem; }
                .header-icon-box { width: 80px; height: 80px; background: rgba(59, 130, 246, 0.1); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: #60a5fa; }
                .header-text p { color: var(--muted); margin-top: 0.2rem; }

                .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2.5rem; }
                .stat-card { padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
                .stat-label { font-size: 0.85rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
                .stat-value { font-size: 2rem; font-weight: 700; color: white; }

                .cases-list-container { width: 100%; overflow-x: auto; margin-bottom: 2rem; border-radius: 16px; -webkit-overflow-scrolling: touch; }
                .cases-list-wrapper { border-radius: 16px; overflow: hidden; background: rgba(15, 23, 42, 0.4); min-width: 700px; }
                .cases-table { width: 100%; border-collapse: collapse; text-align: left; }
                .cases-table th { padding: 1.2rem 1.5rem; background: rgba(30, 41, 59, 0.5); color: var(--muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; }
                .cases-table td { padding: 1.2rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; }
                .cases-table tr:hover td { background: rgba(255,255,255,0.02); }

                .case-title-cell { display: flex; flex-direction: column; }
                .case-title-cell strong { font-size: 1rem; color: white; }
                .case-title-cell small { font-size: 0.8rem; color: var(--muted); margin-top: 0.2rem; }

                .matter-badge { background: rgba(255,255,255,0.05); color: #e2e8f0; padding: 0.3rem 0.7rem; border-radius: 6px; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.1); }
                
                .status-badge { padding: 0.3rem 0.8rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }

                .date-cell { color: var(--muted); font-size: 0.9rem; }

                .action-cell { display: flex; gap: 0.8rem; }
                .btn-view, .btn-chat { 
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
                    color: white; width: 34px; height: 34px; border-radius: 8px; 
                    display: flex; align-items: center; justify-content: center; 
                    cursor: pointer; transition: 0.2s; text-decoration: none; font-size: 1.1rem;
                }
                .btn-view:hover { background: #60a5fa; color: white; transform: translateY(-2px); }
                .btn-chat:hover { background: #fbbf24; color: #0f172a; transform: translateY(-2px); }
                .btn-delete { 
                    background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); 
                    color: #ef4444; width: 34px; height: 34px; border-radius: 8px; 
                    display: flex; align-items: center; justify-content: center; 
                    cursor: pointer; transition: 0.2s; font-size: 1.1rem;
                }
                .btn-delete:hover { background: rgba(239, 68, 68, 0.2); transform: translateY(-2px); }

                .empty-state { color: var(--muted); }
                .empty-state h3 { color: white; margin-bottom: 0.5rem; }

                /* VAULT */
                .vault-section { margin-top: 3rem; margin-bottom: 2rem; }
                .btn-vault-toggle {
                    width: 100%; display: flex; align-items: center; gap: 1rem;
                    background: rgba(15, 23, 42, 0.6); color: var(--muted); border: 1px solid rgba(255,255,255,0.05);
                    padding: 1.5rem; border-radius: 12px; cursor: pointer; font-size: 1rem; transition: 0.2s;
                    text-align: left;
                }
                .btn-vault-toggle:hover { background: rgba(15, 23, 42, 0.8); color: white; border-color: rgba(255,255,255,0.1); }
                .btn-vault-toggle.active { background: #0f172a; border-color: #fbbf24; color: #fbbf24; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
                .vault-arrow { margin-left: auto; font-size: 0.8rem; opacity: 0.6; }
                
                .vault-content { 
                    border-top-left-radius: 0; border-top-right-radius: 0; 
                    border-top: none; padding: 0; overflow: hidden; animation: slideDown 0.3s ease-out;
                }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                
                .vault-empty { padding: 2rem; text-align: center; color: var(--muted); }
                .vault-table { background: rgba(0,0,0,0.2); }
                .vault-table td { border-bottom-color: rgba(255,255,255,0.02); }

                /* MODAL */
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 50; }
                .modal-box { padding: 2rem; max-width: 400px; text-align: center; border-radius: 16px; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); }
                .modal-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem; }
                .btn-cancel { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; }
                .btn-confirm-delete { background: #ef4444; border: none; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-weight: 600; }
                .empty-state h3 { color: white; margin-bottom: 0.5rem; }

                @media (max-width: 768px) {
                    .stats-grid { grid-template-columns: 1fr; }
                    
                    /* Hide less relevant columns on small screens */
                    .cases-table th:nth-child(2), .cases-table td:nth-child(2) { display: none; } /* Materia */
                    .cases-table th:nth-child(4), .cases-table td:nth-child(4) { display: none; } /* Apertura */
                    
                    /* Adjust table layout */
                    .cases-table th, .cases-table td { padding: 1rem 0.8rem; }
                    .status-badge { font-size: 0.7rem; padding: 0.2rem 0.5rem; }
                    
                    .cases-list-wrapper { min-width: 100%; } /* Allow wrapper to shrink */
                    .cases-table { min-width: 100%; }
                    
                    /* Cases list container should scroll if it really has to, but we try to fit content first */
                    .cases-list-container { overflow-x: auto; }
                    
                    .header-flex { flex-direction: column; text-align: center; gap: 1rem; }
                    .header-icon-box { margin: 0 auto; }
                }
            `}</style>
        </div>
    );
}
