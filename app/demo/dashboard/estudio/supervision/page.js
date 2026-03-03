"use client";
import React, { useState } from 'react';
import { BarChart2, Filter, RefreshCw, ShieldCheck, Bot, AlertCircle, Inbox, Archive } from 'lucide-react';

const STATUS_LABELS = { open: 'Abierto', in_progress: 'En curso', resolved: 'Resuelto', archived: 'Archivado' };
const STATUS_COLORS = { open: '#94a3b8', in_progress: '#34d399', resolved: '#60a5fa', archived: '#f87171' };
const MATTER_LABELS = {
    civil: 'Civil', laboral: 'Laboral', penal: 'Penal', comercial: 'Comercial',
    familia: 'Familia', contencioso: 'Contencioso', administrativo: 'Administrativo',
};

export default function DemoSupervisionPage() {
    const [filterMember, setFilterMember] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterMatter, setFilterMatter] = useState('');
    const [assigning, setAssigning] = useState(null);
    const [archiving, setArchiving] = useState(null);
    const [toast, setToast] = useState(null);

    const initialCases = [
        { id: '1', case_number: 'CFP 1234/2025', source: 'pjn_import', title: 'Pérez, Juan c/ Estado Nacional s/ Amparo', matter: 'contencioso', status: 'in_progress', assigned_to: 'dm', assigned_profile: { full_name: 'Dr. Martínez' }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
        { id: '2', case_number: 'CIV 5678/2026', source: 'manual', title: 'Díaz, Carlos s/ Sucesión Ab-Intestato', matter: 'familia', status: 'open', assigned_to: null, assigned_profile: null, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
        { id: '3', case_number: 'COM 9012/2025', source: 'pjn_import', title: 'Consorcio Rivadavia 4500 c/ Gómez s/ Ejec. de Expensas', matter: 'comercial', status: 'resolved', assigned_to: 'dl', assigned_profile: { full_name: 'Dra. López' }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
        { id: '4', case_number: 'LAB 3456/2024', source: 'manual', title: 'González, Mariana c/ Telecom Argentina s/ Despido', matter: 'laboral', status: 'in_progress', assigned_to: 'dg', assigned_profile: { full_name: 'Dr. García' }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString() }
    ];

    const members = [
        { user_id: 'dm', profile: { full_name: 'Dr. Martínez' } },
        { user_id: 'dl', profile: { full_name: 'Dra. López' } },
        { user_id: 'dg', profile: { full_name: 'Dr. García' } },
        { user_id: 'df', profile: { full_name: 'Dra. Fernández' } }
    ];

    const [cases, setCases] = useState(initialCases);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleAssign = (caseId, targetUserId) => {
        setAssigning(caseId);
        setTimeout(() => {
            const assignedProfile = targetUserId ? members.find(m => m.user_id === targetUserId)?.profile || null : null;
            setCases(prev => prev.map(c =>
                c.id === caseId ? { ...c, assigned_to: targetUserId || null, assigned_profile: assignedProfile } : c
            ));
            showToast(targetUserId ? 'Expediente reasignado correctamente.' : 'Expediente devuelto a la bandeja.');
            setAssigning(null);
        }, 600);
    };

    const handleArchive = (caseId, title) => {
        if (!confirm(`¿Archivar "${title || 'este expediente'}"? Se moverá al buzón de archivados del estudio.`)) return;
        setArchiving(caseId);
        setTimeout(() => {
            setCases(prev => prev.filter(c => c.id !== caseId));
            showToast('Expediente enviado a archivados.');
            setArchiving(null);
        }, 600);
    };

    const filteredCases = cases.filter(c => {
        if (filterMember === 'null' && c.assigned_to !== null) return false;
        if (filterMember && filterMember !== 'null' && c.assigned_to !== filterMember) return false;
        if (filterStatus && c.status !== filterStatus) return false;
        if (filterMatter && c.matter !== filterMatter) return false;
        return true;
    });

    const refreshDemo = () => {
        setCases(initialCases);
        showToast('Datos de demo restaurados.', 'success');
    };

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
                <h1 className="estudio-page-title">Supervisión</h1>
                <p className="estudio-page-sub">Todos los expedientes del estudio</p>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888', fontSize: 13 }}>
                    <Filter size={14} /> Filtrar:
                </div>
                <select className="estudio-select" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
                    <option value="">Todos los abogados</option>
                    <option value="null">Sin asignar</option>
                    {members.map(m => (
                        <option key={m.user_id} value={m.user_id}>
                            {m.profile.full_name}
                        </option>
                    ))}
                </select>
                <select className="estudio-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">Todos los estados</option>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                    ))}
                </select>
                <select className="estudio-select" value={filterMatter} onChange={e => setFilterMatter(e.target.value)}>
                    <option value="">Todas las materias</option>
                    {Object.entries(MATTER_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
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
                        <BarChart2 size={14} style={{ display: 'inline', marginRight: 6 }} />
                        {`${filteredCases.length} expediente${filteredCases.length !== 1 ? 's' : ''}`}
                    </h2>
                </div>
                <div className="estudio-card-body" style={{ padding: 0 }}>
                    {filteredCases.length === 0 ? (
                        <div className="estudio-empty" style={{ padding: '48px 24px' }}>
                            <AlertCircle size={40} className="estudio-empty-icon" />
                            <p className="estudio-empty-title">Sin resultados</p>
                            <p className="estudio-empty-sub">No hay expedientes que coincidan con los filtros</p>
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
                                    <th scope="col">Asignado a</th>
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
                                                ? <span title="PJN" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399' }}><ShieldCheck size={13} /> PJN</span>
                                                : <span title="IA" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#60a5fa' }}><Bot size={13} /> IA</span>
                                            }
                                        </td>
                                        <td>
                                            <span style={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500 }}>
                                                {c.title}
                                            </span>
                                        </td>
                                        <td>
                                            {c.matter
                                                ? <span className="estudio-badge estudio-badge--neutral">{MATTER_LABELS[c.matter]}</span>
                                                : <span style={{ color: '#aaa', fontSize: 13 }}>—</span>
                                            }
                                        </td>
                                        <td>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS[c.status] || '#888' }}>
                                                {STATUS_LABELS[c.status] || c.status}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 13 }}>
                                            {c.assigned_profile?.full_name
                                                ? c.assigned_profile.full_name
                                                : <span style={{ color: '#aaa' }}>Sin asignar</span>
                                            }
                                        </td>
                                        <td style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
                                            {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                        </td>
                                        <td>
                                            {assigning === c.id || archiving === c.id ? (
                                                <div className="estudio-spinner" style={{ width: 16, height: 16 }} />
                                            ) : (
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    <select
                                                        className="estudio-select"
                                                        defaultValue=""
                                                        aria-label={`Asignar expediente "${c.title}" a un abogado`}
                                                        style={{ padding: '4px 8px', fontSize: 12, minWidth: 130 }}
                                                        onChange={e => {
                                                            if (e.target.value) {
                                                                handleAssign(c.id, e.target.value);
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                    >
                                                        <option value="" disabled>Asignar a…</option>
                                                        {members.map(m => (
                                                            <option
                                                                key={m.user_id}
                                                                value={m.user_id}
                                                                disabled={m.user_id === c.assigned_to}
                                                            >
                                                                {m.profile.full_name}
                                                                {m.user_id === c.assigned_to ? ' ✓' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {c.assigned_to && (
                                                        <button
                                                            className="estudio-btn-ghost"
                                                            title="Devolver a bandeja"
                                                            aria-label="Devolver expediente a la bandeja sin asignar"
                                                            onClick={() => handleAssign(c.id, null)}
                                                            style={{ padding: '4px 8px', fontSize: 12 }}
                                                        >
                                                            <Inbox size={13} />
                                                        </button>
                                                    )}
                                                    <button
                                                        className="estudio-btn-ghost"
                                                        title="Archivar expediente"
                                                        aria-label={`Archivar expediente "${c.title}"`}
                                                        onClick={() => handleArchive(c.id, c.title)}
                                                        style={{ padding: '4px 8px', fontSize: 12, color: '#f87171' }}
                                                    >
                                                        <Archive size={13} />
                                                    </button>
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
