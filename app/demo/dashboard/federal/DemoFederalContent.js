"use client";
import React, { useState, useEffect } from 'react';
import {
    Globe,
    ArrowRight,
    MapPin,
    ShieldCheck,
    HelpCircle,
    Clock,
    UserPlus,
    BookOpen,
    MessageCircle,
    ChevronDown,
    AlertCircle
} from 'lucide-react';
import '@/app/dashboard/federal/federal.css';
import UsageGuideDemo from '@/app/components/UsageGuideDemo';
import { demoManuals } from '@/app/lib/demoManuals';
import { demoLawyers } from '@/app/lib/demoData';
import { createPortal } from 'react-dom';

/* ── DEMO TOAST ── */
const DemoToast = ({ message, type = 'info', onClose }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    if (!mounted) return null;

    const themes = {
        info: { class: 'info', icon: '\u2139\uFE0F', color: '#60a5fa' },
        success: { class: 'success', icon: '\u2705', color: '#4ade80' },
        warning: { class: 'warning', icon: '\u26A0\uFE0F', color: '#fbbf24' },
        error: { class: 'error', icon: '\uD83D\uDEA8', color: '#f87171' }
    };
    const theme = themes[type] || themes.info;

    return createPortal(
        <div className={`demo-toast-v2 ${theme.class}`} style={{ top: '1rem', right: '5rem', position: 'fixed', zIndex: 99999 }}>
            <span className="toast-icon">{theme.icon}</span>
            <div className="toast-body">
                <p>{message}</p>
                <p className="opacity-70 fs-0-75rem">Simulación de Demo</p>
            </div>
            <button onClick={onClose} className="toast-btn-close" aria-label="Cerrar notificación">×</button>
        </div>,
        document.body
    );
};

export default function DemoFederalContent() {
    const [searchResults, setSearchResults] = useState([]);
    const [selectedProv, setSelectedProv] = useState("");
    const [toast, setToast] = useState(null);
    const [directoryFeedback, setDirectoryFeedback] = useState(null);

    const handleSearch = (prov) => {
        setSelectedProv(prov);
        if (!prov) {
            setSearchResults([]);
            return;
        }
        const filtered = demoLawyers.filter(l => l.jurisdiccion === prov);
        setSearchResults(filtered);
    };

    const showToast = (message, type) => setToast({ message, type });

    const showDirectoryMsg = (msg) => {
        setDirectoryFeedback(msg);
        setTimeout(() => setDirectoryFeedback(null), 4000);
    };

    return (
        <div className="fed-container">
            {toast && <DemoToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <UsageGuideDemo content={demoManuals.federal} mode="inline" />

            <header className="fed-header">
                <div className="fed-badge">Entorno Sandbox • Hub Federal</div>
                <h1>Hub Federal <Globe size={28} className="text-amber-400" /></h1>
                <p>Nexo interjurisdiccional para la Red de Colegas y Recursos Nacionales.</p>
            </header>

            <div className="fed-grid">
                {/* 1. RED DE CORRESPONSALES */}
                <div className="fed-card">
                    <div className="fed-icon-box" style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                        <UserPlus size={24} />
                    </div>
                    <h3>Red de Corresponsales</h3>
                    <p>Colaborá con colegas verificados de todo el país para delegar tareas judiciales locales en un entorno seguro.</p>

                    <div className="fed-select-group">
                        <label htmlFor="jurisdiccion-select">Jurisdicción de Búsqueda</label>
                        <div className="fed-select-wrapper">
                            <select
                                id="jurisdiccion-select"
                                value={selectedProv}
                                onChange={(e) => handleSearch(e.target.value)}
                            >
                                <option value="">Selecciona una Provincia...</option>
                                <option value="CABA">CABA</option>
                                <option value="Buenos Aires">Buenos Aires</option>
                                <option value="Córdoba">Córdoba</option>
                                <option value="Mendoza">Mendoza</option>
                                <option value="Santa Fe">Santa Fe</option>
                            </select>
                            <div className="fed-chevron">
                                <ChevronDown size={20} />
                            </div>
                        </div>
                    </div>

                    <div className="fed-lawyer-list">
                        {!selectedProv && (
                            <div className="fed-lawyer-placeholder">
                                <MapPin size={24} className="opacity-50" />
                                <span>Seleccioná una provincia para ver colegas de prueba.</span>
                            </div>
                        )}
                        {selectedProv && searchResults.length === 0 && (
                            <div className="fed-lawyer-placeholder">
                                <UserPlus size={24} className="opacity-50" />
                                <span>No se encontraron colegas en esta zona demo.</span>
                            </div>
                        )}
                        {searchResults.map(lawyer => (
                            <div key={lawyer.id} className="fed-lawyer-card">
                                <div className="fed-lawyer-info">
                                    <div className="fed-lawyer-avatar">
                                        {lawyer.full_name.charAt(0)}
                                    </div>
                                    <div className="fed-lawyer-details">
                                        <h4>{lawyer.full_name}</h4>
                                        <span className="fed-lawyer-specialty">
                                            {lawyer.especialidades && lawyer.especialidades.length > 0
                                                ? lawyer.especialidades.slice(0, 2).join(' • ')
                                                : 'Generalista'}
                                        </span>
                                        {lawyer.coverage_areas && (
                                            <span className="fed-lawyer-zone">Zona: {lawyer.coverage_areas}</span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    className="fed-lawyer-action-btn"
                                    onClick={() => showToast(`Chat con ${lawyer.full_name} abierto`, "success")}
                                    aria-label="Conectar"
                                    title="Iniciar chat seguro"
                                >
                                    <MessageCircle size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. DIRECTORIO NACIONAL */}
                <div className="fed-card">
                    <div className="fed-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <Clock size={24} />
                    </div>
                    <h3>Directorio Nacional</h3>
                    <p>Buscador de organismos judiciales, padrones y contactos oficiales de todo el territorio nacional.</p>

                    {directoryFeedback && (
                        <div className="fed-feedback-bar">
                            <AlertCircle size={16} className="text-blue-400 shrink-0" />
                            <span>{directoryFeedback}</span>
                        </div>
                    )}

                    <div className="fed-btn-list">
                        <button className="fed-full-btn" onClick={() => showDirectoryMsg("Simulación: Acceso al Buscador de Padrones Nacionales.")}>
                            <div className="flex items-center gap-3">
                                <div className="fed-btn-icon-box text-blue-400">
                                    <Globe size={18} />
                                </div>
                                <span>Padrones Federales</span>
                            </div>
                            <ArrowRight size={18} className="fed-btn-arrow" />
                        </button>
                        <button className="fed-full-btn" onClick={() => showDirectoryMsg("Simulación: Base de datos de oficinas judiciales.")}>
                            <div className="flex items-center gap-3">
                                <div className="fed-btn-icon-box text-emerald-400">
                                    <HelpCircle size={18} />
                                </div>
                                <span>Oficinas Judiciales</span>
                            </div>
                            <ArrowRight size={18} className="fed-btn-arrow" />
                        </button>
                    </div>
                </div>

                {/* 3. GUÍAS PRO */}
                <div className="fed-card">
                    <div className="fed-icon-box" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                        <BookOpen size={24} />
                    </div>
                    <h3>Guías de Supervivencia</h3>
                    <p>Protocolos paso a paso para trámites ante organismos específicos y tribunales de distintas provincias.</p>
                    <div className="mt-4">
                        <button
                            className="fed-full-btn"
                            style={{ justifyContent: 'center', borderColor: 'rgba(251, 191, 36, 0.3)', color: '#fbbf24' }}
                            onClick={() => showToast("Disponible solo para planes Profesionales.", "warning")}
                        >
                            <ShieldCheck size={18} className="mr-2" /> Explorar Protocolos PRO
                        </button>
                    </div>
                </div>
            </div>

            <div className="fed-footer">
                <p>© 2026 Judic-IA • Centro de Recursos Interjurisdiccionales • Modo Sandbox</p>
            </div>
        </div>
    );
}
