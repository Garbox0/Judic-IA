"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, MapPin, Award, MessageCircle, ArrowLeft, Loader, Moon, Sun } from 'lucide-react';
import '../abogados.css';
import './profile.css';

export default function LawyerProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [lawyer, setLawyer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('judicia-marketplace-theme');
        if (saved === 'dark') setDarkMode(true);
    }, []);

    const toggleTheme = () => {
        setDarkMode(prev => {
            const next = !prev;
            localStorage.setItem('judicia-marketplace-theme', next ? 'dark' : 'light');
            return next;
        });
    };

    useEffect(() => {
        if (!id) return;

        async function fetchProfile() {
            try {
                const res = await fetch(`/api/abogados/${id}`);
                if (!res.ok) {
                    setError("Perfil no encontrado o no disponible");
                    setLoading(false);
                    return;
                }
                const data = await res.json();
                setLawyer(data);
            } catch (err) {
                setError("Error de conexión");
            } finally {
                setLoading(false);
            }
        }

        fetchProfile();
    }, [id]);

    const handleContact = () => {
        router.push(`/consultas/auth?lawyerId=${id}&source=marketplace`);
    };

    const themeClass = darkMode ? 'abogados-dark' : 'abogados-light';

    if (loading) {
        return (
            <main className={`abogados-main ${themeClass}`}>
                <div className="profile-loading">
                    <Loader size={32} className="animate-spin" />
                    <p>Cargando perfil...</p>
                </div>
            </main>
        );
    }

    if (error || !lawyer) {
        return (
            <main className={`abogados-main ${themeClass}`}>
                <div className="profile-error">
                    <h2>Perfil no disponible</h2>
                    <p>{error || "Este abogado no tiene un perfil público activo."}</p>
                    <Link href="/abogados" className="back-link">
                        <ArrowLeft size={16} /> Volver a la búsqueda
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className={`abogados-main ${themeClass}`}>
            {/* NAV */}
            <nav className="abogados-nav">
                <Link href="/" className="nav-brand-link">
                    <img src="/judic-ia-mark.png" alt="Judic-IA" className="nav-logo-sm" />
                    <span className="nav-brand-text">Judic-IA</span>
                </Link>
                <div className="nav-actions">
                    <button
                        type="button"
                        className="theme-toggle-btn"
                        onClick={toggleTheme}
                        aria-label={darkMode ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                    >
                        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <Link href="/abogados" className="nav-link-subtle">
                        <ArrowLeft size={14} /> Volver
                    </Link>
                </div>
            </nav>

            {/* PROFILE */}
            <div className="profile-container">
                <div className="profile-card">
                    {/* Avatar + Basic Info */}
                    <div className="profile-header">
                        <div className="profile-avatar-lg">
                            {lawyer.avatar_url ? (
                                <img src={lawyer.avatar_url} alt={lawyer.full_name} />
                            ) : (
                                <span className="avatar-initial-lg">{lawyer.full_name?.charAt(0) || '?'}</span>
                            )}
                        </div>

                        <div className="profile-info">
                            <h1 className="profile-name">{lawyer.full_name}</h1>

                            {lawyer.matricula && (
                                <p className="profile-matricula">
                                    <Award size={14} aria-hidden="true" /> {lawyer.matricula}
                                </p>
                            )}

                            {lawyer.jurisdiccion && (
                                <p className="profile-zona">
                                    <MapPin size={14} aria-hidden="true" /> {lawyer.jurisdiccion}
                                </p>
                            )}

                            {lawyer.avg_rating > 0 && (
                                <div className="profile-rating">
                                    <Star size={16} fill="#fbbf24" stroke="#fbbf24" aria-hidden="true" />
                                    <span className="rating-value">{lawyer.avg_rating}</span>
                                    <span className="rating-count">({lawyer.review_count} {lawyer.review_count === 1 ? 'reseña' : 'reseñas'})</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Specialties */}
                    {lawyer.especialidades?.length > 0 && (
                        <div className="profile-section">
                            <h3>Especialidades</h3>
                            <div className="profile-specs">
                                {lawyer.especialidades.map(s => (
                                    <span key={s} className="spec-badge-lg">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Bio */}
                    {lawyer.biography && (
                        <div className="profile-section">
                            <h3>Acerca del profesional</h3>
                            <p className="profile-bio">{lawyer.biography}</p>
                        </div>
                    )}

                    {/* CTA */}
                    <div className="profile-cta">
                        <button onClick={handleContact} className="btn-contact-lawyer">
                            <MessageCircle size={18} /> Contactar
                        </button>
                    </div>

                    {/* Reviews */}
                    {lawyer.reviews?.length > 0 && (
                        <div className="profile-section">
                            <h3>Reseñas recientes</h3>
                            <div className="reviews-list">
                                {lawyer.reviews.map(review => (
                                    <div key={review.id} className="review-card">
                                        <div className="review-stars">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <Star
                                                    key={i}
                                                    size={14}
                                                    fill={i <= review.rating ? '#fbbf24' : 'transparent'}
                                                    stroke={i <= review.rating ? '#fbbf24' : '#475569'}
                                                    aria-hidden="true"
                                                />
                                            ))}
                                        </div>
                                        {review.comment && (
                                            <p className="review-comment">{review.comment}</p>
                                        )}
                                        <span className="review-date">
                                            {new Date(review.created_at).toLocaleDateString('es-AR')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
