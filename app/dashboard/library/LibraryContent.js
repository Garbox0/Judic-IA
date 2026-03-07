"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { Brain, Library, ExternalLink, Copy, FileText, Trash2, Check, BookOpen, Scale } from 'lucide-react';
import { demoLibrary } from '../../lib/demoData';
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';
import './library.css';

export default function LibraryPage() {
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [jurisdictionFilter, setJurisdictionFilter] = useState('');
    const [cases, setCases] = useState([]);
    const [jurisdictions, setJurisdictions] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [toast, setToast] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [activeTab, setActiveTab] = useState('jurisprudencias');

    useEffect(() => {
        fetchJurisdictions();
        checkAdmin();
    }, []);

    useEffect(() => {
        fetchLibrary();
    }, [activeTab]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchLibrary();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, jurisdictionFilter]);

    // Auto-hide toast
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 2500);
        return () => clearTimeout(t);
    }, [toast]);

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email === 'gbrlescalada@gmail.com') {
            setIsAdmin(true);
        }
    };

    const showToast = (message) => {
        setToast(message);
    };

    const fetchJurisdictions = async () => {
        const { data } = await supabase.from('case_library').select('jurisdiction');
        if (data && data.length > 0) {
            const unique = [...new Set(data.map(item => item.jurisdiction))].filter(Boolean);
            setJurisdictions(unique);
        } else {
            // Demo fallback
            const unique = [...new Set(demoLibrary.map(item => item.jurisdiction))].filter(Boolean);
            setJurisdictions(unique);
        }
    };

    const fetchLibrary = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('case_library')
                .select('*')
                .order('created_at', { ascending: false });

            if (activeTab === 'doctrinas') {
                query = query.eq('type', 'doctrina');
            } else {
                query = query.or('type.is.null,type.eq.jurisprudencia');
            }

            if (searchTerm) {
                query = query.or(`autos.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);
            }

            if (jurisdictionFilter) {
                query = query.eq('jurisdiction', jurisdictionFilter);
            }

            const { data, error } = await query.limit(50);

            if (error || !data || data.length === 0) {
                if (activeTab === 'doctrinas') {
                    setCases([]);
                } else {
                    let filtered = demoLibrary;
                    if (searchTerm) {
                        const lower = searchTerm.toLowerCase();
                        filtered = filtered.filter(c =>
                            c.autos.toLowerCase().includes(lower) ||
                            c.summary.toLowerCase().includes(lower)
                        );
                    }
                    if (jurisdictionFilter) {
                        filtered = filtered.filter(c => c.jurisdiction === jurisdictionFilter);
                    }
                    setCases(filtered);
                }
            } else {
                setCases(data);
            }

        } catch (error) {
            console.error("Library fetch error:", error);
            setCases(activeTab === 'doctrinas' ? [] : demoLibrary);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (item) => {
        navigator.clipboard.writeText(`${item.autos} - ${item.url}`);
        showToast('Cita copiada al portapapeles');
    };

    const handleDelete = async (item) => {
        if (!confirm(`¿Eliminar "${item.autos}" de la biblioteca?`)) return;
        setDeletingId(item.id);
        try {
            const { error } = await supabase.from('case_library').delete().eq('id', item.id);
            if (error) throw error;
            setCases(prev => prev.filter(c => c.id !== item.id));
            showToast('Recurso eliminado');
        } catch (e) {
            showToast('Error al eliminar');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="library-container">
            <nav className="library-nav">
                <div className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Jurisprudencias</span>
                </div>
            </nav>

            <header className="library-header">
                <div className="header-content">
                    <h1><Scale size={48} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.8rem', color: '#ec4899' }} /> Jurisprudencias y Doctrinas</h1>
                    <p>Índice colaborativo de fallos, precedentes y doctrina jurídica.</p>
                </div>
                <UsageGuide content={dashboardManuals.library} />

                <div className="library-tabs" role="tablist">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'jurisprudencias'}
                        className={`library-tab${activeTab === 'jurisprudencias' ? ' active' : ''}`}
                        onClick={() => setActiveTab('jurisprudencias')}
                    >
                        <Scale size={16} aria-hidden="true" /> Jurisprudencias
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'doctrinas'}
                        className={`library-tab${activeTab === 'doctrinas' ? ' active' : ''}`}
                        onClick={() => setActiveTab('doctrinas')}
                    >
                        <BookOpen size={16} aria-hidden="true" /> Doctrinas
                    </button>
                </div>

                <div className="search-bar-container glass-panel">
                    <input
                        id="library-search"
                        name="library-search"
                        aria-label={`Buscar en ${activeTab}`}
                        autoComplete="off"
                        type="text"
                        placeholder={activeTab === 'jurisprudencias' ? 'Buscar por autos, tema o fallo...' : 'Buscar por autor, título o tema...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    {activeTab === 'jurisprudencias' && (
                        <select
                            id="jurisdiction-filter"
                            name="jurisdiction-filter"
                            aria-label="Filtrar por jurisdicción"
                            autoComplete="off"
                            value={jurisdictionFilter}
                            onChange={(e) => setJurisdictionFilter(e.target.value)}
                            className="jurisdiction-select"
                        >
                            <option value="">Todas las Jurisdicciones</option>
                            {jurisdictions.map(j => (
                                <option key={j} value={j}>{j}</option>
                            ))}
                        </select>
                    )}
                </div>
            </header>

            <div className="library-grid">
                {loading ? (
                    <div className="loading-state">Cargando {activeTab}...</div>
                ) : cases.length === 0 ? (
                    <div className="empty-state">
                        <span style={{ display: 'block', marginBottom: '1rem' }}>
                            {activeTab === 'doctrinas'
                                ? <BookOpen size={64} style={{ opacity: 0.5 }} />
                                : <Library size={64} style={{ opacity: 0.5 }} />}
                        </span>
                        <h3>{activeTab === 'doctrinas' ? 'Sin Doctrinas' : 'Sin Jurisprudencias'}</h3>
                        <p>{activeTab === 'doctrinas'
                            ? 'Próximamente podrás agregar artículos y textos doctrinarios.'
                            : 'Realizá investigaciones en el módulo de Estrategia IA para poblar este índice.'}</p>
                    </div>
                ) : (
                    cases.map(item => (
                        <div key={item.id || item.url} className="library-card glass-panel">
                            <div className="card-header">
                                <span className="jurisdiction-tag">{item.jurisdiction || 'General'}</span>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {isAdmin && (
                                        <button
                                            className="btn-delete"
                                            title="Eliminar recurso"
                                            aria-label="Eliminar recurso"
                                            disabled={deletingId === item.id}
                                            onClick={() => handleDelete(item)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                    {(item.pdf_url || item.url) && (
                                        <a
                                            href={item.pdf_url || item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="card-link"
                                            aria-label={`Abrir: ${item.autos}`}
                                        >
                                            <ExternalLink size={18} />
                                        </a>
                                    )}
                                </div>
                            </div>
                            <h3 className="card-title">{item.autos}</h3>
                            <p className="card-summary">{item.summary}</p>
                            <div className="card-footer">
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button
                                        className="btn-copy"
                                        onClick={() => handleCopy(item)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Copy size={12} /> Copiar Cita
                                    </button>
                                    {item.pdf_url && (
                                        <a
                                            href={item.pdf_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-pdf"
                                        >
                                            <FileText size={12} /> Ver PDF
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {toast && (
                <div className="library-toast" role="alert" aria-live="polite">
                    <Check size={16} aria-hidden="true" />
                    {toast}
                </div>
            )}
        </div>
    );
}
