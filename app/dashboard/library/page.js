"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { Brain, Library, ExternalLink, Copy, Search, Filter } from 'lucide-react';

import { demoLibrary } from '../../lib/demoData';

export default function LibraryPage() {
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [jurisdictionFilter, setJurisdictionFilter] = useState('');
    const [cases, setCases] = useState([]);
    const [jurisdictions, setJurisdictions] = useState([]);

    useEffect(() => {
        fetchLibrary();
        fetchJurisdictions();
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchLibrary();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, jurisdictionFilter]);

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

            if (searchTerm) {
                query = query.or(`autos.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);
            }

            if (jurisdictionFilter) {
                query = query.eq('jurisdiction', jurisdictionFilter);
            }

            const { data, error } = await query.limit(50);

            // If error or empty, use demo data
            if (error || !data || data.length === 0) {
                // Filter demo data locally if needed
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
            } else {
                setCases(data);
            }

        } catch (error) {
            console.error("Library fetch error:", error);
            // Fallback on crash
            setCases(demoLibrary);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="library-container">
            <nav className="library-nav">
                <div className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Biblioteca del Estudio</span>
                </div>
            </nav>

            <header className="library-header">
                <div className="header-content">
                    <h1><Brain size={48} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.8rem', color: '#ec4899' }} /> Base de Conocimiento</h1>
                    <p>Índice colaborativo de jurisprudencia y precedentes investigados.</p>
                </div>

                <div className="search-bar-container glass-panel">
                    <input
                        type="text"
                        placeholder="Buscar por autos, tema o fallo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    <select
                        value={jurisdictionFilter}
                        onChange={(e) => setJurisdictionFilter(e.target.value)}
                        className="jurisdiction-select"
                    >
                        <option value="">Todas las Jurisdicciones</option>
                        {jurisdictions.map(j => (
                            <option key={j} value={j}>{j}</option>
                        ))}
                    </select>
                </div>
            </header>

            <div className="library-grid">
                {loading ? (
                    <div className="loading-state">Cargando biblioteca...</div>
                ) : cases.length === 0 ? (
                    <div className="empty-state">
                        <span style={{ display: 'block', marginBottom: '1rem' }}><Library size={64} style={{ opacity: 0.5 }} /></span>
                        <h3>Biblioteca Vacía</h3>
                        <p>Realiza investigaciones en el módulo de Jurisprudencia para poblar este índice.</p>
                    </div>
                ) : (
                    cases.map(item => (
                        <div key={item.id || item.url} className="library-card glass-panel">
                            <div className="card-header">
                                <span className="jurisdiction-tag">{item.jurisdiction || 'General'}</span>
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="card-link"><ExternalLink size={18} /></a>
                            </div>
                            <h3 className="card-title">{item.autos}</h3>
                            <p className="card-summary">{item.summary}</p>
                            <div className="card-footer">
                                <button
                                    className="btn-copy"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${item.autos} - ${item.url}`);
                                        alert("Cita copiada al portapapeles");
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Copy size={12} /> Copiar Cita
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <style jsx>{`
                .library-container { padding: 0 3rem 3rem; max-width: 1200px; margin: 0 auto; color: white; }
                
                @media (max-width: 900px) {
                    .library-container { padding: 0 1.5rem 2rem; }
                    .header-content h1 { font-size: 1.6rem; }
                }

                .breadcrumb { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 2rem; color: var(--muted); }
                .breadcrumb-item { color: var(--muted); text-decoration: none; transition: 0.2s; }
                .breadcrumb-item:hover { color: #fbbf24; }
                .breadcrumb-separator { opacity: 0.5; }
                .breadcrumb-current { color: #fbbf24; font-weight: 600; }

                .library-header { margin-bottom: 2rem; }
                .header-content h1 { font-size: 2rem; margin-bottom: 0.5rem; }
                .header-content p { color: var(--muted); margin-bottom: 1.5rem; }

                .search-bar-container { 
                    display: flex; gap: 1rem; padding: 1rem; background: rgba(30, 41, 59, 0.6); 
                    border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
                    flex-wrap: wrap;
                }
                .search-input { 
                    flex: 1; min-width: 250px; background: transparent; border: none; 
                    font-size: 1.1rem; color: white; outline: none; 
                }
                .search-input::placeholder { color: rgba(255,255,255,0.3); }
                .jurisdiction-select {
                    background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1);
                    color: white; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer;
                    outline: none;
                }

                .library-grid { 
                    display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
                    gap: 1.5rem; 
                }

                .library-card { 
                    padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; 
                    transition: 0.2s; border: 1px solid rgba(255,255,255,0.05);
                }
                .library-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,0.15); }

                .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
                .jurisdiction-tag { 
                    font-size: 0.75rem; text-transform: uppercase; font-weight: 700; 
                    background: rgba(96, 165, 250, 0.1); color: #60a5fa; padding: 0.2rem 0.6rem; border-radius: 4px;
                }
                .card-link { color: var(--muted); text-decoration: none; font-size: 1.2rem; transition: 0.2s; }
                .card-link:hover { color: white; }

                .card-title { font-size: 1.1rem; line-height: 1.4; margin: 0; color: #f8fafc; font-weight: 600; }
                .card-summary { font-size: 0.9rem; color: #cbd5e1; line-height: 1.6; flex-grow: 1; }

                .card-footer { margin-top: auto; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); }
                .btn-copy {
                    background: transparent; border: 1px solid rgba(255,255,255,0.1); color: var(--muted);
                    font-size: 0.8rem; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; transition: 0.2s;
                }
                .btn-copy:hover { background: rgba(255,255,255,0.05); color: white; }
                
                .loading-state, .empty-state { grid-column: 1 / -1; text-align: center; padding: 4rem; color: var(--muted); }
                .empty-state h3 { color: white; margin-top: 1rem; margin-bottom: 0.5rem; }

                @media (max-width: 768px) {
                    .library-container { padding: 0 1.5rem 3rem; }
                    .search-bar-container { flex-direction: column; }
                }
            `}</style>
        </div>
    );
}
