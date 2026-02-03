"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Brain, Library, ExternalLink, Copy, Search } from 'lucide-react';
import { demoLibrary } from '@/app/lib/demoData';
import '@/app/dashboard/library/library.css';
import UsageGuideDemo from '@/app/components/UsageGuideDemo';
import { demoManuals } from '@/app/lib/demoManuals';

export default function DemoLibraryPage() {
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [jurisdictionFilter, setJurisdictionFilter] = useState('');
    const [cases, setCases] = useState([]);
    const [jurisdictions, setJurisdictions] = useState([]);

    useEffect(() => {
        // Load demo data
        const unique = [...new Set(demoLibrary.map(item => item.jurisdiction))].filter(Boolean);
        setJurisdictions(unique);
        fetchLibrary();
    }, []);

    useEffect(() => {
        // Debounce search
        const delayDebounceFn = setTimeout(() => {
            fetchLibrary();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, jurisdictionFilter]);

    const fetchLibrary = () => {
        setLoading(true);
        // Simulate local filtering
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

        // Simulate delay
        setTimeout(() => {
            setCases(filtered);
            setLoading(false);
        }, 300);
    };

    return (
        <div className="library-container">
            <nav className="library-nav">
                <div className="breadcrumb">
                    <Link href="/demo/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Biblioteca del Estudio (Demo)</span>
                </div>
            </nav>

            <header className="library-header">
                <div className="header-content">
                    <h1><Brain size={48} className="header-icon-pink" /> Base de Conocimiento</h1>
                    <p>Índice colaborativo de jurisprudencia y precedentes investigados.</p>
                </div>
                <UsageGuideDemo content={demoManuals.library} />

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
                    <div className="loading-state">Cargando biblioteca (Demo)...</div>
                ) : cases.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-state-icon-wrapper"><Library size={64} className="opacity-50" /></span>
                        <h3>No hay resultados</h3>
                        <p>Prueba con otros términos de búsqueda.</p>
                    </div>
                ) : (
                    cases.map(item => (
                        <div key={item.id || item.url} className="library-card glass-panel">
                            <div className="card-header">
                                <span className="jurisdiction-tag">{item.jurisdiction || 'General'}</span>
                                {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="card-link"><ExternalLink size={18} /></a>}
                            </div>
                            <h3 className="card-title">{item.autos}</h3>
                            <p className="card-summary">{item.summary}</p>
                            <div className="card-footer">
                                <button
                                    className="btn-copy flex-center-gap-6"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${item.autos} - ${item.url}`);
                                        alert("Cita copiada (Simulación)");
                                    }}
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
