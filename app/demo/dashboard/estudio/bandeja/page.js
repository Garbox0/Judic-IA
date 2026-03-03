"use client";
import React, { useState } from 'react';
import { Inbox, ShieldCheck, Bot, CheckCircle, Clock, Filter, RefreshCw } from 'lucide-react';

const MATTER_LABELS = {
    civil: 'Civil', laboral: 'Laboral', penal: 'Penal', comercial: 'Comercial',
    familia: 'Familia', contencioso: 'Contencioso', administrativo: 'Administrativo',
};

export default function DemoEstudioBandejaPage() {
    const [filterMatter, setFilterMatter] = useState('');
    const [taking, setTaking] = useState(null);
    const [assigning, setAssigning] = useState(null);
    const [toast, setToast] = useState(null);

    const initialCases = [
        { id: '1', case_number: 'CFP 1234/2025', source: 'pjn_import', title: 'Pérez, Juan c/ Estado Nacional s/ Amparo', matter: 'contencioso', status: 'pending', created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
        { id: '2', case_number: 'CIV 5678/2026', source: 'manual', title: 'Díaz, Carlos s/ Sucesión Ab-Intestato', matter: 'familia', status: 'pending', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
        { id: '3', case_number: 'COM 9012/2025', source: 'pjn_import', title: 'Consorcio Rivadavia 4500 c/ Gómez s/ Ejecución de Expensas', matter: 'comercial', status: 'pending', created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
        { id: '4', case_number: 'LAB 3456/2024', source: 'manual', title: 'González, Mariana c/ Telecom Argentina s/ Despido', matter: 'laboral', status: 'pending', created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString() },
        { id: '5', case_number: 'PEN 8820/2024', source: 'pjn_import', title: 'N.N. s/ Estafa y defraudación', matter: 'penal', status: 'in_progress', created_at: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString() },
        { id: '6', case_number: 'CIV 1023/2025', source: 'manual', title: 'Alvarez, Julieta c/ OSDE s/ Amparo de Salud', matter: 'civil', status: 'pending', created_at: new Date(Date.now() - 1000 * 60 * 60 * 144).toISOString() },
        { id: '7', case_number: '', source: 'manual', title: 'Consulta extrajudicial - Accidente de tránsito', matter: 'civil', status: 'pending', created_at: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString() }
    ];

    const [cases, setCases] = useState(initialCases);

    const members = [
        { user_id: 'dm', profile: { full_name: 'Dr. Martínez' } },
        { user_id: 'dl', profile: { full_name: 'Dra. López' } },
        { user_id: 'dg', profile: { full_name: 'Dr. García' } },
        { user_id: 'df', profile: { full_name: 'Dra. Fernández' } }
    ];

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleTomar = (caseId) => {
        setTaking(caseId);
        setTimeout(() => {
            setCases(prev => prev.filter(c => c.id !== caseId));
            showToast('Expediente tomado correctamente. Se movió a tu panel personal.');
            setTaking(null);
        }, 800);
    };

    const handleAssign = (caseId, targetUserId) => {
        setAssigning(caseId);
        setTimeout(() => {
            const name = members.find(m => m.user_id === targetUserId)?.profile?.full_name || 'el abogado';
            setCases(prev => prev.filter(c => c.id !== caseId));
            showToast(`Expediente asignado exitosamente a ${name}.`);
            setAssigning(null);
        }, 800);
    };

    const refreshDemo = () => {
        setCases(initialCases);
        showToast('Bandeja de prueba restaurada a su estado inicial.', 'success');
    }

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
                }}>
                    {toast.msg}
                </div>
            )}

            <div className="estudio-page-header">
                <h1 className="estudio-page-title">Bandeja General</h1>
                <p className="estudio-page-sub">Expedientes sin asignar del estudio</p>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888', fontSize: 13 }}>
                    <Filter size={14} /> Filtrar:
                </div>
                <select
                    className="estudio-select"
                    value={filterMatter}
                    onChange={e => setFilterMatter(e.target.value)}
                >
                    <option value="">Todas las materias</option>
                    {Object.entries(MATTER_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                    ))}
                </select>
                <button
                    className="estudio-btn-ghost"
                    onClick={refreshDemo}
                    title="Restaurar datos de prueba"
                    style={{ marginLeft: 'auto' }}
                >
                    <RefreshCw size={14} /> Restaurar Demo
                </button>
            </div>

            <div className="estudio-card">
                <div className="estudio-card-header">
                    <h2 className="estudio-card-title">
                        <Inbox size={14} style={{ display: 'inline', marginRight: 6 }} />
                        {`${filteredCases.length} expediente${filteredCases.length !== 1 ? 's' : ''} disponible${filteredCases.length !== 1 ? 's' : ''}`}
                    </h2>
                </div>
                <div className="estudio-card-body" style={{ padding: 0 }}>
                    {filteredCases.length === 0 ? (
                        <div className="estudio-empty" style={{ padding: '48px 24px' }}>
                            <Inbox size={40} className="estudio-empty-icon" />
                            <p className="estudio-empty-title">Bandeja vacía</p>
                            <p className="estudio-empty-sub">No hay expedientes en esta materia o ya fueron asignados.</p>
                        </div>
                    ) : (
                        <table className="estudio-table">
                            <thead>
                                <tr>
                                    <th scope="col">N° Interno</th>
                                    <th scope="col">Origen</th>
                                    <th scope="col">Carátula / Título</th>
                                    <th scope="col">Materia</th>
                                    <th scope="col">Estado</th>
                                    <th scope="col">Ingreso</th>
                                    <th scope="col"><span className="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCases.map(c => (
                                    <tr key={c.id}>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', color: c.case_number ? 'inherit' : '#aaa' }}>
                                            {c.case_number || '—'}
                                        </td>
                                        <td>
                                            {c.source === 'pjn_import'
                                                ? <span title="Importado del PJN" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399' }}><ShieldCheck size={14} /> PJN</span>
                                                : <span title="Consulta IA" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#60a5fa' }}><Bot size={14} /> IA</span>
                                            }
                                        </td>
                                        <td>
                                            <span className="estudio-row-title" style={{ maxWidth: 220, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {c.title}
                                            </span>
                                        </td>
                                        <td>
                                            {c.matter ? (
                                                <span className="estudio-badge estudio-badge--neutral">{MATTER_LABELS[c.matter]}</span>
                                            ) : <span style={{ color: '#aaa', fontSize: 13 }}>—</span>}
                                        </td>
                                        <td>
                                            {c.status === 'in_progress'
                                                ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399', fontSize: 12 }}><Clock size={12} /> En curso</span>
                                                : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8', fontSize: 12 }}><Clock size={12} /> Abierto</span>
                                            }
                                        </td>
                                        <td style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
                                            {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                        </td>
                                        <td>
                                            {taking === c.id || assigning === c.id ? (
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <div className="estudio-spinner" style={{ width: 16, height: 16 }} />
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    <button
                                                        className="estudio-btn-primary"
                                                        style={{ padding: '6px 14px', fontSize: 13 }}
                                                        onClick={() => handleTomar(c.id)}
                                                    >
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <CheckCircle size={13} /> Tomar
                                                        </span>
                                                    </button>
                                                    <select
                                                        className="estudio-select"
                                                        defaultValue=""
                                                        aria-label="Asignar expediente a un abogado del equipo"
                                                        style={{ padding: '5px 8px', fontSize: 12, minWidth: 120 }}
                                                        onChange={e => {
                                                            if (e.target.value) {
                                                                handleAssign(c.id, e.target.value);
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                    >
                                                        <option value="" disabled>Asignar a…</option>
                                                        {members.map(m => (
                                                            <option key={m.user_id} value={m.user_id}>
                                                                {m.profile.full_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
