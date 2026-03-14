"use client";
import { useEffect, useState } from 'react';
import Link from "next/link";
import Image from "next/image";
import { Shield, Zap, Scale, BookOpen, Users, FolderOpen, FileText, PlayCircle, Sun, Moon, CheckCircle, Building2, X as XIcon, LogIn, Search, Bell, Lightbulb, FileDown, ChevronRight } from 'lucide-react';
import SecurityBadges from './components/SecurityBadges';
import "./landing.css"; // Version 3.0 Styles
import VideoGuides from './components/VideoGuides';

export default function Home() {
  const [authError, setAuthError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [pricingTab, setPricingTab] = useState('individual');

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
    { title: "Investigación Judicial", desc: "Buscá expedientes en PJN, SCBA y fueros federales con búsqueda inteligente por número, carátula o parte.", icon: <Search size={42} /> },
    { title: "Alertas Automáticas", desc: "Seguimiento en tiempo real. Recibí notificaciones por email ante cualquier movimiento en tus causas.", icon: <Bell size={42} /> },
    { title: "Estrategia Judicial", desc: "Análisis estratégico de causas para anticipar movimientos, identificar precedentes y tomar mejores decisiones.", icon: <Lightbulb size={42} /> },
    { title: "Antecedentes Completos", desc: "Importá el historial completo de un expediente con un solo crédito. Datos estructurados y listos para trabajar.", icon: <FileDown size={42} /> },
    { title: "Gestión de Expedientes", desc: "Organizá todos tus casos, plazos y documentos en un entorno centralizado, seguro y de acceso inmediato.", icon: <FolderOpen size={42} /> },
    { title: "Hub Federal", desc: "Acceso unificado a todos los fueros federales desde un solo panel. PJN, SCBA, SCW y más.", icon: <Scale size={42} /> },
    { title: "Gestión de Clientes", desc: "CRM jurídico completo con historial de causas, interacciones y vinculación de expedientes por cliente.", icon: <Users size={42} /> },
    { title: "Biblioteca de Modelos", desc: "Escritos, contratos y modelos procesales listos para adaptar y usar. Ahorrá horas de redacción.", icon: <BookOpen size={42} /> },
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
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>
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
              <Link href="#guias" className="link-item">Guías</Link>
              <Link href="/abogados" className="btn-login-premium">Acceso Clientes</Link>
              <button type="button" className="btn-nav-cta" onClick={() => setShowAccessModal(true)}>Ingresar →</button>
            </div>

            <button
              onClick={toggleTheme}
              className="theme-toggle-landing"
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir menú de navegación" aria-expanded={mobileMenuOpen}>
              ☰
            </button>
          </div>
        </div>
      </nav>

      {/* 📱 MOBILE OVERLAY 3.0 */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay">
          <button className="mobile-menu-btn mobile-menu-close" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú de navegación">
            ✕
          </button>


          <Link href="/demo" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>Demo Interactiva</Link>
          <Link href="#features" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>Servicios</Link>
          <Link href="#pricing" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>Precios</Link>
          <Link href="#guias" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>Guías</Link>

          <div className="mobile-access-row">
            <button
              type="button"
              className="btn-login-mobile primary"
              onClick={() => { setMobileMenuOpen(false); setShowAccessModal(true); }}
            >
              Ingresar →
            </button>
            <Link href="/abogados" className="btn-login-mobile" onClick={() => setMobileMenuOpen(false)}>
              Acceso Clientes
            </Link>
          </div>
        </div>
      )}

      {/* 🚀 HERO SECTION 3.0 */}
      <section className="hero-section" id="main-content">
        <div className="hero-grid">
          <div className="hero-content reveal">
            <div className="badge-new">✨ Judic-IA · Plataforma Jurídica de Alto Rendimiento</div>
            <h1 className="hero-title">
              La plataforma que <span className="gradient-text italic-serif">usan los mejores estudios.</span>
            </h1>
            <p className="hero-subtitle">
              Investigá expedientes en PJN y SCBA, configurá alertas automáticas y gestioná tu estudio con tecnología de élite diseñada para abogados de alto rendimiento.
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
            <div className="hero-research-card">
              <div className="hrc-header">
                <span className="hrc-title">Investigación Judicial</span>
                <span className="hrc-source-badge">PJN ▾</span>
              </div>
              <div className="hrc-search">
                <Search size={15} className="hrc-search-icon" />
                <span className="hrc-search-placeholder">Buscar expediente o número de causa...</span>
                <div className="hrc-search-btn">→</div>
              </div>
              <div className="hrc-results">
                <div className="hrc-result">
                  <div className="hrc-result-left">
                    <FileText size={14} className="hrc-result-fileicon" />
                    <div>
                      <div className="hrc-result-name">Martínez c/ García s/ Daños y Perjuicios</div>
                      <div className="hrc-result-meta">Civil · CABA · Juzgado Nº 5</div>
                    </div>
                  </div>
                  <span className="hrc-badge hrc-badge--alert"><Bell size={11} /> Alerta</span>
                </div>
                <div className="hrc-result">
                  <div className="hrc-result-left">
                    <FileText size={14} className="hrc-result-fileicon" />
                    <div>
                      <div className="hrc-result-name">Rodríguez, Ana María s/ Divorcio Vincular</div>
                      <div className="hrc-result-meta">Familia · CABA · Juzgado 12</div>
                    </div>
                  </div>
                </div>
                <div className="hrc-result">
                  <div className="hrc-result-left">
                    <FileText size={14} className="hrc-result-fileicon" />
                    <div>
                      <div className="hrc-result-name">Transportes del Sur SA c/ AFIP s/ Imp.</div>
                      <div className="hrc-result-meta">Cont. Admin. Federal · CABA</div>
                    </div>
                  </div>
                  <span className="hrc-badge hrc-badge--imported">✓ Importado</span>
                </div>
              </div>
              <div className="hrc-footer">
                <span className="hrc-footer-item"><Bell size={12} /> 3 alertas activas</span>
                <span className="hrc-footer-sep">·</span>
                <span className="hrc-footer-item"><Zap size={12} /> 15 créditos</span>
              </div>
            </div>
          </div>
        </div>

        {/* 📊 STATS SECTION (Moved for Full Width Centering) */}
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-icon-wrapper"><Search size={24} /></div>
            <div>
              <span className="stat-value">+50k</span>
              <span className="stat-label">Expedientes buscados</span>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon-wrapper"><Zap size={24} /></div>
            <div>
              <span className="stat-value">&lt; 3s</span>
              <span className="stat-label">Por búsqueda PJN</span>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon-wrapper"><Shield size={24} /></div>
            <div>
              <span className="stat-value">98%</span>
              <span className="stat-label">Uptime garantizado</span>
            </div>
          </div>
        </div>
      </section>

      {/* 🛠️ FEATURES SECTION 3.0 */}
      <section id="features" className="section-container">
        <div className="section-header reveal">
          <h2 className="section-title">Todo lo que necesita <span className="gradient-text italic-serif">tu estudio.</span></h2>
          <p className="section-subtitle">Desde la búsqueda hasta el cierre de cada causa: herramientas reales para abogados que exigen resultados.</p>
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

      {/* 🏷️ PRICING SECTION — Unificado con toggle */}
      <section id="pricing" className="section-container pricing-section-bg">
        <div className="section-header reveal">
          <h2 className="section-title">Planes a <span className="gradient-text italic-serif">tu Medida</span></h2>
          <p className="section-subtitle">Elegí el plan que mejor se adapta a tu forma de trabajar.</p>
        </div>

        {/* Toggle tablist */}
        <div className="pricing-toggle-wrapper reveal">
          <div className="pricing-toggle" role="tablist" aria-label="Tipo de plan">
            <button
              role="tab"
              id="tab-individual"
              aria-selected={pricingTab === 'individual'}
              aria-controls="tabpanel-individual"
              className={`pricing-tab${pricingTab === 'individual' ? ' active' : ''}`}
              onClick={() => setPricingTab('individual')}
            >
              Independiente
            </button>
            <button
              role="tab"
              id="tab-estudio"
              aria-selected={pricingTab === 'estudio'}
              aria-controls="tabpanel-estudio"
              className={`pricing-tab${pricingTab === 'estudio' ? ' active' : ''}`}
              onClick={() => setPricingTab('estudio')}
            >
              Estudio jurídico
            </button>
          </div>
        </div>

        {/* Tab: Independiente */}
        {pricingTab === 'individual' && (
          <div
            id="tabpanel-individual"
            role="tabpanel"
            aria-labelledby="tab-individual"
            className="grid2"
          >
            {/* PLAN STARTER */}
            <div className="price-card-v3">
              <h3 className="price-card-tag">Starter</h3>
              <div className="price-amount">
                Gratis<small className="price-period price-period-item">/ 14 días</small>
              </div>
              <ul className="price-features">
                <li>Jurisprudencia PJN básica</li>
                <li>Hasta 3 búsquedas diarias</li>
                <li>Sin acceso a créditos extra</li>
                <li>Soporte limitado</li>
              </ul>
              <Link href="/register" className="btn-secondary-v3 price-btn-wrap">
                Comenzar Gratis
              </Link>
            </div>

            {/* PLAN PROFESIONAL */}
            <div className="price-card-v3 featured">
              <span className="price-badge">MÁS ELEGIDO</span>
              <h3 className="price-card-tag-featured">Profesional</h3>
              <div className="price-amount">
                <span className="price-currency">$</span>25.000<small className="price-period price-period-item">/ mes</small>
              </div>
              <ul className="price-features">
                <li className="premium-check">Jurisprudencia PJN + SCBA + Hub Federal</li>
                <li className="premium-check">Créditos de alertas y antecedentes disponibles</li>
                <li className="premium-check">Gestión de expedientes, clientes y biblioteca</li>
                <li className="premium-check">Calculadoras y legislación integradas</li>
                <li className="premium-check">Soporte prioritario</li>
              </ul>
              <Link href="/register" className="btn-primary-v3 price-btn-featured">
                Suscribirse Ahora
              </Link>
            </div>
          </div>
        )}

        {/* Tab: Estudio */}
        {pricingTab === 'estudio' && (
          <div
            id="tabpanel-estudio"
            role="tabpanel"
            aria-labelledby="tab-estudio"
            className="pricing-grid-estudio"
          >
            {[
              {
                label: 'Enterprise S', members: 'Hasta 5 miembros', price: '89.000',
                features: [
                  'Hasta 5 abogados en simultáneo',
                  'Bandeja compartida de causas',
                  'Pool de créditos del estudio',
                  'Supervisión de causas del equipo',
                  'Roles Titular / Supervisor / Abogado',
                ],
                cta: 'Registrar Estudio', href: '/registro-estudio',
              },
              {
                label: 'Enterprise M', members: 'Hasta 10 miembros', price: '149.000', featured: true,
                features: [
                  'Hasta 10 abogados en simultáneo',
                  'Bandeja compartida de causas',
                  'Pool de créditos del estudio',
                  'Supervisión de causas del equipo',
                  'Historial de uso de créditos por miembro',
                  'Soporte prioritario',
                ],
                cta: 'Registrar Estudio', href: '/registro-estudio',
              },
              {
                label: 'Enterprise L', members: 'Hasta 20 miembros', price: '249.000',
                features: [
                  'Hasta 20 abogados en simultáneo',
                  'Bandeja compartida de causas',
                  'Pool de créditos del estudio',
                  'Supervisión de causas del equipo',
                  'Historial de uso de créditos por miembro',
                  'Soporte VIP dedicado',
                ],
                cta: 'Registrar Estudio', href: '/registro-estudio',
              },
              {
                label: 'Enterprise XL', members: 'Miembros ilimitados', price: '449.000',
                features: [
                  'Sin límite de miembros',
                  'Todas las funciones incluidas',
                  'Onboarding y configuración inicial',
                  'Soporte técnico prioritario',
                  'Pool de créditos ampliado',
                ],
                cta: 'Contactar ventas', href: '/registro-estudio',
              },
            ].map(p => (
              <div key={p.label} className={`ec${p.featured ? ' ec--featured' : ''}`}>
                {p.featured && <span className="ec-badge">MÁS ELEGIDO</span>}
                <div className="ec-top">
                  <span className="ec-name">{p.label}</span>
                  <span className="ec-members">{p.members}</span>
                </div>
                <div className="ec-price">
                  <span className="ec-currency">$</span>
                  <span className="ec-amount">{p.price}</span>
                  <span className="ec-period">/ mes</span>
                </div>
                <ul className="ec-features">
                  {p.features.map(f => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link href={p.href} className={`ec-btn${p.featured ? ' ec-btn--primary' : ''}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <VideoGuides />
      <div className="section-spacer"></div>

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
              <p>Puedes buscar un abogado en nuestro directorio o ingresar con tu clave.</p>
            </div>
            <Link href="/abogados" className="btn-banner-action">
              Buscar Abogados
            </Link>
          </div>
        </div>
      )}



      {/* 🔐 ACCESO ABOGADOS MODAL v4 */}
      {showAccessModal && (
        <div
          className="access-modal-overlay"
          onClick={() => setShowAccessModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="access-modal-title"
          onKeyDown={e => e.key === 'Escape' && setShowAccessModal(false)}
        >
          <div className="access-modal-v4" onClick={e => e.stopPropagation()}>
            <div className="access-modal-v4-header">
              <h2 id="access-modal-title" className="access-modal-v4-title">Acceso Profesional</h2>
              <button
                type="button"
                className="access-modal-v4-close"
                onClick={() => setShowAccessModal(false)}
                aria-label="Cerrar modal de acceso"
              >
                <XIcon size={18} />
              </button>
            </div>
            <p className="access-modal-v4-sub">¿Cómo querés ingresar?</p>

            <div className="access-modal-v4-options">
              <Link
                href="/login"
                className="access-option-row"
                onClick={() => setShowAccessModal(false)}
              >
                <div className="access-option-icon" aria-hidden="true">
                  <LogIn size={22} />
                </div>
                <div className="access-option-body">
                  <span className="access-option-label">Abogado independiente</span>
                  <span className="access-option-desc">Tu panel personal de Judic-IA</span>
                </div>
                <ChevronRight size={18} className="access-option-arrow" aria-hidden="true" />
              </Link>

              <Link
                href="/login"
                className="access-option-row"
                onClick={() => setShowAccessModal(false)}
              >
                <div className="access-option-icon" aria-hidden="true">
                  <Building2 size={22} />
                </div>
                <div className="access-option-body">
                  <span className="access-option-label">Mi estudio jurídico</span>
                  <span className="access-option-desc">Panel compartido del estudio</span>
                </div>
                <ChevronRight size={18} className="access-option-arrow" aria-hidden="true" />
              </Link>
            </div>

            <div className="access-modal-v4-register">
              <span>¿Todavía no tenés estudio?</span>
              <Link href="/registro-estudio" onClick={() => setShowAccessModal(false)}>
                Registrar mi estudio →
              </Link>
            </div>
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
              <Link href="/#pricing">Precios</Link>
              <Link href="/#servicios">Servicios</Link>
              <Link href="/demo">Demo</Link>
            </div>

            <div className="nav-group">
              <h4>Soporte</h4>
              <a href="mailto:soporte@judic-ia.com">Ayuda Técnica</a>
              <a href="mailto:billing@judic-ia.com">Ventas y Facturación</a>
              <Link href="/legal?tab=seguridad">Centro de Seguridad</Link>
            </div>

            <div className="nav-group">
              <h4>Legal</h4>
              <Link href="/legal?tab=terminos">Términos de Uso</Link>
              <Link href="/legal?tab=privacidad">Privacidad</Link>
              <Link href="/legal">Aviso Legal</Link>
              <Link href="/legal?tab=cookies">Cookies</Link>
              <Link href="/legal?tab=novedades">Novedades</Link>
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

      {/* WhatsApp floating widget */}
      <a
        href="https://wa.me/5491168805604?text=Hola%2C%20quiero%20probar%20el%20asistente%20Judic-IA"
        target="_blank"
        rel="noopener noreferrer"
        className="wa-float-btn"
        aria-label="Probá el agente en WhatsApp"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span>Probá el agente</span>
      </a>
    </main>
  );
}
