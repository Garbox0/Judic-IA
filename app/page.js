"use client";
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from "./page.module.css";
import Link from "next/link";
import Image from "next/image";
import SafeChatWidget from "./components/SafeChatWidget";
import { Clock, Shield, Zap, Scale, BookOpen, Users, FolderOpen, Calculator, Calendar, FileText, BarChart2, PlayCircle, Lock, Sun, Moon, CheckCircle } from 'lucide-react';
import "./landing.css"; // Version 3.0 Styles

export default function Home() {
  const router = useRouter();
  const [authError, setAuthError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState('dark');

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'dark';
    setTheme(savedTheme);
  }, []);

  // Update body class when theme changes
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const services = [
    { title: "IA Jurídica Avanzada", desc: "Consultas analizadas con modelos entrenados en normativa legal actualizada.", icon: <Scale size={42} /> },
    { title: "Digesto Jurídico", desc: "Acceso instantáneo y offline a toda la normativa nacional y provincial.", icon: <BookOpen size={42} /> },
    { title: "Gestión de Clientes", desc: "Base de datos completa con historial de interacciones y vinculación de causas.", icon: <Users size={42} /> },
    { title: "Gestión de Expedientes", desc: "Organiza casos, plazos y documentos en un entorno centralizado y seguro.", icon: <FolderOpen size={42} /> },
    { title: "Calculadoras Legales", desc: "Cálculo automático de intereses, indemnizaciones y actualizaciones monetarias.", icon: <Calculator size={42} /> },
    { title: "Agenda Inteligente", desc: "Programación de citas y recordatorios automáticos vía WhatsApp y email.", icon: <Calendar size={42} /> },
    { title: "Biblioteca de Modelos", desc: "Repositorio de escritos, contratos y documentos jurídicos listos para usar.", icon: <FileText size={42} /> },
    { title: "Panel de Análisis", desc: "Métricas de rendimiento de tu estudio y comportamiento de tus clientes.", icon: <BarChart2 size={42} /> }
  ];

  // 🛡️ REVEAL ANIMATION (Intersection Observer)
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Detect if the user lands here due to an expired email link
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && (hash.includes('otp_expired') || hash.includes('access_denied'))) {
        setAuthError(true);
      }
    }
  }, []);

  return (
    <main className="landing-v3">
      <div className="bg-mesh"></div>

      {/* 💎 NAVIGATION 3.0 */}
      <nav className="glass-navbar">
        <div className="nav-container">
          <div className="nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Image
              src="/judic-ia-mark.png"
              alt="Judic-IA Logo"
              className="nav-logo"
              width={48}
              height={64}
              priority
            />
            <span className="nav-title text-glow">Judic-IA</span>
          </div>

          <div className="nav-actions-group">
            <div className="landing-nav-links">
              <Link href="/demo" className="link-item">Demo</Link>
              <Link href="#features" className="link-item">Servicios</Link>
              <Link href="#pricing" className="link-item">Precios</Link>
              <Link href="https://consultas.judic-ia.com" className="btn-login-premium">Acceso Clientes</Link>
              <Link href="/login" className="btn-login-premium">Acceso Abogados</Link>
            </div>

            <button
              onClick={toggleTheme}
              className="theme-toggle-landing"
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>
              ☰
            </button>
          </div>
        </div>
      </nav>

      {/* 📱 MOBILE OVERLAY 3.0 */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay">
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(false)} style={{ position: 'absolute', top: '2rem', right: '2rem' }}>
            ✕
          </button>


          <Link href="/demo" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>Demo Interactiva</Link>
          <Link href="#features" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>Servicios</Link>
          <Link href="#pricing" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>Precios</Link>

          <div className="mobile-access-row">
            <Link href="/login" className="btn-login-mobile primary" onClick={() => setMobileMenuOpen(false)}>
              Acceso Abogados
            </Link>
            <Link href="https://consultas.judic-ia.com" className="btn-login-mobile" onClick={() => setMobileMenuOpen(false)}>
              Acceso Clientes
            </Link>
          </div>
        </div>
      )}

      {/* 🚀 HERO SECTION 3.0 */}
      <section className="hero-section">
        <div className="hero-grid">
          <div className="hero-content reveal">
            <div className="badge-new">✨ Judic-IA v3.0 • Elite Intelligence</div>
            <h1 className="hero-title">
              La Evolución <br />
              <span className="gradient-text italic-serif">de tu Estudio.</span>
            </h1>
            <p className="hero-subtitle">
              Automatiza la atención de consultas, investiga jurisprudencia en segundos y gestiona tu consultoría legal con tecnología de élite diseñada para abogados de alto rendimiento.
            </p>
            <div className="hero-actions">
              <Link href="/register" className="btn-primary-v3">
                Comenzar Ahora <span>→</span>
              </Link>
              <Link href="/demo" className="btn-secondary-v3">
                <PlayCircle size={20} /> Ver Demo
              </Link>
            </div>
          </div>

          <div className="hero-mockup-wrapper reveal">
            <div className="hero-card-v3">
              <div className="mock-window">
                <div className="mock-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="mock-avatar"></div>
                    <div style={{ lineHeight: 1 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>Dr. Martínez</div>
                      <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>En línea</div>
                    </div>
                  </div>
                  <div style={{ opacity: 0.3 }}>•••</div>
                </div>
                <div className="mock-content">
                  <div className="mock-bubble">
                    Hola, soy el asistente virtual del estudio. ¿Cómo puedo ayudarte hoy con tu consulta legal?
                  </div>
                  <div className="mock-options">
                    <span className="mock-chip">Accidentes Tránsito</span>
                    <span className="mock-chip">Derecho Laboral</span>
                    <span className="mock-chip">Sucesiones</span>
                  </div>
                  <div className="mock-input">
                    <span>Escribí tu consulta...</span>
                    <div className="mock-send"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 📊 STATS SECTION (Moved for Full Width Centering) */}
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-icon-wrapper"><Clock size={24} /></div>
            <div>
              <span className="stat-value">24/7</span>
              <span className="stat-label">Atención Permanente</span>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon-wrapper"><Zap size={24} /></div>
            <div>
              <span className="stat-value">+10h</span>
              <span className="stat-label">Ahorro Semanal</span>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon-wrapper"><Shield size={24} /></div>
            <div>
              <span className="stat-value">100%</span>
              <span className="stat-label">Seguridad Cifrada</span>
            </div>
          </div>
        </div>
      </section>

      {/* 🛠️ FEATURES SECTION 3.0 */}
      <section id="features" className="section-container">
        <div className="section-header reveal">
          <h2 className="section-title">Tecnología de <span className="gradient-text italic-serif">Nueva Generación</span></h2>
          <p className="section-subtitle">Diseñamos herramientas que no solo ahorran tiempo, sino que elevan el estándar de profesionalismo de tu práctica legal.</p>
        </div>

        <div className="grid4">
          <div className="services-wrapper">
            <div className="grid4">
              {services.map((feat, i) => (
                <div key={i} className="card-v3 reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                  <i>{feat.icon}</i>
                  <h3>{feat.title}</h3>
                  <p>{feat.desc}</p>
                </div>
              ))}
            </div>


          </div>
        </div>
      </section>

      {/* 🏷️ PRICING SECTION 3.0 */}
      <section id="pricing" className="section-container" style={{ background: 'rgba(251, 191, 36, 0.02)' }}>
        <div className="section-header reveal">
          <h2 className="section-title">Planes a <span className="gradient-text italic-serif">tu Medida</span></h2>
          <p className="section-subtitle">Elige el motor que impulsará el crecimiento de tu estudio jurídico.</p>
        </div>

        <div className="grid2">
          {/* PLAN STARTER */}
          <div className="price-card-v3 reveal">
            <h3 style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '1rem', color: '#94a3b8' }}>Starter</h3>
            <div className="price-amount">
              Gratis<small className="price-period" style={{ marginLeft: '10px', fontSize: '1.2rem' }}>/ 14 días</small>
            </div>
            <ul className="price-features">
              <li>Asistente IA básico</li>
              <li>Hasta 5 consultas diarias</li>
              <li>Búsqueda de jurisprudencia (2/día)</li>
              <li>Soporte limitado</li>
            </ul>
            <Link href="/register" className="btn-secondary-v3" style={{ width: '100%', textAlign: 'center', marginTop: '2rem' }}>
              Comenzar Gratis
            </Link>
          </div>

          {/* PLAN PROFESIONAL */}
          <div className="price-card-v3 featured reveal" style={{ transitionDelay: '0.2s' }}>
            <span className="price-badge">MÁS ELEGIDO</span>
            <h3 style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '1rem', color: '#fbbf24' }}>Profesional</h3>
            <div className="price-amount">
              <span className="price-currency">$</span>25.000<small className="price-period" style={{ marginLeft: '10px', fontSize: '1.2rem' }}>/ mes</small>
            </div>
            <ul className="price-features">
              <li className="premium-check">Asistente IA ilimitado</li>
              <li className="premium-check">Gestión completa de clientes</li>
              <li className="premium-check">Alertas de plazos y vencimientos</li>
              <li className="premium-check">Soporte VIP 24/7</li>
            </ul>
            <Link href="/register" className="btn-primary-v3" style={{ width: '100%', justifyContent: 'center', marginTop: '2rem' }}>
              Suscribirse Ahora
            </Link>
          </div>
        </div>
      </section>

      {/* 📞 CTA SECTION 3.0 */}
      <section className="reveal">
        <div className="cta-v3">
          <h2 className="section-title">¿Listo para el <span className="gradient-text italic-serif">Siguiente Nivel?</span></h2>
          <p className="section-subtitle" style={{ marginBottom: '3rem' }}>
            Únete a los profesionales que ya están liderando la transformación digital en el ámbito legal.
          </p>
          <Link href="/register" className="btn-primary-v3">
            Crear mi Estudio Digital
          </Link>
          <div className="cta-pills">
            <span className="cta-pill"><strong>✓</strong> 14 días gratis</span>
            <span className="cta-pill"><strong>✓</strong> Sin tarjeta</span>
            <span className="cta-pill"><strong>✓</strong> Cancela cuando quieras</span>
          </div>
        </div>
      </section>

      {/* 🛡️ AUTH ERROR RECOVERY BANNER (From v2.0) */}
      {authError && (
        <div className="auth-recovery-banner">
          <div className="banner-content">
            <span className="banner-icon">🔐</span>
            <div className="banner-text">
              <strong>El enlace de invitación ha expirado.</strong>
              <p>Si ya creaste tu clave, puedes ingresar directamente a continuación.</p>
            </div>
            <Link href="https://consultas.judic-ia.com/auth/login" className="btn-banner-action">
              Ir al Acceso Clientes
            </Link>
          </div>
        </div>
      )}

      {/* 📱 CHAT WIDGET */}
      <SafeChatWidget mode="sales" startOpen={false} />

      {/* 🏛️ FOOTER 3.0 */}
      <footer className="footer-premium-v3">
        <div className="footer-nav-container">
          <div className="footer-brand-side">
            <Image
              src="/judic-ia-mark.png"
              alt="Judic-IA Logo"
              className="nav-logo"
              width={46}
              height={62}
              priority
            />
            <div className="footer-info">
              <strong>Judic-IA</strong>
              <span>© 2026 — LegalTech Argentina</span>
            </div>
          </div>

          <div className="footer-links">
            <Link href="/legal?tab=seguridad">Seguridad</Link>
            <Link href="/legal?tab=privacidad">Privacidad</Link>
            <Link href="/legal?tab=terminos">Términos</Link>
            <a href="mailto:Billing@judic-ia.com">Ventas</a>
            <a href="mailto:Soporte@judic-ia.com">Soporte</a>
          </div>

          <div className="trust-badges-container">
            <a href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer" className="trust-badge">
              <svg className="badge-icon cf-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.53 13.1c-.26-1.55-1.42-2.73-2.92-3a5.5 5.5 0 00-10.42-2c-1.8.1-3.32 1.4-3.7 3.14a4 4 0 00-2.43 7.33A4 4 0 008 22h11a5 5 0 004.53-8.9zM19 20H8a2 2 0 01-1-3.74v-.01a2 2 0 011-3.75 3.5 3.5 0 016.71-1.25l.13.43.45-.06a3.5 3.5 0 013.71 3.49v.14a3 3 0 010 5.75z" />
              </svg>
              Protected by <strong>Cloudflare</strong>
            </a>

            <a href="https://safeweb.norton.com/report?url=https://www.judic-ia.com/" target="_blank" rel="noopener noreferrer" className="trust-badge" title="Verificado por Norton Safe Web">
              <CheckCircle className="badge-icon" size={14} style={{ color: '#fbbf24' }} />
              Norton Safe Web <strong>Verified</strong>
            </a>

            <div className="trust-badge">
              <Shield className="badge-icon" size={14} />
              AES-256 <strong>Encrypted</strong>
            </div>

            <div className="trust-badge">
              <Lock className="badge-icon" size={14} />
              ISO 27001 <strong>Ready</strong>
            </div>

            <div className="trust-badge">
              <Scale className="badge-icon" size={14} />
              Ley 25.326 <strong>Compliant</strong>
            </div>
          </div>
        </div>

        {/* FISCAL INFO ROW */}
        <div className="footer-fiscal-row">
          <span>Gabriel Yago Escalada</span>
          <span className="fiscal-separator">•</span>
          <span>CUIT 20-39156370-6</span>
          <span className="fiscal-separator">•</span>
          <span>Monotributista</span>
          <span className="fiscal-separator">•</span>
          <span>República Argentina</span>
        </div>
      </footer>
    </main>
  );
}
