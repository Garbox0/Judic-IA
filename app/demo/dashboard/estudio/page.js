"use client";
import React from 'react';
import Link from 'next/link';
import { Inbox, Users, ChevronRight, ShieldCheck, Bot } from 'lucide-react';

export default function DemoEstudioOverviewPage() {
    const stats = { miembros: 4, bandeja: 12, enCurso: 85, total: 142 };

    const recentBandeja = [
        { id: 1, title: 'Pérez, Juan c/ Estado Nacional s/ Amparo', matter: 'Derecho Constitucional', source: 'pjn_import', case_number: 'CFP 1234/2025' },
        { id: 2, title: 'Díaz, Carlos s/ Sucesión Ab-Intestato', matter: 'Familia', source: 'manual', case_number: 'CIV 5678/2026' },
        { id: 3, title: 'Consorcio Rivadavia 4500 c/ Gómez s/ Ejecución', matter: 'Comercial', source: 'pjn_import', case_number: 'COM 9012/2025' }
    ];

    const recentMembers = [
        { user_id: 1, role: 'owner', profile: { full_name: 'Dr. Martínez' } },
        { user_id: 2, role: 'supervisor', profile: { full_name: 'Dra. López' } },
        { user_id: 3, role: 'abogado', profile: { full_name: 'Dr. García' } },
        { user_id: 4, role: 'abogado', profile: { full_name: 'Dra. Fernández' } }
    ];

    const ROLE_LABELS = { owner: 'Titular', supervisor: 'Supervisor', abogado: 'Abogado', lawyer: 'Abogado' };

    return (
        <div>
            <div className="estudio-page-header">
                <h1 className="estudio-page-title">Resumen del Estudio</h1>
                <p className="estudio-page-sub">Estudio Martínez & Asociados</p>
            </div>

            {/* Stats */}
            <div className="estudio-stats">
                <div className="estudio-stat-card">
                    <span className="estudio-stat-label">Miembros</span>
                    <span className="estudio-stat-value gold">{stats.miembros}</span>
                </div>
                <div className="estudio-stat-card">
                    <span className="estudio-stat-label">En Bandeja</span>
                    <span className="estudio-stat-value blue">{stats.bandeja}</span>
                </div>
                <div className="estudio-stat-card">
                    <span className="estudio-stat-label">En Curso</span>
                    <span className="estudio-stat-value emerald">{stats.enCurso}</span>
                </div>
                <div className="estudio-stat-card">
                    <span className="estudio-stat-label">Total</span>
                    <span className="estudio-stat-value">{stats.total}</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20 }}>
                {/* Bandeja reciente */}
                <div className="estudio-card">
                    <div className="estudio-card-header">
                        <h2 className="estudio-card-title"><Inbox size={14} style={{ display: 'inline', marginRight: 6 }} />Bandeja General</h2>
                        <Link href="/demo/dashboard/estudio/bandeja" style={{ fontSize: 12, color: '#c9a227', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            Ver todo <ChevronRight size={13} />
                        </Link>
                    </div>
                    <div className="estudio-card-body">
                        {recentBandeja.map(c => (
                            <div key={c.id} className="estudio-table-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                    {c.source === 'pjn_import'
                                        ? <ShieldCheck size={14} style={{ color: '#34d399', flexShrink: 0 }} />
                                        : <Bot size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
                                    }
                                    <div style={{ minWidth: 0 }}>
                                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#c9a227', display: 'block' }}>{c.case_number}</span>
                                        <span className="estudio-row-title">{c.title}</span>
                                    </div>
                                </div>
                                <span className="estudio-row-meta">{c.matter}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Miembros recientes */}
                <div className="estudio-card">
                    <div className="estudio-card-header">
                        <h2 className="estudio-card-title"><Users size={14} style={{ display: 'inline', marginRight: 6 }} />Miembros</h2>
                        <Link href="/demo/dashboard/estudio/miembros" style={{ fontSize: 12, color: '#c9a227', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            Ver todo <ChevronRight size={13} />
                        </Link>
                    </div>
                    <div className="estudio-card-body">
                        {recentMembers.map(m => (
                            <div key={m.user_id} className="estudio-table-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(201,162,39,0.1)', border: '1px solid rgba(201,162,39,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#c9a227', flexShrink: 0 }}>
                                        {m.profile.full_name.replace('Dr. ', '').replace('Dra. ', '').slice(0, 2).toUpperCase()}
                                    </div>
                                    <span className="estudio-row-title">{m.profile.full_name}</span>
                                </div>
                                <span className={`estudio-badge estudio-badge--${m.role}`}>{ROLE_LABELS[m.role]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
