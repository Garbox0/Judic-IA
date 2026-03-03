"use client";
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, Scale, Search, Bell, Lightbulb, Building2, User, ChevronRight, Shield } from 'lucide-react';

const FEATURES = [
    { icon: <Search size={22} />, text: 'Búsqueda de expedientes en PJN, SCBA y fueros federales' },
    { icon: <Bell size={22} />, text: 'Alertas automáticas ante movimientos en causas' },
    { icon: <Lightbulb size={22} />, text: 'Estrategia judicial con IA avanzada' },
    { icon: <Scale size={22} />, text: 'Hub Federal unificado para todos los fueros' },
    { icon: <Building2 size={22} />, text: 'Panel de Estudio para gestión de equipos' },
    { icon: <Shield size={22} />, text: 'Seguridad de nivel bancario. Datos en Argentina.' },
];

export default function RefVendorClient({ vendorName, code }) {
    // Captura el código en localStorage para que el registro lo use
    useEffect(() => {
        if (code) {
            localStorage.setItem('referral_code', code);
        }
    }, [code]);

    const firstName = vendorName.split(' ')[0];

    return (
        <main style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)',
            fontFamily: 'var(--font-outfit, system-ui, sans-serif)',
            color: '#f8fafc',
        }}>
            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <header style={{
                padding: '1.25rem 2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(12px)',
                position: 'sticky',
                top: 0,
                zIndex: 50,
                background: 'rgba(2,6,23,0.7)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Image src="/judic-ia-mark.png" alt="Judic-IA" width={32} height={44} priority />
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fbbf24', letterSpacing: '-0.02em' }}>
                        Judic-IA
                    </span>
                </div>
                <Link href="/demo/dashboard" style={{
                    fontSize: '0.85rem',
                    color: '#94a3b8',
                    textDecoration: 'none',
                    padding: '0.4rem 1rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '99px',
                    transition: 'all 0.2s',
                }}>
                    Ver demo →
                </Link>
            </header>

            {/* ── HERO ───────────────────────────────────────────────────── */}
            <section style={{
                maxWidth: '720px',
                margin: '0 auto',
                padding: '5rem 2rem 3rem',
                textAlign: 'center',
            }}>
                {/* Badge del vendedor */}
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(251,191,36,0.1)',
                    border: '1px solid rgba(251,191,36,0.25)',
                    borderRadius: '99px',
                    padding: '0.4rem 1.1rem',
                    fontSize: '0.85rem',
                    color: '#fbbf24',
                    marginBottom: '2rem',
                    fontWeight: 500,
                }}>
                    <CheckCircle size={15} />
                    Invitación de {vendorName}
                </div>

                <h1 style={{
                    fontSize: 'clamp(2rem, 5vw, 3.2rem)',
                    fontWeight: 800,
                    lineHeight: 1.1,
                    letterSpacing: '-0.03em',
                    marginBottom: '1.25rem',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                }}>
                    La plataforma que transforma tu estudio jurídico
                </h1>

                <p style={{
                    fontSize: '1.15rem',
                    color: '#94a3b8',
                    lineHeight: 1.7,
                    marginBottom: '0.75rem',
                }}>
                    {firstName} te recomienda Judic-IA, el asistente legal con inteligencia artificial
                    diseñado para abogados argentinos.
                </p>
                <p style={{ fontSize: '0.95rem', color: '#64748b', marginBottom: '3rem' }}>
                    Investigá expedientes, automatizá alertas y gestioná tu estudio desde un solo lugar.
                </p>

                {/* CTAs */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link
                        href={`/register?ref=${code}`}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                            color: '#020617',
                            fontWeight: 700,
                            fontSize: '1rem',
                            padding: '0.9rem 2rem',
                            borderRadius: '12px',
                            textDecoration: 'none',
                            boxShadow: '0 4px 24px rgba(251,191,36,0.3)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                    >
                        <User size={18} /> Soy Abogado Independiente <ChevronRight size={16} />
                    </Link>
                    <Link
                        href={`/registro-estudio?ref=${code}`}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'rgba(255,255,255,0.05)',
                            color: '#f8fafc',
                            fontWeight: 600,
                            fontSize: '1rem',
                            padding: '0.9rem 2rem',
                            borderRadius: '12px',
                            textDecoration: 'none',
                            border: '1px solid rgba(255,255,255,0.12)',
                            backdropFilter: 'blur(8px)',
                            transition: 'background 0.2s',
                        }}
                    >
                        <Building2 size={18} /> Tengo un Estudio Jurídico <ChevronRight size={16} />
                    </Link>
                </div>
            </section>

            {/* ── FEATURES ───────────────────────────────────────────────── */}
            <section style={{
                maxWidth: '760px',
                margin: '0 auto',
                padding: '2rem 2rem 4rem',
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1rem',
                }}>
                    {FEATURES.map((f, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.9rem',
                            padding: '1.1rem 1.25rem',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '12px',
                            backdropFilter: 'blur(8px)',
                        }}>
                            <span style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }}>{f.icon}</span>
                            <span style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: 1.5 }}>{f.text}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── DEMO BANNER ────────────────────────────────────────────── */}
            <section style={{
                maxWidth: '760px',
                margin: '0 auto 4rem',
                padding: '0 2rem',
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(139,92,246,0.08))',
                    border: '1px solid rgba(251,191,36,0.15)',
                    borderRadius: '16px',
                    padding: '2rem',
                    textAlign: 'center',
                }}>
                    <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.95rem' }}>
                        ¿Querés ver la plataforma antes de registrarte?
                    </p>
                    <Link
                        href="/demo/dashboard"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: '#fbbf24',
                            fontWeight: 600,
                            textDecoration: 'none',
                            fontSize: '1rem',
                        }}
                    >
                        Explorar la demo interactiva →
                    </Link>
                </div>
            </section>

            {/* ── FOOTER ─────────────────────────────────────────────────── */}
            <footer style={{
                textAlign: 'center',
                padding: '2rem',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                color: '#475569',
                fontSize: '0.8rem',
            }}>
                © {new Date().getFullYear()} Judic-IA · Todos los derechos reservados ·{' '}
                <Link href="/" style={{ color: '#64748b', textDecoration: 'none' }}>Inicio</Link>
                {' · '}
                <span style={{ opacity: 0.5 }}>Ref: {code}</span>
            </footer>
        </main>
    );
}
