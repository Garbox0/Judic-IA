"use client";
import React, { useState, useEffect } from 'react';
import {
    Globe,
    MapPin,
    ShieldCheck,
    Clock,
    UserPlus,
    BookOpen,
    MessageCircle,
    ChevronDown,
    ExternalLink,
    Scale,
    Building2,
    GraduationCap,
    FileText,
    ChevronRight,
    Users,
    Landmark,
    CheckCircle2
} from 'lucide-react';
import '@/app/dashboard/federal/federal.css';
import UsageGuideDemo from '@/app/components/UsageGuideDemo';
import { demoManuals } from '@/app/lib/demoManuals';
import { demoLawyers } from '@/app/lib/demoData';
import { survivalGuides } from '@/app/lib/federalDirectory';
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
                <p className="opacity-70 fs-0-75rem">Simulacion de Demo</p>
            </div>
            <button onClick={onClose} className="toast-btn-close" aria-label="Cerrar notificacion">×</button>
        </div>,
        document.body
    );
};

/* ── DEMO DIRECTORY DATA (placeholder links) ── */
const demoDirectory = [
    {
        province: 'CABA',
        fullName: 'Ciudad Autonoma de Buenos Aires',
        poderJudicial: { name: 'Poder Judicial CABA', url: '#' },
        expedientes: { name: 'Consulta de Expedientes (EJE)', url: '#' },
        colegio: { name: 'Colegio Publico de Abogados CABA', url: '#' },
        mev: { name: 'Mesa de Entradas Virtual (MEV)', url: '#' },
        extras: [{ name: 'Centro de Mediacion', url: '#' }],
    },
    {
        province: 'Buenos Aires',
        fullName: 'Provincia de Buenos Aires',
        poderJudicial: { name: 'SCBA - Suprema Corte', url: '#' },
        expedientes: { name: 'MEV (Augusta)', url: '#' },
        colegio: { name: 'Colegio de Abogados (COLPROBA)', url: '#' },
        mev: { name: 'Notificaciones Electronicas', url: '#' },
        extras: [],
    },
    {
        province: 'Córdoba',
        fullName: 'Provincia de Cordoba',
        poderJudicial: { name: 'Poder Judicial de Cordoba', url: '#' },
        expedientes: { name: 'SAC (Sistema de Administracion de Causas)', url: '#' },
        colegio: { name: 'Colegio de Abogados de Cordoba', url: '#' },
        mev: { name: 'Actuaciones Electronicas', url: '#' },
        extras: [],
    },
    {
        province: 'Mendoza',
        fullName: 'Provincia de Mendoza',
        poderJudicial: { name: 'Poder Judicial de Mendoza', url: '#' },
        expedientes: { name: 'GDE - Gestion Digital de Expedientes', url: '#' },
        colegio: { name: 'Colegio de Abogados de Mendoza', url: '#' },
        mev: null,
        extras: [],
    },
    {
        province: 'Santa Fe',
        fullName: 'Provincia de Santa Fe',
        poderJudicial: { name: 'Poder Judicial de Santa Fe', url: '#' },
        expedientes: { name: 'MOE - Modulo de Operaciones Electronicas', url: '#' },
        colegio: { name: 'Colegio de Abogados de Santa Fe', url: '#' },
        mev: { name: 'Notificaciones Electronicas', url: '#' },
        extras: [],
    },
    {
        province: 'Federal',
        fullName: 'Justicia Nacional y Federal',
        poderJudicial: { name: 'Poder Judicial de la Nacion', url: '#' },
        expedientes: { name: 'Consulta de Expedientes (CIJ)', url: '#' },
        colegio: { name: 'FACA - Federacion Argentina de Colegios de Abogados', url: '#' },
        mev: { name: 'EJE - Expediente Judicial Electronico', url: '#' },
        extras: [
            { name: 'SAIJ - Sistema Argentino de Informacion Juridica', url: '#' },
            { name: 'InfoLEG - Informacion Legislativa', url: '#' },
        ],
    },
];

export default function DemoFederalContent() {
    const [searchResults, setSearchResults] = useState([]);
    const [selectedProv, setSelectedProv] = useState("");
    const [toast, setToast] = useState(null);

    // Directory state
    const [dirProv, setDirProv] = useState("");
    const [dirData, setDirData] = useState(null);

    // Guides state
    const [expandedGuide, setExpandedGuide] = useState(null);

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

    const handleDirSearch = (prov) => {
        setDirProv(prov);
        if (!prov) {
            setDirData(null);
            return;
        }
        const found = demoDirectory.find(d => d.province === prov);
        setDirData(found || null);
    };

    const guideIcons = {
        FileText: <FileText size={18} />,
        Globe: <Globe size={18} />,
        Users: <Users size={18} />,
        Shield: <ShieldCheck size={18} />,
    };

    return (
        <div className="fed-container">
            {toast && <DemoToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="fed-header">
                <div className="fed-badge">Entorno Sandbox - Hub Federal</div>
                <h1>Hub Federal <Globe size={28} className="text-amber-400" /></h1>
                <p>Nexo interjurisdiccional para la Red de Colegas y Recursos Nacionales.</p>
                <UsageGuideDemo content={demoManuals.federal} />

                {/* Network stats (demo values) */}
                <div className="fed-stats-row">
                    <div className="fed-stat">
                        <Users size={16} />
                        <span><strong>12</strong> corresponsales activos</span>
                    </div>
                    <div className="fed-stat">
                        <MapPin size={16} />
                        <span><strong>5</strong> provincias cubiertas</span>
                    </div>
                    <div className="fed-stat">
                        <Landmark size={16} />
                        <span><strong>6</strong> jurisdicciones en directorio</span>
                    </div>
                </div>
            </header>

            <div className="fed-grid">
                {/* 1. RED DE CORRESPONSALES */}
                <div className="fed-card">
                    <div className="fed-icon-box" style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                        <UserPlus size={24} />
                    </div>
                    <h3>Red de Corresponsales</h3>
                    <p>Colabora con colegas verificados de todo el pais para delegar tareas judiciales locales en un entorno seguro.</p>

                    <div className="fed-select-group">
                        <label htmlFor="jurisdiccion-select">Jurisdiccion de Busqueda</label>
                        <div className="fed-select-wrapper">
                            <select
                                id="jurisdiccion-select"
                                className="fed-select"
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
                                <span>Selecciona una provincia para ver colegas de prueba.</span>
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
                                                ? lawyer.especialidades.slice(0, 2).join(' - ')
                                                : 'Generalista'}
                                        </span>
                                        {lawyer.coverage_zones?.length > 0 && (
                                            <span className="fed-lawyer-zone">Zona: {lawyer.coverage_zones.join(', ')}</span>
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
                        <Building2 size={24} />
                    </div>
                    <h3>Directorio Judicial Nacional</h3>
                    <p>Acceso directo a portales judiciales, consulta de expedientes, colegios de abogados y MEV de cada jurisdiccion.</p>

                    <div className="fed-select-group">
                        <label htmlFor="dir-prov-select">Seleccionar Jurisdiccion</label>
                        <div className="fed-select-wrapper">
                            <select
                                id="dir-prov-select"
                                className="fed-select"
                                value={dirProv}
                                onChange={(e) => handleDirSearch(e.target.value)}
                            >
                                <option value="">Elegir jurisdiccion...</option>
                                <option value="Federal">Justicia Nacional y Federal</option>
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

                    {!dirData && (
                        <div className="fed-lawyer-placeholder" style={{ marginTop: '1.5rem' }}>
                            <Landmark size={24} className="opacity-50" />
                            <span>Selecciona una jurisdiccion para ver portales y recursos.</span>
                        </div>
                    )}

                    {dirData && (
                        <div className="fed-dir-results">
                            <div className="fed-dir-title">{dirData.fullName}</div>

                            <a href={dirData.poderJudicial.url} onClick={(e) => { e.preventDefault(); showToast('Demo: enlace de ejemplo — no redirige.', 'info'); }} className="fed-dir-link">
                                <div className="fed-dir-link-left">
                                    <div className="fed-dir-link-icon" style={{ color: '#10b981' }}>
                                        <Scale size={16} />
                                    </div>
                                    <div>
                                        <div className="fed-dir-link-name">{dirData.poderJudicial.name}</div>
                                        <div className="fed-dir-link-label">Poder Judicial</div>
                                    </div>
                                </div>
                                <ExternalLink size={14} className="fed-dir-link-arrow" />
                            </a>

                            <a href={dirData.expedientes.url} onClick={(e) => { e.preventDefault(); showToast('Demo: enlace de ejemplo — no redirige.', 'info'); }} className="fed-dir-link">
                                <div className="fed-dir-link-left">
                                    <div className="fed-dir-link-icon" style={{ color: '#3b82f6' }}>
                                        <FileText size={16} />
                                    </div>
                                    <div>
                                        <div className="fed-dir-link-name">{dirData.expedientes.name}</div>
                                        <div className="fed-dir-link-label">Consulta de Expedientes</div>
                                    </div>
                                </div>
                                <ExternalLink size={14} className="fed-dir-link-arrow" />
                            </a>

                            <a href={dirData.colegio.url} onClick={(e) => { e.preventDefault(); showToast('Demo: enlace de ejemplo — no redirige.', 'info'); }} className="fed-dir-link">
                                <div className="fed-dir-link-left">
                                    <div className="fed-dir-link-icon" style={{ color: '#a855f7' }}>
                                        <GraduationCap size={16} />
                                    </div>
                                    <div>
                                        <div className="fed-dir-link-name">{dirData.colegio.name}</div>
                                        <div className="fed-dir-link-label">Colegio de Abogados</div>
                                    </div>
                                </div>
                                <ExternalLink size={14} className="fed-dir-link-arrow" />
                            </a>

                            {dirData.mev && (
                                <a href={dirData.mev.url} onClick={(e) => { e.preventDefault(); showToast('Demo: enlace de ejemplo — no redirige.', 'info'); }} className="fed-dir-link fed-dir-link-highlight">
                                    <div className="fed-dir-link-left">
                                        <div className="fed-dir-link-icon" style={{ color: '#fbbf24' }}>
                                            <Building2 size={16} />
                                        </div>
                                        <div>
                                            <div className="fed-dir-link-name">{dirData.mev.name}</div>
                                            <div className="fed-dir-link-label">Mesa de Entradas Virtual</div>
                                        </div>
                                    </div>
                                    <ExternalLink size={14} className="fed-dir-link-arrow" />
                                </a>
                            )}

                            {dirData.extras.length > 0 && dirData.extras.map((extra, i) => (
                                <a key={i} href={extra.url} onClick={(e) => { e.preventDefault(); showToast('Demo: enlace de ejemplo — no redirige.', 'info'); }} className="fed-dir-link">
                                    <div className="fed-dir-link-left">
                                        <div className="fed-dir-link-icon" style={{ color: '#64748b' }}>
                                            <Globe size={16} />
                                        </div>
                                        <div>
                                            <div className="fed-dir-link-name">{extra.name}</div>
                                            <div className="fed-dir-link-label">Recurso Adicional</div>
                                        </div>
                                    </div>
                                    <ExternalLink size={14} className="fed-dir-link-arrow" />
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. GUÍAS DE SUPERVIVENCIA */}
                <div className="fed-card fed-card-full">
                    <div className="fed-icon-box" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                        <BookOpen size={24} />
                    </div>
                    <h3>Guias de Supervivencia Juridica</h3>
                    <p>Protocolos paso a paso para tramites frecuentes ante organismos y tribunales.</p>

                    <div className="fed-guides-list">
                        {survivalGuides.map(guide => (
                            <div key={guide.id} className="fed-guide-item">
                                <button
                                    className="fed-guide-header"
                                    onClick={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}
                                >
                                    <div className="fed-guide-header-left">
                                        <div className="fed-guide-icon">
                                            {guideIcons[guide.icon] || <FileText size={18} />}
                                        </div>
                                        <div>
                                            <div className="fed-guide-title">{guide.title}</div>
                                            <div className="fed-guide-meta">
                                                <span className="fed-guide-category">{guide.category}</span>
                                                <span className="fed-guide-difficulty">{guide.difficulty}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight
                                        size={18}
                                        className={`fed-guide-chevron ${expandedGuide === guide.id ? 'fed-guide-chevron-open' : ''}`}
                                    />
                                </button>

                                {expandedGuide === guide.id && (
                                    <div className="fed-guide-body">
                                        <div className="fed-guide-section">
                                            <h4>Pasos</h4>
                                            <ol className="fed-guide-steps">
                                                {guide.steps.map((step, i) => (
                                                    <li key={i}>
                                                        <span className="fed-step-number">{i + 1}</span>
                                                        <span>{step}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                        <div className="fed-guide-section">
                                            <h4>Tips</h4>
                                            <ul className="fed-guide-tips">
                                                {guide.tips.map((tip, i) => (
                                                    <li key={i}>
                                                        <CheckCircle2 size={14} className="fed-tip-icon" />
                                                        <span>{tip}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="fed-footer">
                <p>&copy; 2026 Judic-IA - Centro de Recursos Interjurisdiccionales - Modo Sandbox</p>
            </div>
        </div>
    );
}
