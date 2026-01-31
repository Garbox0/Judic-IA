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
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';
import './cases.css';

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
                    <UsageGuide content={dashboardManuals.cases} />
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


        </div>
    );
}
