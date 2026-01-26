"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import "../landing.css";

import { Lock, ShieldCheck, Cloud, FileText, User, Shield } from 'lucide-react';

export default function LegalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('terminos');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['terminos', 'privacidad', 'seguridad'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const tabs = [
    { id: 'terminos', label: 'Términos', icon: <FileText size={20} /> },
    { id: 'privacidad', label: 'Privacidad', icon: <User size={20} /> },
    { id: 'seguridad', label: 'Seguridad', icon: <Shield size={20} /> }
  ];

  const handleTabClick = (id) => {
    setActiveTab(id);
    router.push(`/legal?tab=${id}`, { scroll: false });
  };

  return (
    <main className="legal-portal landing-v3">
      <div className="bg-mesh"></div>

      {/* 💎 NAVIGATION */}
      <nav className="glass-navbar">
        <div className="nav-container">
          <Link href="/" className="nav-brand">
            <img src="/logo.png" alt="Logo" className="nav-logo" />
            <span className="nav-title">Judic-IA</span>
          </Link>
          <Link href="/" className="btn-login-premium">← Volver al Inicio</Link>
        </div>
      </nav>

      <section className="hero-section" style={{ padding: '160px 0 40px' }}>
        <div className="section-header reveal active">
          <span className="badge-new">Legales & Compliance</span>
          <h1 className="hero-title">Centro de <span className="gradient-text italic-serif">Confianza</span></h1>
          <p className="hero-subtitle">Nuestra prioridad es la transparencia y la protección de tu ejercicio profesional.</p>
        </div>
      </section>

      <section className="section-container" style={{ paddingTop: '20px' }}>
        <div className="legal-layout">
          {/* SIDEBAR TABS - Desktop style */}
          <aside className="legal-sidebar reveal active">
            <div className="legal-tabs-vertical">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`legal-tab-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => handleTabClick(tab.id)}
                >
                  <span className="tab-icon-wrapper">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </aside>

          {/* CONTENT AREA */}
          <div className="legal-main-content reveal active" style={{ transitionDelay: '0.2s' }}>
            <div className="legal-content-card-v3">
              {activeTab === 'terminos' && (
                <div className="legal-section-fade">
                  <div className="content-header-v3">
                    <div className="content-num">01</div>
                    <h2 className="section-title-v3">Términos de <span className="gradient-text italic-serif">Servicio</span></h2>
                  </div>
                  <div className="legal-text-body-premium">
                    <p className="lead-text">Bienvenido a Judic-IA. El uso de esta plataforma constituye la aceptación de los siguientes términos profesionales.</p>

                    <div className="legal-grid-features">
                      <div className="legal-feature-item">
                        <div className="feature-marker"></div>
                        <div className="feature-text">
                          <strong>Asistencia Técnica:</strong> Judic-IA es una herramienta de asistencia IA y no sustituye el juicio ni la responsabilidad del abogado.
                        </div>
                      </div>
                      <div className="legal-feature-item">
                        <div className="feature-marker"></div>
                        <div className="feature-text">
                          <strong>Uso Profesional:</strong> El acceso es estrictamente profesional, personal e intransferible para el titular de la cuenta.
                        </div>
                      </div>
                      <div className="legal-feature-item">
                        <div className="feature-marker"></div>
                        <div className="feature-text">
                          <strong>Integridad del Sistema:</strong> Queda prohibido cualquier intento de ingeniería inversa o uso automatizado no autorizado.
                        </div>
                      </div>
                      <div className="legal-feature-item">
                        <div className="feature-marker"></div>
                        <div className="feature-text">
                          <strong>Transacciones:</strong> Los pagos se procesan en pesos argentinos mediante pasarelas cifradas de Mercado Pago.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'privacidad' && (
                <div className="legal-section-fade">
                  <div className="content-header-v3">
                    <div className="content-num">02</div>
                    <h2 className="section-title-v3">Política de <span className="gradient-text italic-serif">Privacidad</span></h2>
                  </div>
                  <div className="legal-text-body-premium">
                    <p className="lead-text">La confidencialidad es el pilar de la relación abogado-cliente. Nosotros la extendemos a nuestra tecnología.</p>

                    <div className="privacy-card-grid">
                      <div className="privacy-pill-item">
                        <span className="pill-dot"></span>
                        <div>
                          <strong>Propiedad de los Datos:</strong> Tus datos y los de tus casos son tuyos. No los comercializamos ni compartimos.
                        </div>
                      </div>
                      <div className="privacy-pill-item">
                        <span className="pill-dot"></span>
                        <div>
                          <strong>Entrenamiento Ético:</strong> No utilizamos conversaciones reales para entrenar modelos globales fuera de procesos anonimizados.
                        </div>
                      </div>
                      <div className="privacy-pill-item">
                        <span className="pill-dot"></span>
                        <div>
                          <strong>Derechos de Usuario:</strong> Podes solicitar la portabilidad o eliminación de toda tu información en un solo clic.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'seguridad' && (
                <div className="legal-section-fade">
                  <div className="content-header-v3">
                    <div className="content-num">03</div>
                    <h2 className="section-title-v3">Infraestructura de <span className="gradient-text italic-serif">Seguridad</span></h2>
                  </div>
                  <div className="legal-text-body-premium">
                    <p className="lead-text">Implementamos protocolos de seguridad de grado militar para el resguardo de la información jurídica.</p>

                    <div className="security-visual-grid">
                      <div className="security-v-card">
                        <div className="v-card-icon"><Lock size={42} /></div>
                        <h3>TLS/SSL 1.3</h3>
                        <p>Toda la comunicación entre tu navegador y nuestros servidores está cifrada de extremo a extremo.</p>
                      </div>
                      <div className="security-v-card">
                        <div className="v-card-icon"><ShieldCheck size={42} /></div>
                        <h3>AES-256 bits</h3>
                        <p>Los archivos y datos en reposo se almacenan utilizando el estándar de encriptación más avanzado del mundo.</p>
                      </div>
                      <div className="security-v-card">
                        <div className="v-card-icon"><Cloud size={42} /></div>
                        <h3>Cloudflare Shield</h3>
                        <p>Protección permanente contra ataques DDoS y escaneo de vulnerabilidades en tiempo real.</p>
                      </div>
                    </div>

                    <div className="security-footer-note">
                      <div className="note-pulse"></div>
                      <p>Las consultas se procesan en entornos volátiles aislados, garantizando el secreto profesional absoluto.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 📞 SUPPORT CONTACT SECTION */}
      <section className="section-container reveal active" style={{ paddingBottom: '100px' }}>
        <div className="legal-contact-footer">
          <div className="contact-footer-header">
            <h3>¿Dudas adicionales?</h3>
            <p>Nuestro equipo legal y técnico está disponible para asistirte.</p>
          </div>
          <div className="contact-footer-grid">
            <a href="mailto:soporte@judic-ia.com" className="contact-box-premium">
              <span className="box-label">Soporte Técnico</span>
              <span className="box-email">soporte@judic-ia.com</span>
            </a>
            <a href="mailto:billing@judic-ia.com" className="contact-box-premium">
              <span className="box-label">Facturación</span>
              <span className="box-email">billing@judic-ia.com</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="footer-premium-v3">
        <div className="footer-nav-container" style={{ opacity: 0.6 }}>
          <div>© 2026 Judic-IA Legal Intelligence. Todos los derechos reservados.</div>
        </div>
      </footer>

      <style jsx>{`
        .legal-portal {
          min-height: 100vh;
          background: #020617;
          overflow-x: hidden;
        }

        .legal-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 3rem;
          align-items: start;
        }

        /* SIDEBAR */
        .legal-sidebar {
          position: sticky;
          top: 100px;
        }

        .legal-tabs-vertical {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          padding: 1rem;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 24px;
          backdrop-filter: blur(10px);
        }

        .legal-tab-nav-btn {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.2rem 1.5rem;
          border-radius: 16px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 1rem;
          text-align: left;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tab-icon-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          transition: 0.3s;
        }

        .legal-tab-nav-btn.active {
          background: rgba(251, 191, 36, 0.08);
          border-color: rgba(251, 191, 36, 0.2);
          color: white;
          transform: translateX(8px);
        }

        .legal-tab-nav-btn.active .tab-icon-dot {
          background: var(--accent);
          box-shadow: 0 0 12px var(--accent);
        }

        .legal-tab-nav-btn:hover:not(.active) {
          color: white;
          background: rgba(255,255,255,0.03);
        }

        /* MAIN CONTENT CARD */
        .legal-content-card-v3 {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(40px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 40px;
          padding: 4rem;
          min-height: 500px;
          position: relative;
          box-shadow: 0 50px 100px rgba(0,0,0,0.6);
        }

        .content-header-v3 {
          display: flex;
          align-items: flex-end;
          gap: 1.5rem;
          margin-bottom: 3.5rem;
        }

        .content-num {
          font-family: 'Playfair Display', serif;
          font-size: 4rem;
          font-weight: 900;
          line-height: 0.8;
          opacity: 0.15;
          color: var(--accent);
        }

        .section-title-v3 {
          font-family: 'Playfair Display', serif;
          font-size: 2.8rem;
          font-weight: 950;
          margin: 0;
          line-height: 1;
        }

        .lead-text {
          font-size: 1.3rem;
          color: white;
          font-weight: 500;
          line-height: 1.5;
          margin-bottom: 3rem;
          opacity: 0.9;
        }

        /* TEXT BODY PREMIUM */
        .legal-grid-features {
            display: grid;
            gap: 2rem;
        }

        .legal-feature-item {
            display: flex;
            gap: 1.5rem;
            padding: 2rem;
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 20px;
            transition: 0.3s;
        }

        .legal-feature-item:hover {
            border-color: rgba(251, 191, 36, 0.2);
            background: rgba(251, 191, 36, 0.02);
        }

        .feature-marker {
            width: 4px;
            height: 48px;
            background: var(--accent-gradient);
            border-radius: 99px;
            flex-shrink: 0;
        }

        .feature-text {
            color: #cbd5e1;
            font-size: 1.1rem;
            line-height: 1.7;
        }

        .feature-text strong {
            color: white;
            display: block;
            margin-bottom: 0.5rem;
        }

        /* PRIVACY STYLES */
        .privacy-card-grid {
            display: grid;
            gap: 1.5rem;
        }

        .privacy-pill-item {
            display: flex;
            gap: 1.5rem;
            align-items: flex-start;
            padding: 1.8rem;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 24px;
        }

        .pill-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--accent);
            margin-top: 6px;
            flex-shrink: 0;
        }

        /* SECURITY VISUALS */
        .security-visual-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
            margin-bottom: 3rem;
        }

        .security-v-card {
            background: rgba(2, 6, 23, 0.4);
            padding: 2rem;
            border-radius: 24px;
            border: 1px solid rgba(255,255,255,0.04);
            text-align: center;
        }

        .v-card-icon {
            font-size: 2rem;
            margin-bottom: 1.5rem;
            display: block;
        }

        .security-v-card h3 {
            font-size: 1.1rem;
            font-weight: 800;
            color: white;
            margin-bottom: 0.8rem;
        }

        .security-v-card p {
            font-size: 0.9rem;
            color: #94a3b8;
            line-height: 1.5;
            margin: 0;
        }

        .security-footer-note {
            display: flex;
            align-items: center;
            gap: 1.5rem;
            padding: 1.5rem 2rem;
            background: rgba(251, 191, 36, 0.05);
            border: 1px solid rgba(251, 191, 36, 0.2);
            border-radius: 20px;
        }

        .note-pulse {
            width: 12px;
            height: 12px;
            background: var(--accent);
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7); }
            70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(251, 191, 36, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
        }

        /* CONTACT FOOTER */
        .legal-contact-footer {
            background: linear-gradient(135deg, rgba(255,255,255,0.03), transparent);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 40px;
            padding: 4rem;
            text-align: center;
        }

        .contact-footer-header h3 {
            font-family: 'Playfair Display', serif;
            font-size: 2.5rem;
            font-weight: 900;
            margin-bottom: 0.5rem;
        }

        .contact-footer-header p {
            color: var(--text-secondary);
            margin-bottom: 3rem;
        }

        .contact-footer-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
            max-width: 800px;
            margin: 0 auto;
        }

        .contact-box-premium {
            padding: 2rem;
            background: rgba(15, 23, 42, 0.5);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 24px;
            text-decoration: none;
            transition: 0.3s cubic-bezier(0.19, 1, 0.22, 1);
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .contact-box-premium:hover {
            transform: translateY(-5px);
            border-color: var(--accent);
            background: rgba(251, 191, 36, 0.05);
        }

        .box-label {
            color: var(--text-dim);
            font-size: 0.85rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
        }

        .box-email {
            color: var(--accent);
            font-size: 1.25rem;
            font-weight: 800;
        }

        /* --- RESPONSIVE --- */
        /* --- RESPONSIVE PREMIUM --- */
        @media (max-width: 1024px) {
            .legal-layout { 
                grid-template-columns: 1fr; 
                gap: 2rem;
            }
            .legal-sidebar { 
                position: relative;
                top: 0;
                z-index: 10;
            }
            .legal-tabs-vertical { 
                flex-direction: row; 
                overflow-x: auto; 
                padding: 0.5rem; 
                border-radius: 16px;
                /* Hide scrollbar */
                -ms-overflow-style: none;  /* IE and Edge */
                scrollbar-width: none;  /* Firefox */
            }
            .legal-tabs-vertical::-webkit-scrollbar {
                display: none;
            }
            .legal-tab-nav-btn { 
                white-space: nowrap; 
                padding: 0.8rem 1.2rem;
                background: rgba(255,255,255,0.03); 
                border: 1px solid rgba(255,255,255,0.05);
            }
            .legal-tab-nav-btn.active {
                background: rgba(251, 191, 36, 0.1);
                border-color: var(--accent);
            }
            .legal-content-card-v3 { 
                padding: 3rem; 
            }
        }

        @media (max-width: 768px) {
            .nav-container {
                padding: 0 1.2rem;
            }
            
            /* Logo & Button adjustments */
            .nav-brand .nav-title {
                display: none; /* Hide text to save space, keep logo */
            }
            .nav-logo {
                height: 48px;
            }
            .btn-login-premium {
                padding: 0.6rem;
                width: 48px;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%; /* Circle button */
                font-size: 1.2rem;
            }
            .btn-login-premium span {
                display: none; /* Hide text */
            }
            .btn-login-premium::before {
                content: "←"; /* Only arrow */
                font-weight: 900;
            }

            /* Stack Layout */
            .legal-layout { 
                grid-template-columns: 1fr; 
                gap: 2rem;
            }

            /* Tabs: Stack vertically as requested */
            .legal-sidebar {
                position: relative;
                z-index: 10;
            }
            .legal-tabs-vertical { 
                flex-direction: column; /* Stack them */
                padding: 0.5rem; 
                gap: 0.5rem;
                background: rgba(15, 23, 42, 0.8); /* Darker background */
            }
            .legal-tab-nav-btn { 
                width: 100%; /* Full width */
                padding: 1rem;
                justify-content: flex-start; /* Align text left */
                background: rgba(255,255,255,0.03); 
                border-radius: 12px;
            }
            .legal-tab-nav-btn.active {
                background: rgba(251, 191, 36, 0.15);
                border-color: var(--accent);
            }

            /* Content Cards */
            .legal-content-card-v3 { 
                padding: 1.5rem; 
                border-radius: 20px;
                overflow: hidden; /* Prevent overflow */
            }

            /* Typography Scaling */
            .hero-section {
                padding: 130px 0 2rem !important;
            }
            .hero-title {
                font-size: 2.2rem;
            }
            .section-title-v3 {
                font-size: 1.6rem;
                word-break: break-word; /* Prevent long words overflowing */
            }
            .content-num {
                font-size: 2.5rem;
            }
            
            /* Grids */
            .legal-grid-features, 
            .privacy-card-grid, 
            .security-visual-grid, 
            .contact-footer-grid { 
                grid-template-columns: 1fr; 
                gap: 1rem;
            }
            .privacy-pill-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 0.8rem;
                padding: 1.2rem;
            }
        }

        @media (max-width: 480px) {
            .hero-title {
                font-size: 1.8rem;
            }
            .legal-content-card-v3 { 
                padding: 1.2rem; 
            }
            .lead-text {
                font-size: 0.95rem;
            }
        }

        /* ANIMATIONS */
        .legal-section-fade {
            animation: legalFade 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes legalFade {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
