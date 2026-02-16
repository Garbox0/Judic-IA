"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Star, MapPin, Award, MessageCircle, ArrowLeft, Loader, Moon, Sun, Send, CheckCircle, X, AlertCircle } from 'lucide-react';
import '../abogados.css';
import './profile.css';

export default function LawyerProfilePage() {
    const params = useParams();
    const { id } = params;

    const [lawyer, setLawyer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [darkMode, setDarkMode] = useState(false);

    // Contact form state
    const [showContactForm, setShowContactForm] = useState(false);
    const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [contactError, setContactError] = useState('');

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
        setShowContactForm(true);
        setContactError('');
    };

    const handleSendContact = async (e) => {
        e.preventDefault();
        setContactError('');
        setSending(true);

        try {
            const res = await fetch('/api/abogados/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lawyerId: id,
                    name: contactForm.name,
                    email: contactForm.email,
                    message: contactForm.message
                })
            });

            const data = await res.json();

            if (!res.ok) {
                setContactError(data.error || 'Error al enviar');
                setSending(false);
                return;
            }

            setSent(true);
        } catch (err) {
            setContactError('Error de conexión. Intentá de nuevo.');
        } finally {
            setSending(false);
        }
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

                    {/* CTA / Contact Form */}
                    <div className="profile-cta">
                        {sent ? (
                            <div className="contact-success">
                                <CheckCircle size={32} />
                                <h3>Mensaje enviado</h3>
                                <p>Tu consulta fue enviada a {lawyer.full_name}. Recibirás la respuesta en tu email.</p>
                            </div>
                        ) : showContactForm ? (
                            <form onSubmit={handleSendContact} className="contact-form">
                                <div className="contact-form-header">
                                    <h3>Contactar a {lawyer.full_name}</h3>
                                    <button type="button" className="contact-form-close" onClick={() => setShowContactForm(false)} aria-label="Cerrar formulario">
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="contact-field">
                                    <label htmlFor="contact-name">Nombre completo</label>
                                    <input
                                        id="contact-name"
                                        type="text"
                                        required
                                        maxLength={100}
                                        value={contactForm.name}
                                        onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Tu nombre y apellido"
                                    />
                                </div>

                                <div className="contact-field">
                                    <label htmlFor="contact-email">Email</label>
                                    <input
                                        id="contact-email"
                                        type="email"
                                        required
                                        maxLength={200}
                                        value={contactForm.email}
                                        onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="tu@email.com"
                                    />
                                </div>

                                <div className="contact-field">
                                    <label htmlFor="contact-message">Mensaje</label>
                                    <textarea
                                        id="contact-message"
                                        required
                                        maxLength={2000}
                                        rows={4}
                                        value={contactForm.message}
                                        onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                                        placeholder="Describí brevemente tu consulta..."
                                    />
                                </div>

                                {contactError && (
                                    <div className="contact-error">
                                        <AlertCircle size={14} /> {contactError}
                                    </div>
                                )}

                                <button type="submit" className="btn-contact-lawyer" disabled={sending}>
                                    {sending ? (
                                        <><Loader size={16} className="animate-spin" /> Enviando...</>
                                    ) : (
                                        <><Send size={16} /> Enviar consulta</>
                                    )}
                                </button>
                            </form>
                        ) : (
                            <button onClick={handleContact} className="btn-contact-lawyer">
                                <MessageCircle size={18} /> Contactar
                            </button>
                        )}
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
