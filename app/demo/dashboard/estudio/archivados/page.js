"use client";
import React, { useState } from 'react';
import { Archive, ShieldCheck, Bot, RotateCcw, Filter, RefreshCw, AlertCircle } from 'lucide-react';

const MATTER_LABELS = {
    civil: 'Civil', laboral: 'Laboral', penal: 'Penal', comercial: 'Comercial',
    familia: 'Familia', contencioso: 'Contencioso', administrativo: 'Administrativo',
    previsional: 'Previsional',
};

export default function DemoArchivadosPage() {
    const [filterMatter, setFilterMatter] = useState('');
    const [restoring, setRestoring] = useState(null);
    const [toast, setToast] = useState(null);

    const initialCases = [
        { id: '5', case_number: 'PEN 8820/2024', pjn_data: { expediente: '8820/2024' }, source: 'pjn_import', title: 'N.N. s/ Estafa y defraudación', matter: 'penal', status: 'archived', created_at: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString() },
        { id: '6', case_number: 'CIV 134/2019', pjn_data: { expediente: '134/2019' }, source: 'manual', title: 'González c/ López s/ Escrituración', matter: 'civil', status: 'archived', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() },
        { id: '7', case_number: 'LAB 999/2023', pjn_data: { expediente: '999/2023' }, source: 'pjn_import', title: 'Martínez, José c/ UOCRA s/ Despido', matter: 'laboral', status: 'archived', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString() }
    ];

    const [cases, setCases] = useState(initialCases);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleRestore = (caseId) => {
        setRestoring(caseId);
        setTimeout(() => {
            setCases(prev => prev.filter(c => c.id !== caseId));
            showToast('Expediente restaurado a la bandeja.');
            setRestoring(null);
        }, 600);
    };

    const refreshDemo = () => {
        setCases(initialCases);
        showToast('Datos de demo restaurados.', 'success');
    };

    const filteredCases = filterMatter ? cases.filter(c => c.matter === filterMatter) : cases;

    return (
        <div>
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 9999,
                    padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    background: toast.type === 'error' ? '#fee2e2' : '#d1fae5',
                    color: toast.type === 'error' ? '#991b1b' : '#065f46',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    transition: 'all 0.3s ease'
                }} role="alert" aria-live="assertive">
                    {toast.msg}
                </div>
            )}

            <div className="estudio-page-header">
                <h1 className="estudio-page-title">Archivados</h1>
                <p className="estudio-page-sub">Buzón central de expedientes archivados del estudio</p>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888', fontSize: 13 }}>
                    <Filter size={14} aria-hidden="true" /> Filtrar:
                </div>
                <select
                    className="estudio-select"
                    value={filterMatter}
                    aria-label="Filtrar por materia"
                    onChange={e => setFilterMatter(e.target.value)}
                >
                    <option value="">Todas las materias</option>
                    {Object.entries(MATTER_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                    ))}
                </select>
                <button
                    className="estudio-btn-ghost"
                    onClick={refreshDemo}
                    title="Restaurar datos de prueba"
                    aria-label="Restaurar la lista de la demo"
                    style={{ marginLeft: 'auto' }}
                >
                    <RefreshCw size={14} aria-hidden="true" /> Restaurar Demo
                </button>
            </div>

            <div className="estudio-card">
                <div className="estudio-card-header">
                    <h2 className="estudio-card-title">
                        <Archive size={14} style={{ display: 'inline', marginRight: 6 }} aria-hidden="true" />
                        {`${filteredCases.length} expediente${filteredCases.length !== 1 ? 's' : ''} archivado${filteredCases.length !== 1 ? 's' : ''}`}
                    </h2>
                </div>
                <div className="estudio-card-body" style={{ padding: 0 }}>
                    {filteredCases.length === 0 ? (
                        <div className="estudio-empty" style={{ padding: '48px 24px' }}>
                            <Archive size={40} className="estudio-empty-icon" aria-hidden="true" />
                            <p className="estudio-empty-title">Sin archivados</p>
                            <p className="estudio-empty-sub">No hay expedientes archivados con este filtro.</p>
                        </div>
                    ) : (
                        <table className="estudio-table">
                            <thead>
                                <tr>
                                    <th scope="col">N° Interno</th>
                                    <th scope="col">Origen</th>
                                    <th scope="col">Carátula / Título</th>
                                    <th scope="col">N° PJN</th>
                                    <th scope="col">Materia</th>
                                    <th scope="col">Archivado</th>
                                    <th scope="col"><span className="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCases.map(c => {
                                    const nroExpediente = c.pjn_data?.expediente || '—';
                                    return (
                                        <tr key={c.id}>
                                            <td style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', color: c.case_number ? 'inherit' : '#aaa' }}>
                                                {c.case_number || '—'}
                                            </td>
                                            <td>
                                                {c.source === 'pjn_import'
                                                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399' }} title="Importado del PJN"><ShieldCheck size={13} aria-hidden="true" /> PJN</span>
                                                    : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#60a5fa' }} title="Consulta IA"><Bot size={13} aria-hidden="true" /> IA</span>
                                                }
                                            </td>
                                            <td>
                                                <span style={{ maxWidth: 260, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500 }}>
                                                    {c.title}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 13, fontFamily: 'monospace', color: nroExpediente === '—' ? '#aaa' : 'inherit' }}>
                                                {nroExpediente}
                                            </td>
                                            <td>
                                                {c.matter
                                                    ? <span className="estudio-badge estudio-badge--neutral">{MATTER_LABELS[c.matter]}</span>
                                                    : <span style={{ color: '#aaa', fontSize: 13 }}>—</span>
                                                }
                                            </td>
                                            <td style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
                                                {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                            </td>
                                            <td>
                                                <button
                                                    className="estudio-btn-ghost"
                                                    onClick={() => handleRestore(c.id)}
                                                    disabled={restoring === c.id}
                                                    title="Restaurar a bandeja"
                                                    aria-label={`Restaurar expediente "${c.title}" a la bandeja`}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px' }}
                                                >
                                                    {restoring === c.id
                                                        ? <div className="estudio-spinner" style={{ width: 14, height: 14 }} />
                                                        : <><RotateCcw size={13} aria-hidden="true" /> Restaurar</>
                                                    }
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {cases.length > 0 && (
                <p style={{ fontSize: 12, color: '#888', marginTop: 12, textAlign: 'center' }}>
                    Restaurar devuelve el expediente a la Bandeja General sin asignación.
                </p>
            )}
        </div>
    );
}
