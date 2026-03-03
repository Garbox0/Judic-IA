"use client";
import React, { useState, useRef } from 'react';
import { Search, ShieldCheck, Bot, Inbox, UserCheck, Archive, AlertCircle } from 'lucide-react';

const MATTER_LABELS = {
    civil: 'Civil', laboral: 'Laboral', penal: 'Penal', comercial: 'Comercial',
    familia: 'Familia', contencioso: 'Contencioso', administrativo: 'Administrativo',
    previsional: 'Previsional',
};
const STATUS_COLORS = { open: '#94a3b8', in_progress: '#34d399', resolved: '#60a5fa', archived: '#f87171' };

export default function DemoBuscarPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef(null);

    const mockDatabase = [
        { id: '1', case_number: 'CFP 1234/2025', pjn_data: { expediente: '1234/2025' }, source: 'pjn_import', title: 'Pérez, Juan c/ Estado Nacional s/ Amparo', matter: 'contencioso', status: 'in_progress', assigned_to: 'dm', assigned_profile: { full_name: 'Dr. Martínez' }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
        { id: '2', case_number: 'CIV 5678/2026', pjn_data: { expediente: '5678/2026' }, source: 'manual', title: 'Díaz, Carlos s/ Sucesión Ab-Intestato', matter: 'familia', status: 'open', assigned_to: null, assigned_profile: null, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
        { id: '3', case_number: 'COM 9012/2025', pjn_data: { expediente: '9012/2025' }, source: 'pjn_import', title: 'Consorcio Rivadavia 4500 c/ Gómez s/ Ejec. de Expensas', matter: 'comercial', status: 'resolved', assigned_to: 'dl', assigned_profile: { full_name: 'Dra. López' }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
        { id: '4', case_number: 'LAB 3456/2024', pjn_data: { expediente: '3456/2024' }, source: 'manual', title: 'González, Mariana c/ Telecom Argentina s/ Despido', matter: 'laboral', status: 'in_progress', assigned_to: 'dg', assigned_profile: { full_name: 'Dr. García' }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString() },
        { id: '5', case_number: 'PEN 8820/2024', pjn_data: { expediente: '8820/2024' }, source: 'pjn_import', title: 'N.N. s/ Estafa y defraudación', matter: 'penal', status: 'archived', assigned_to: 'df', assigned_profile: { full_name: 'Dra. Fernández' }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString() }
    ];

    const doSearch = (q) => {
        const trimmed = q.trim().toLowerCase();
        if (!trimmed || trimmed.length < 2) { setResults(null); return; }

        setLoading(true);

        setTimeout(() => {
            const filtered = mockDatabase.filter(c =>
                c.title.toLowerCase().includes(trimmed) ||
                (c.pjn_data?.expediente && c.pjn_data.expediente.includes(trimmed)) ||
                (c.case_number && c.case_number.toLowerCase().includes(trimmed))
            );
            setResults(filtered);
            setLoading(false);
        }, 400); // simulate network latency
    };

    const handleInput = (e) => {
        const val = e.target.value;
        setQuery(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(val), 380);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        clearTimeout(debounceRef.current);
        doSearch(query);
    };

    const getStatusBadge = (c) => {
        if (c.status === 'archived') return { label: 'Archivado', color: STATUS_COLORS.archived, icon: <Archive size={12} /> };
        if (!c.assigned_to) return { label: 'En Bandeja', color: '#f59e0b', icon: <Inbox size={12} /> };
        return {
            label: c.assigned_profile?.full_name || 'Asignado',
            color: STATUS_COLORS[c.status] || '#94a3b8',
            icon: <UserCheck size={12} />,
        };
    };

    return (
        <div>
            <div className="estudio-page-header">
                <h1 className="estudio-page-title">Buscar expedientes</h1>
                <p className="estudio-page-sub">Por carátula, partes o número de expediente</p>
            </div>

            <form onSubmit={handleSubmit} role="search" aria-label="Buscar expedientes del estudio">
                <div style={{ position: 'relative', marginBottom: 24, maxWidth: 560 }}>
                    <Search
                        size={16}
                        style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }}
                        aria-hidden="true"
                    />
                    <input
                        type="search"
                        className="estudio-input"
                        placeholder="Ej: García c/ Empresa, 12345/2020…"
                        value={query}
                        onChange={handleInput}
                        aria-label="Buscar por carátula o número de expediente"
                        autoFocus
                        style={{ paddingLeft: 40, paddingRight: 16, fontSize: 15 }}
                    />
                </div>
            </form>

            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }} role="status" aria-live="polite" aria-label="Buscando...">
                    <div className="estudio-spinner" />
                </div>
            )}

            {!loading && results === null && (
                <div className="estudio-empty" style={{ padding: '56px 24px' }}>
                    <Search size={40} className="estudio-empty-icon" aria-hidden="true" />
                    <p className="estudio-empty-title">Ingresá al menos 2 caracteres para buscar</p>
                    <p className="estudio-empty-sub">Podés buscar por carátula, nombre de parte o número de expediente</p>
                </div>
            )}

            {!loading && results !== null && results.length === 0 && (
                <div className="estudio-empty" style={{ padding: '56px 24px' }} role="status" aria-live="polite">
                    <AlertCircle size={40} className="estudio-empty-icon" aria-hidden="true" />
                    <p className="estudio-empty-title">Sin resultados</p>
                    <p className="estudio-empty-sub">No se encontraron expedientes para "{query}"</p>
                </div>
            )}

            {!loading && results && results.length > 0 && (
                <div className="estudio-card" role="region" aria-label={`${results.length} resultados de búsqueda`}>
                    <div className="estudio-card-header">
                        <h2 className="estudio-card-title">
                            <Search size={14} style={{ display: 'inline', marginRight: 6 }} aria-hidden="true" />
                            {results.length} resultado{results.length !== 1 ? 's' : ''}
                        </h2>
                    </div>
                    <div className="estudio-card-body" style={{ padding: 0 }}>
                        <table className="estudio-table">
                            <thead>
                                <tr>
                                    <th scope="col">N° Interno</th>
                                    <th scope="col">Origen</th>
                                    <th scope="col">Carátula / Título</th>
                                    <th scope="col">N° PJN</th>
                                    <th scope="col">Materia</th>
                                    <th scope="col">Estado / Asignación</th>
                                    <th scope="col">Ingreso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map(c => {
                                    const badge = getStatusBadge(c);
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
                                                    {c.title || '(sin título)'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 13, fontFamily: 'monospace', color: nroExpediente === '—' ? '#aaa' : 'inherit' }}>
                                                {nroExpediente}
                                            </td>
                                            <td>
                                                {c.matter
                                                    ? <span className="estudio-badge estudio-badge--neutral">{MATTER_LABELS[c.matter] || c.matter}</span>
                                                    : <span style={{ color: '#aaa', fontSize: 13 }}>—</span>
                                                }
                                            </td>
                                            <td>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: badge.color }}>
                                                    {badge.icon}
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
                                                {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
