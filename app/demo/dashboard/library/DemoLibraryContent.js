"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Scale, Library, ExternalLink, Copy, FileText, Check } from 'lucide-react';
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
    const [toast, setToast] = useState(null);

    useEffect(() => {
        const unique = [...new Set(demoLibrary.map(item => item.jurisdiction))].filter(Boolean);
        setJurisdictions(unique);
        fetchLibrary();
    }, []);

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

    const fetchLibrary = () => {
        setLoading(true);
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
        setTimeout(() => {
            setCases(filtered);
            setLoading(false);
        }, 300);
    };

    const handleCopy = (item) => {
        navigator.clipboard.writeText(`${item.autos} - ${item.url}`);
        setToast('Cita copiada al portapapeles');
    };

    return (
        <div className="library-container">
            <nav className="library-nav">
                <div className="breadcrumb">
                    <Link href="/demo/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Jurisprudencias (Demo)</span>
                </div>
            </nav>

            <header className="library-header">
                <div className="header-content">
                    <h1><Scale size={48} className="header-icon-pink" /> Jurisprudencias y Doctrinas</h1>
                    <p>Índice colaborativo de fallos, precedentes y doctrina jurídica.</p>
                </div>
                <UsageGuideDemo content={demoManuals.library} />

                <div className="search-bar-container glass-panel">
                    <input
                        id="demo-library-search"
                        name="library_search"
                        aria-label="Buscar en biblioteca"
                        autoComplete="off"
                        type="text"
                        placeholder="Buscar por autos, tema o fallo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    <select
                        id="jurisdiction-select"
                        name="jurisdiction"
                        aria-label="Filtrar por jurisdiccion"
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
                    <div className="loading-state">Cargando biblioteca (Demo)...</div>
                ) : cases.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-state-icon-wrapper"><Library size={64} className="opacity-50" /></span>
                        <h3>No hay resultados</h3>
                        <p>Prueba con otros terminos de busqueda.</p>
                    </div>
                ) : (
                    cases.map(item => (
                        <div key={item.id || item.url} className="library-card glass-panel">
                            <div className="card-header">
                                <span className="jurisdiction-tag">{item.jurisdiction || 'General'}</span>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {(item.pdf_url || item.url) && (
                                        <a
                                            href={item.pdf_url || item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="card-link"
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
                <div className="library-toast">
                    <Check size={16} />
                    {toast}
                </div>
            )}
        </div>
    );
}
