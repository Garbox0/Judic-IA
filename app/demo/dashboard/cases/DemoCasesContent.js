"use client";
import { useState, useEffect } from 'react';
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
import { demoCases } from '@/app/lib/demoData';
import '@/app/dashboard/cases/cases.css'; // Reuse real styles

/* --------------------------------------------------------------------------------
 * DEMO TOAST COMPONENT (Consistent with Clients Demo)
 * ------------------------------------------------------------------------------*/
const DemoToast = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const themes = {
        info: { class: 'info', icon: 'ℹ️' },
        success: { class: 'success', icon: '✅' },
        warning: { class: 'warning', icon: '⚠️' },
        error: { class: 'error', icon: '🚨' }
    };
    const theme = themes[type] || themes.info;

    return (
        <div className={`demo-toast-v2 ${theme.class}`}>
            <span className="toast-icon">{theme.icon}</span>
            <div className="toast-body">
                <p>{message}</p>
                {type === 'warning' && <p className="opacity-70 fs-0-75rem">Simulación de Demo</p>}
            </div>
            <button onClick={onClose} className="toast-btn-close">×</button>
        </div>
    );
};

import UsageGuideDemo from '@/app/components/UsageGuideDemo';
import { demoManuals } from '@/app/lib/demoManuals';

export default function DemoCasesPage() {
    const [cases, setCases] = useState(demoCases);
    const [stats, setStats] = useState({ open: 2, in_progress: 1, closed: 0 });
    const [caseToDelete, setCaseToDelete] = useState(null);
    const [showVault, setShowVault] = useState(false);
    const [toast, setToast] = useState(null);

    // Filter active vs archived
    // In demo data, we don't strictly have 'status' fields on the case object in lib/demoData.js 
    // Wait, let's check demoData again. 
    // demoCases has: id, caratula, nro_expediente, jurisdiccion, fuero, estado, ultima_actuacion...
    // usage in real page: c.status !== 'archived'. 
    // demoData cases don't have 'status' property, they have 'estado' (human readable string like "En Prueba").
    // I need to map them or add a status prop. 
    // I'll augment the data on load.

    useEffect(() => {
        // Augment demo data with 'status' for logic compatibility
        const augmented = demoCases.map(c => ({
            ...c,
            title: c.caratula, // Map caratula to title as used in real page
            matter: c.fuero,   // Map fuero to matter
            status: c.estado === 'Sentencia' ? 'closed' : 'open', // Simple mapping
            inquiry: { contact_email: 'demo@email.com' } // Stub inquiry
        }));
        setCases(augmented);

        // Mock stats
        setStats({ open: 2, in_progress: 0, closed: 1 });
    }, []);

    const activeCases = cases.filter(c => c.status !== 'archived');
    const archivedCases = cases.filter(c => c.status === 'archived');

    const showToast = (message, type) => setToast({ message, type });

    const handleDeleteCase = () => {
        if (!caseToDelete) return;

        // Remove from UI
        setCases(prev => prev.filter(c => c.id !== caseToDelete.id));
        setCaseToDelete(null);

        showToast("Expediente eliminado (Simulación)", "success");
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
            {toast && <DemoToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <nav className="cases-nav">
                <div className="breadcrumb">
                    <Link href="/demo/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Expedientes (Demo)</span>
                </div>
            </nav>

            <header className="cases-header">
                <div className="header-flex">
                    <div className="header-icon-box"><span className="text-4xl">📁</span></div>
                    <div className="header-text">
                        <h1 className="dashboard-page-title">Expedientes del Estudio</h1>
                        <p>Gestión centralizada de casos oficiales y carpetas legales.</p>
                    </div>
                </div>

                <UsageGuideDemo content={demoManuals.cases} />
            </header>

            {/* STATS OVERVIEW */}
            <div className="stats-grid">
                <div className="stat-card glass-panel">
                    <span className="stat-label">Total Expedientes</span>
                    <span className="stat-value">{cases.length}</span>
                </div>
                <div className="stat-card glass-panel open">
                    <span className="stat-label">Abiertos</span>
                    <span className="stat-value">{cases.filter(c => c.status === 'open').length}</span>
                </div>
                <div className="stat-card glass-panel in_progress">
                    <span className="stat-label">En Curso</span>
                    <span className="stat-value">{cases.filter(c => c.status === 'in_progress').length}</span>
                </div>
            </div>

            {/* CASES LIST */}
            < div className="cases-list-container" >
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
                            {activeCases.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center p-4rem-1rem">
                                        <div className="empty-state">
                                            <div className="flex-center mb-1rem"><Archive size={64} className="opacity-50" /></div>
                                            <h3>No hay expedientes activos</h3>
                                            <button onClick={() => window.location.reload()} className="btn-secondary">Reiniciar Demo</button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                activeCases.map(item => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="case-title-cell">
                                                <strong>{item.title}</strong>
                                                <small>{item.nro_expediente}</small>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="matter-badge">{item.matter}</span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${item.status}`}>
                                                {getStatusLabel(item.status)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="date-cell">{new Date().toLocaleDateString()}</span>
                                        </td>
                                        <td>
                                            <div className="action-cell">
                                                <button className="btn-view" title="Ver Carpeta (Demo)" onClick={() => showToast("La vista de detalle de expediente está limitada en esta demo.", "warning")}><FolderOpen size={16} /></button>
                                                <Link href="/demo/dashboard/clients" className="btn-chat" title="Ver Chat Original"><MessageSquare size={16} /></Link>
                                                <button onClick={() => setCaseToDelete(item)} className="btn-delete" title="Eliminar Expediente"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div >

            {/* VAULT SECTION (Static for demo) */}
            < div className="vault-section" >
                <button
                    className={`btn-vault-toggle ${showVault ? 'active' : ''}`}
                    onClick={() => setShowVault(!showVault)}
                >
                    <span className="display-flex font-1-2rem">{showVault ? <FolderOpen size={20} /> : <Folder size={20} />}</span>
                    Archivos del Estudio ({archivedCases.length})
                    <span className="vault-arrow">{showVault ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                </button>

                {
                    showVault && (
                        <div className="vault-content glass-panel">
                            <p className="vault-empty">No hay expedientes archivados en la demo.</p>
                        </div>
                    )
                }
            </div >

            {/* DELETE MODAL */}
            {
                caseToDelete && (
                    <div className="modal-overlay-dark">
                        <div className="modal-box-demo glass-panel">
                            <div className="flex-center mb-1rem"><AlertTriangle size={48} className="text-amber-500" /></div>
                            <h2>¿Eliminar Expediente?</h2>
                            <p className="mb-2rem text-muted">Se borrará la "Carpeta Legal" <strong>{caseToDelete.title}</strong> de la vista demo.</p>
                            <div className="modal-actions flex-center gap-1rem">
                                <button onClick={() => setCaseToDelete(null)} className="btn-cancel btn-cancel-demo">Cancelar</button>
                                <button onClick={handleDeleteCase} className="btn-confirm-delete btn-confirm-delete-demo">Sí, Eliminar</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
