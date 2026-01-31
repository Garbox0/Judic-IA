"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import "../landing.css";
import Image from "next/image"; // Added import
import "./legal.css";

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
            <Image
              src="/judic-ia-mark.png"
              alt="Judic-IA Logo"
              className="nav-logo"
              width={48}
              height={64}
              priority
            />
            <span className="nav-title text-glow">Judic-IA</span>
          </Link>
          <Link href="/" className="btn-login-premium">
            <span className="nav-btn-text">← Volver al Inicio</span>
          </Link>
        </div >
      </nav >

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
    </main >
  );
}
