"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from "./page.module.css";
import Link from "next/link";
import SafeChatWidget from "./components/SafeChatWidget";

export default function Home() {
  const router = useRouter();

  // Landing page is public. No auto-redirect here to allow viewing services/pricing.
  useEffect(() => {
    // Optional: add some logic here if needed, but not for redirection
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  return (
    <main className={styles.main}>
      {/* Navbar */}
      <nav className="glass-navbar fade-in">
        <div className="nav-container">
          <div className="nav-brand">
            <img src="/logo.png" alt="Logo" className="nav-logo" width="38" height="38" />
            <span className="nav-title text-glow">Judic-IA <span className="justice-emoji">⚖️</span></span>
          </div>
          <div className="landing-nav-links">
            <Link href="#features" className="link-item">Servicios</Link>
            <Link href="#pricing" className="link-item">Precios</Link>
            <Link href="/login" className="btn-login-premium">Login Abogado</Link>
          </div>

          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menú"
          >
            ☰
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="mobile-menu-overlay fade-in">
            <Link href="#features" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>Servicios</Link>
            <Link href="#pricing" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>Precios</Link>
            <Link href="/login" className="btn-login-mobile" onClick={() => setMobileMenuOpen(false)}>Login Abogado</Link>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-grid">
          <div className="hero-content">
            <div className="badge-new slide-up">✨ Versión 2.0 • IA Legal de Élite</div>
            <h1 className="hero-title slide-up-delayed">
              Tu Estudio Jurídico, <br />
              <span className="gradient-text italic-serif">Potenciado por IA.</span>
            </h1>
            <p className="hero-subtitle slide-up-extra-delayed">
              Automatizá la atención de consultas, investigá jurisprudencia en segundos y gestioná tus expedientes en una sola plataforma segura de alto rendimiento.
            </p>
            <div className="hero-actions slide-up-extra-delayed">
              <Link href="/demo" className="btn-primary-glow">
                Probar Demo Cliente ↘️
              </Link>
              <Link href="#pricing" className="btn-secondary-outline">
                Ver Planes y Precios
              </Link>
            </div>
          </div>

          {/* Hero Card (Static Mockup per user request) */}
          <div className="hero-card slide-up-extra-delayed">
            <div className="mini">
              <div className="mini-head">
                <div className="mini-title">Dr. Martínez <small>Abogado · Derecho Laboral · CABA</small></div>
                <div className="pill">Demo en vivo</div>
              </div>
              <div className="bubble">👋 Hola, soy el asistente virtual del Dr. Martínez. ¿En qué puedo ayudarte hoy?</div>
              <div className="chips">
                <div className="chip">Despido</div>
                <div className="chip">Trabajo en negro</div>
                <div className="chip">Liquidación</div>
                <div className="chip">Art / Riesgos</div>
              </div>
              <div className="input-mock">
                <span>Escribí tu consulta...</span>
                <div className="send-mock">▶</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid (Single line 4 cols) */}
      <section id="features" className="section-container">
        <div className="section-header">
          <h2 className="section-title">Soluciones de Próxima Generación</h2>
          <p className="section-subtitle">Lo mejor de la tecnología legal, diseñado para abogados exigentes. Menos fricción, más velocidad, más cierres.</p>
        </div>
        <div className="grid4">
          <div className="card">
            <div className="ic">🤖</div>
            <h3>Asistente Virtual 24/7</h3>
            <p>Filtra casos viables, responde FAQs y deriva a agenda cuando corresponde.</p>
          </div>
          <div className="card">
            <div className="ic">⚖️</div>
            <h3>Investigación Avanzada</h3>
            <p>Encuentra fallos y doctrina relevante con enfoque práctico y citación clara.</p>
          </div>
          <div className="card">
            <div className="ic">📂</div>
            <h3>CRM Legal</h3>
            <p>Casos, clientes y documentación en un panel simple, rápido y auditado.</p>
          </div>
          <div className="card">
            <div className="ic">📅</div>
            <h3>Agenda Judicial</h3>
            <p>Recordatorios inteligentes de plazos, audiencias y tareas críticas.</p>
          </div>
        </div>
      </section>

      {/* Pricing (Side by Side 2 cols) */}
      <section id="pricing" className="section-container pricing-section">
        <div className="section-header">
          <h2 className="section-title">Excelencia a tu Alcance</h2>
          <p className="section-subtitle">Precios claros. Beneficio rápido. Sin humo.</p>
        </div>
        <div className="grid2">
          <div className="price">
            <h3>Starter</h3>
            <div className="money">Gratis <small>/ 14 días</small></div>
            <ul className="list">
              <li><span className="tick">✓</span> Asistente IA básico</li>
              <li><span className="tick">✓</span> Hasta 5 consultas diarias</li>
              <li><span className="tick">✓</span> Búsqueda de jurisprudencia (2/día)</li>
              <li><span className="tick">✓</span> Soporte limitado</li>
            </ul>
            <Link href="/register" className="btn-secondary-outline" style={{ display: 'block', textAlign: 'center', marginTop: '20px' }}>Comenzar Gratis</Link>
          </div>

          <div className="price featured">
            <div className="ribbon">MÁS ELEGIDO</div>
            <h3>Profesional</h3>
            <div className="money">$25.000 <small>/ mes</small></div>
            <ul className="list">
              <li><span className="tick">✓</span> <strong>Asistente IA ilimitado</strong></li>
              <li><span className="tick">✓</span> <strong>Gestión completa de clientes</strong></li>
              <li><span className="tick">✓</span> Alertas de plazos y vencimientos</li>
              <li><span className="tick">✓</span> Soporte VIP 24/7</li>
            </ul>
            <Link href="/register" className="btn-primary-glow" style={{ display: 'block', textAlign: 'center', marginTop: '20px' }}>Suscribirse Ahora</Link>
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="cta-section">
        <div className="section-container">
          <div className="cta-card">
            <h2 className="section-title" style={{ marginBottom: '8px' }}>¿Listo para transformar tu práctica legal?</h2>
            <p className="section-subtitle" style={{ marginBottom: '26px' }}>Unite a los estudios que ya automatizan, responden más rápido y convierten mejor.</p>
            <div className="hero-actions" style={{ justifyContent: 'center' }}>
              <Link href="/register" className="btn-primary-glow">Empezar Ahora</Link>
              <Link href="#features" className="btn-secondary-outline">Ver servicios ↗</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer-premium-v2">
        <div className="foot">
          <div className="foot-brand">
            <div className="nav-logo" style={{ width: '34px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.1)' }}>⚖️</div>
            <div>
              <div style={{ fontWeight: 900, color: '#e2e8f0' }}>Judic-IA</div>
              <div className="foot-note">© 2026 — LegalTech Argentina</div>
            </div>
          </div>
          <div className="foot-note">
            <Link href="/legal#security">Seguridad</Link> · <Link href="/legal#privacy">Privacidad</Link> · <Link href="/legal#terms">Términos</Link> · <a href="mailto:hola@judic-ia.com">Ventas</a> · <a href="mailto:soporte@judic-ia.com">Soporte</a>
          </div>
        </div>
      </footer>

      {/* Sales Bot */}
      <SafeChatWidget
        mode="sales"
        initialMessage="¡Hola! 👋 Soy el asistente de ventas de Judic-IA. ¿Tienes preguntas sobre cómo automatizar tu estudio?"
      />
    </main >
  );
}
