"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { Newspaper, ExternalLink, Search, RefreshCw, AlertCircle, FileText, Building2, Megaphone, Scale, X, BookOpen, ChevronRight } from 'lucide-react';
import './boletin.css';

const SECCIONES = [
    { id: 'primera', label: 'Primera Sección', icon: Scale, desc: 'Leyes, decretos y resoluciones' },
    { id: 'segunda', label: 'Segunda Sección', icon: Building2, desc: 'Sociedades y avisos judiciales' },
    { id: 'tercera', label: 'Tercera Sección', icon: Megaphone, desc: 'Contrataciones' },
    { id: 'cuarta', label: 'Cuarta Sección', icon: FileText, desc: 'Dominios de Internet' },
];

const NORMA_PATTERN = /^(ley|decreto|resoluc|disposic|decisi[oó]n|circular)/i;

export default function BoletinContent() {
    const [session, setSession] = useState(null);
    const [seccion, setSeccion] = useState('primera');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');

    const [drawer, setDrawer] = useState(null);
    const [drawerContent, setDrawerContent] = useState(null);
    const [drawerLoading, setDrawerLoading] = useState(false);
    const [drawerError, setDrawerError] = useState(null);
    const drawerRef = useRef(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(searchTerm), 500);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const fetchBoletin = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ seccion });
            if (debouncedQ) params.set('q', debouncedQ);
            const res = await fetch(`/api/boletin?${params}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al cargar el Boletín Oficial');
            setItems(data.items || []);
        } catch (err) {
            setError(err.message);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [session, seccion, debouncedQ]);

    useEffect(() => { fetchBoletin(); }, [fetchBoletin]);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') closeDrawer(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const openDrawer = useCallback(async (item) => {
        setDrawer(item);
        setDrawerContent(null);
        setDrawerError(null);
        setDrawerLoading(true);
        try {
            const res = await fetch(`/api/infoleg?q=${encodeURIComponent(item.norma)}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al cargar InfoLeg');
            setDrawerContent(data);
        } catch (err) {
            setDrawerError(err.message);
        } finally {
            setDrawerLoading(false);
        }
    }, [session]);

    const closeDrawer = () => {
        setDrawer(null);
        setDrawerContent(null);
        setDrawerError(null);
    };

    const activeSeccion = SECCIONES.find(s => s.id === seccion);

    return (
        <div className="boletin-container">
            <nav className="boletin-nav">
                <div className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Boletín Oficial</span>
                </div>
            </nav>

            <header className="boletin-header">
                <div className="boletin-header-content">
                    <Newspaper size={40} className="boletin-icon" aria-hidden="true" />
                    <div>
                        <h1>Boletín Oficial</h1>
                        <p>República Argentina — Publicaciones diarias oficiales</p>
                    </div>
                </div>

                <div className="boletin-search glass-panel">
                    <Search size={18} className="search-icon" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Buscar en el boletín..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        aria-label="Buscar en el Boletín Oficial"
                        className="boletin-search-input"
                    />
                    {loading && <RefreshCw size={16} className="spin" aria-label="Cargando" />}
                </div>

                <div className="boletin-tabs" role="tablist">
                    {SECCIONES.map(s => {
                        const Icon = s.icon;
                        return (
                            <button
                                key={s.id}
                                role="tab"
                                aria-selected={seccion === s.id}
                                className={`boletin-tab${seccion === s.id ? ' active' : ''}`}
                                onClick={() => setSeccion(s.id)}
                            >
                                <Icon size={15} aria-hidden="true" />
                                <span className="tab-label">{s.label}</span>
                                <span className="tab-desc">{s.desc}</span>
                            </button>
                        );
                    })}
                </div>
            </header>

            <div className="boletin-body">
                {error ? (
                    <div className="boletin-error glass-panel">
                        <AlertCircle size={24} aria-hidden="true" />
                        <div>
                            <strong>No se pudo cargar el Boletín Oficial</strong>
                            <p>{error}</p>
                        </div>
                        <button className="btn-retry" onClick={fetchBoletin}>Reintentar</button>
                    </div>
                ) : loading && items.length === 0 ? (
                    <div className="boletin-loading">
                        <RefreshCw size={32} className="spin" aria-hidden="true" />
                        <p>Cargando publicaciones...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="boletin-empty">
                        <FileText size={48} aria-hidden="true" />
                        <h3>Sin publicaciones</h3>
                        <p>{debouncedQ ? `No hay resultados para "${debouncedQ}" en esta sección.` : 'No hay publicaciones disponibles en esta sección por el momento.'}</p>
                    </div>
                ) : (
                    <>
                        <p className="boletin-count">
                            {items.length} publicación{items.length !== 1 ? 'es' : ''}{debouncedQ && ` para "${debouncedQ}"`} · {activeSeccion?.label}
                        </p>
                        <ul className="boletin-list">
                            {items.map((item, i) => {
                                const hasInfoleg = item.norma && NORMA_PATTERN.test(item.norma);
                                return (
                                    <li key={item.link || i} className="boletin-item glass-panel">
                                        {item.rubro && (
                                            <span className="boletin-category">{item.rubro}</span>
                                        )}
                                        <div className="boletin-item-header">
                                            <h3 className="boletin-item-title">
                                                {item.norma && <span className="boletin-norma">{item.norma}</span>}
                                                {item.titulo && <span className="boletin-emisor">{item.titulo}</span>}
                                            </h3>
                                            <div className="boletin-item-actions">
                                                {hasInfoleg && (
                                                    <button
                                                        className="btn-infoleg"
                                                        onClick={() => openDrawer(item)}
                                                        title="Ver texto completo en InfoLeg"
                                                        aria-label={`Ver texto completo de ${item.norma}`}
                                                    >
                                                        <BookOpen size={14} aria-hidden="true" />
                                                        <span>Texto completo</span>
                                                        <ChevronRight size={13} aria-hidden="true" />
                                                    </button>
                                                )}
                                                {item.link && (
                                                    <a
                                                        href={item.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="boletin-item-link"
                                                        aria-label={`Ver en Boletín Oficial: ${item.norma || item.titulo}`}
                                                    >
                                                        <ExternalLink size={16} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        {item.fecha && (
                                            <time className="boletin-item-date">{item.fecha}</time>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </div>

            {/* InfoLeg Drawer */}
            {drawer && (
                <div className="infoleg-overlay" onClick={closeDrawer} aria-modal="true" role="dialog" aria-label={`Texto completo: ${drawer.norma}`}>
                    <aside className="infoleg-drawer" ref={drawerRef} onClick={e => e.stopPropagation()}>
                        <div className="infoleg-drawer-header">
                            <div className="infoleg-drawer-meta">
                                <span className="infoleg-badge">InfoLeg</span>
                                <h2 className="infoleg-drawer-title">{drawer.norma}</h2>
                                {drawer.titulo && <p className="infoleg-drawer-sub">{drawer.titulo}</p>}
                            </div>
                            <div className="infoleg-drawer-actions">
                                {drawerContent?.url && (
                                    <a
                                        href={drawerContent.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-infoleg-ext"
                                        title="Abrir en InfoLeg"
                                        aria-label="Abrir texto completo en InfoLeg"
                                    >
                                        <ExternalLink size={15} />
                                    </a>
                                )}
                                <button className="btn-close-drawer" onClick={closeDrawer} aria-label="Cerrar panel">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="infoleg-drawer-body">
                            {drawerLoading ? (
                                <div className="infoleg-loading">
                                    <RefreshCw size={28} className="spin" />
                                    <p>Cargando desde InfoLeg...</p>
                                </div>
                            ) : drawerError ? (
                                <div className="infoleg-fetch-error">
                                    <AlertCircle size={20} />
                                    <div>
                                        <strong>No se pudo cargar</strong>
                                        <p>{drawerError}</p>
                                    </div>
                                </div>
                            ) : drawerContent ? (
                                <div
                                    className="infoleg-content"
                                    dangerouslySetInnerHTML={{ __html: drawerContent.html }}
                                />
                            ) : null}
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
