"use client";
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Star, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import './abogados.css';

const SPECIALTIES = [
    'Derecho Administrativo', 'Derecho Ambiental', 'Derecho Bancario',
    'Derecho Civil', 'Derecho Comercial', 'Daños y Perjuicios',
    'Derecho Empresario', 'Familia', 'Derecho Fiscal',
    'Derecho Informático', 'Derecho Internacional', 'Derecho Laboral',
    'Marcas y Patentes', 'Mediación y Arbitraje', 'Derecho Penal', 'Derecho Real'
];

export default function AbogadosPage() {
    const [lawyers, setLawyers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [especialidad, setEspecialidad] = useState('');
    const [zona, setZona] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchLawyers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (especialidad) params.set('especialidad', especialidad);
            if (zona) params.set('zona', zona);
            params.set('page', page.toString());

            const res = await fetch(`/api/abogados?${params.toString()}`);
            const data = await res.json();

            if (res.ok) {
                setLawyers(data.lawyers);
                setTotalPages(data.totalPages);
                setTotal(data.total);
            }
        } catch (err) {
            console.error("Error fetching lawyers:", err);
        } finally {
            setLoading(false);
        }
    }, [especialidad, zona, page]);

    useEffect(() => {
        fetchLawyers();
    }, [fetchLawyers]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchLawyers();
    };

    return (
        <main className="abogados-main">
            {/* HEADER */}
            <nav className="abogados-nav">
                <Link href="/" className="nav-brand-link">
                    <img src="/judic-ia-mark.png" alt="Judic-IA" className="nav-logo-sm" />
                    <span className="nav-brand-text">Judic-IA</span>
                </Link>
                <div className="nav-actions">
                    <Link href="/auth/login" className="nav-link-subtle">Soy Abogado</Link>
                </div>
            </nav>

            <header className="abogados-hero">
                <h1>Encuentra tu abogado</h1>
                <p>Busca profesionales verificados por especialidad y zona</p>
            </header>

            {/* FILTERS */}
            <section className="abogados-filters">
                <form onSubmit={handleSearch} className="filters-form">
                    <div className="filter-group">
                        <Filter size={16} />
                        <select
                            value={especialidad}
                            onChange={(e) => { setEspecialidad(e.target.value); setPage(1); }}
                            className="filter-select"
                        >
                            <option value="">Todas las especialidades</option>
                            {SPECIALTIES.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <MapPin size={16} />
                        <input
                            type="text"
                            placeholder="Zona o jurisdicción..."
                            value={zona}
                            onChange={(e) => setZona(e.target.value)}
                            className="filter-input"
                        />
                    </div>

                    <button type="submit" className="filter-btn">
                        <Search size={16} /> Buscar
                    </button>
                </form>

                {!loading && (
                    <p className="results-count">{total} abogado{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
                )}
            </section>

            {/* GRID */}
            <section className="abogados-grid">
                {loading ? (
                    <div className="loading-grid">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="lawyer-card-skeleton" />
                        ))}
                    </div>
                ) : lawyers.length === 0 ? (
                    <div className="empty-state-public">
                        <Search size={48} opacity={0.3} />
                        <h3>No se encontraron abogados</h3>
                        <p>Intenta con otros filtros o una zona diferente</p>
                    </div>
                ) : (
                    <div className="lawyers-grid">
                        {lawyers.map(lawyer => (
                            <Link key={lawyer.id} href={`/abogados/${lawyer.id}`} className="lawyer-card">
                                <div className="lawyer-card-avatar">
                                    {lawyer.avatar_url ? (
                                        <img src={lawyer.avatar_url} alt={lawyer.full_name} />
                                    ) : (
                                        <span className="avatar-initial">{lawyer.full_name?.charAt(0) || '?'}</span>
                                    )}
                                </div>
                                <div className="lawyer-card-body">
                                    <h3 className="lawyer-card-name">{lawyer.full_name}</h3>
                                    {lawyer.matricula && (
                                        <p className="lawyer-card-matricula">{lawyer.matricula}</p>
                                    )}
                                    {lawyer.jurisdiccion && (
                                        <p className="lawyer-card-zona">
                                            <MapPin size={12} /> {lawyer.jurisdiccion}
                                        </p>
                                    )}
                                    <div className="lawyer-card-specs">
                                        {(lawyer.especialidades || []).slice(0, 3).map(s => (
                                            <span key={s} className="spec-badge">{s}</span>
                                        ))}
                                    </div>
                                    {lawyer.avg_rating > 0 && (
                                        <div className="lawyer-card-rating">
                                            <Star size={14} fill="#fbbf24" stroke="#fbbf24" />
                                            <span>{lawyer.avg_rating}</span>
                                            <span className="rating-count">({lawyer.review_count})</span>
                                        </div>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* PAGINATION */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="page-btn"
                    >
                        <ChevronLeft size={16} /> Anterior
                    </button>
                    <span className="page-info">Página {page} de {totalPages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="page-btn"
                    >
                        Siguiente <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </main>
    );
}
