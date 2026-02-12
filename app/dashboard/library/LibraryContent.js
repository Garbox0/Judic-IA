"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { Brain, Library, ExternalLink, Copy, Search, Filter } from 'lucide-react';
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
                <UsageGuide content={dashboardManuals.library} />

                <div className="search-bar-container glass-panel">
                    <input
                        id="library-search"
                        name="library-search"
                        aria-label="Buscar en biblioteca"
                        autoComplete="off"
                        type="text"
                        placeholder="Buscar por autos, tema o fallo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
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
                                <Link
                                    href={`/dashboard/legislation/viewer/knowledge-base?url=${encodeURIComponent(item.pdf_url || item.url)}&title=${encodeURIComponent(item.autos || 'Fallo de Base de Conocimiento')}`}
                                    className="card-link"
                                >
                                    <ExternalLink size={18} />
                                </Link>
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


        </div>
    );
}
