"use client";
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from "./page.module.css";
import Link from "next/link";
import Image from "next/image";
import { Clock, Shield, Zap, Scale, BookOpen, Users, FolderOpen, Calculator, Calendar, FileText, BarChart2, PlayCircle, Lock, Sun, Moon, CheckCircle, ShieldCheck } from 'lucide-react';
import SecurityBadges from './components/SecurityBadges';
import "./landing.css"; // Version 3.0 Styles

export default function Home() {
  const router = useRouter();
  const [authError, setAuthError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
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
          <button className="mobile-menu-btn mobile-menu-close" onClick={() => setMobileMenuOpen(false)}>
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
              <Link
                href="/register"
                className="btn-primary-v3"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.gtag) {
                    window.gtag('event', 'click_comenzar_ahora_hero', {
                      'event_category': 'conversion',
                      'event_label': 'Hero CTA'
                    });
                  }
                }}
              >
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
                  <div className="mock-header-flex">
                    <div className="mock-avatar"></div>
                    <div className="mock-user-info">
                      <div className="mock-user-name">Dr. Martínez</div>
                      <div className="mock-user-status">En línea</div>
                    </div>
                  </div>
                  <div className="mock-dots-opacity">•••</div>
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
                <div key={i} className="card-v3 reveal">
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
      <section id="pricing" className="section-container pricing-section-bg">
        <div className="section-header reveal">
          <h2 className="section-title">Planes a <span className="gradient-text italic-serif">tu Medida</span></h2>
          <p className="section-subtitle">Elige el motor que impulsará el crecimiento de tu estudio jurídico.</p>
        </div>

        <div className="grid2">
          {/* PLAN STARTER */}
          <div className="price-card-v3 reveal">
            <h3 className="price-card-tag">Starter</h3>
            <div className="price-amount">
              Gratis<small className="price-period price-period-item">/ 14 días</small>
            </div>
            <ul className="price-features">
              <li>Asistente IA básico</li>
              <li>Hasta 5 consultas diarias</li>
              <li>Búsqueda de jurisprudencia (2/día)</li>
              <li>Soporte limitado</li>
            </ul>
            <Link href="/register" className="btn-secondary-v3 price-btn-wrap">
              Comenzar Gratis
            </Link>
          </div>

          {/* PLAN PROFESIONAL */}
          <div className="price-card-v3 featured reveal delay-2">
            <span className="price-badge">MÁS ELEGIDO</span>
            <h3 className="price-card-tag-featured">Profesional</h3>
            <div className="price-amount">
              <span className="price-currency">$</span>25.000<small className="price-period price-period-item">/ mes</small>
            </div>
            <ul className="price-features">
              <li className="premium-check">Asistente IA ilimitado</li>
              <li className="premium-check">Gestión completa de clientes</li>
              <li className="premium-check">Alertas de plazos y vencimientos</li>
              <li className="premium-check">Soporte VIP 24/7</li>
            </ul>
            <Link href="/register" className="btn-primary-v3 price-btn-featured">
              Suscribirse Ahora
            </Link>
          </div>
        </div>
      </section>

      {/* 📞 CTA SECTION 3.0 */}
      <section className="reveal">
        <div className="cta-v3">
          <h2 className="section-title">¿Listo para el <span className="gradient-text italic-serif">Siguiente Nivel?</span></h2>
          <p className="section-subtitle cta-subtitle-gap">
            Únete a los profesionales que ya están liderando la transformación digital en el ámbito legal.
          </p>
          <Link
            href="/register"
            className="btn-primary-v3"
            onClick={() => {
              if (typeof window !== 'undefined' && window.gtag) {
                window.gtag('event', 'click_crear_estudio_cta', {
                  'event_category': 'conversion',
                  'event_label': 'Bottom CTA'
                });
              }
            }}
          >
            Crear mi Estudio Digital
          </Link>
          <div className="cta-pills">
            <span className="cta-pill"><strong>✓</strong> 14 días gratis</span>
            <span className="cta-pill"><strong>✓</strong> Sin tarjeta</span>
            <span className="cta-pill"><strong>✓</strong> Cancela cuando quieras</span>
          </div>
        </div>
      </section>

      {/* 📧 NEWSLETTER SECTION 3.0 */}
      <section className="newsletter-section-v3 reveal">
        <div className="newsletter-container-v3">
          <div className="newsletter-content-v3">
            <h2 className="newsletter-title-v3">Novedades <span className="gradient-text italic-serif">de Judic-IA</span></h2>
            <p className="newsletter-desc-v3">Entérate de nuevas funcionalidades y tendencias en IA jurídica antes que nadie.</p>
            <form
              className="newsletter-form-v3"
              id="newsletter-signup-form"
              aria-label="Inscripción a la newsletter"
              onSubmit={async (e) => {
                e.preventDefault();
                const email = e.target.email.value;
                const btn = e.target.querySelector('button');
                btn.disabled = true;
                btn.innerText = 'Inscribiendo...';

                try {
                  const res = await fetch('/api/newsletter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                  });
                  const data = await res.json();

                  if (res.ok) {
                    if (data.already_active) {
                      btn.innerText = '✓ Ya activo';
                      btn.classList.add('already-active-btn');
                    } else {
                      btn.innerText = '✓ ¡Inscrito!';
                      btn.classList.add('success-btn');
                    }
                    e.target.reset();

                    // Temporizador de 5 segundos para volver a la normalidad
                    setTimeout(() => {
                      btn.disabled = false;
                      btn.innerHTML = 'Inscribirse <span>→</span>';
                      btn.classList.remove('success-btn', 'already-active-btn');
                      btn.style.background = '';
                      btn.style.color = '';
                    }, 5000);

                    if (typeof window !== 'undefined' && window.gtag) {
                      window.gtag('event', 'newsletter_signup', {
                        'event_category': 'conversion',
                        'event_label': data.already_active ? 'Newsletter Already Active' : 'Newsletter Footer'
                      });
                    }
                  } else {
                    btn.innerText = 'Reintentar';
                    btn.disabled = false;
                  }
                } catch (err) {
                  btn.innerText = 'Reintentar';
                  btn.disabled = false;
                }
              }}
            >
              <div className="newsletter-input-group">
                <label htmlFor="newsletter-email" className="sr-only">Tu email profesional</label>
                <input
                  type="email"
                  id="newsletter-email"
                  name="email"
                  placeholder="Tu email profesional..."
                  required
                  className="newsletter-input-v3"
                  aria-label="Introduce tu correo electrónico"
                  autoComplete="email"
                />
                <button type="submit" className="btn-newsletter-v3" aria-label="Suscribirse a la newsletter">
                  Inscribirse <span>→</span>
                </button>
              </div>
            </form>
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



      {/* 🏛️ FOOTER 3.0 PREMIUM */}
      <footer className="footer-premium-v3">
        <div className="footer-main-grid">
          {/* 1. BRAND ZONE */}
          <div className="footer-brand-zone">
            <Link href="/" className="footer-brand-logo">
              <Image src="/judic-ia-mark.png" alt="Judic-IA" width={40} height={52} className="footer-logo-img" />
              <span className="footer-brand-name">Judic-IA</span>
            </Link>
            <p className="footer-brand-tagline">
              Inteligencia Legal Avanzada <br />
              <span>© 2026 — Judic-IA Argentina</span>
            </p>
          </div>

          {/* 2. NAVIGATION GROUPS */}
          <div className="footer-nav-groups">
            <div className="nav-group">
              <h4>Plataforma</h4>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/pricing">Precios</Link>
              <Link href="/#servicios">Servicios</Link>
              <Link href="/demo">Demo</Link>
            </div>

            <div className="nav-group">
              <h4>Soporte</h4>
              <a href="mailto:Soporte@judic-ia.com">Ayuda Técnica</a>
              <a href="mailto:Billing@judic-ia.com">Ventas y Facturación</a>
              <Link href="/legal?tab=seguridad">Centro de Seguridad</Link>
            </div>

            <div className="nav-group">
              <h4>Legal</h4>
              <Link href="/legal?tab=terminos">Términos de Uso</Link>
              <Link href="/legal?tab=privacidad">Privacidad</Link>
              <Link href="/legal">Aviso Legal</Link>
              <Link href="/legal?tab=cookies">Cookies</Link>
            </div>
          </div>

          {/* 3. SECURITY & TRUST ZONE */}
          <div className="footer-security-zone">
            <SecurityBadges className="footer-badges-override" />
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
