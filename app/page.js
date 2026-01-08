"use client";
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { useRouter } from 'next/navigation';
import styles from "./page.module.css";
import Link from "next/link";
import SafeChatWidget from "./components/SafeChatWidget";

export default function Home() {
  const router = useRouter();

  // Landing page is public. No auto-redirect here to allow viewing services/pricing.
  // Login button handles redirection if already authenticated.
  useEffect(() => {
    // Optional: add some logic here if needed, but not for redirection
  }, []);

  return (
    <main className={styles.main}>
      {/* Import Fonts */}
      {/* Fonts imported in landing.css */}


      {/* Navbar */}
      <nav className="glass-navbar fade-in">
        <div className="nav-container">
          <div className="nav-brand">
            <img src="/logo.png" alt="Logo" className="nav-logo" width="38" height="38" />
            <span className="nav-title text-glow">Judic-IA <span className="justice-emoji">⚖️</span></span>
          </div>
          <div className="nav-links">
            <Link href="#features" className="link-item">Servicios</Link>
            <Link href="#pricing" className="link-item">Precios</Link>
            <Link href="/login" className="btn-login-premium">Login Abogado</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="badge-new slide-up">✨ Versión 2.0 • IA Legal de Élite</div>
          <h1 className="hero-title slide-up-delayed">
            Tu Estudio Jurídico, <br />
            <span className="gradient-text italic-serif">Potenciado por IA.</span>
          </h1>
          <p className="hero-subtitle slide-up-extra-delayed">
            Automatiza la atención de consultas, investiga jurisprudencia en segundos y gestiona tus expedientes en una sola plataforma segura de alto rendimiento.
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
        <div className="hero-visual">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
      </section>

      {/* Services Grid */}
      <section id="features" className="section-container">
        <div className="section-header">
          <h2 className="section-title">Soluciones de Próxima Generación</h2>
          <p className="section-subtitle">Lo mejor de la tecnología legal diseñado para abogados exigentes.</p>
        </div>
        <div className="services-grid">
          <div className="service-card-premium">
            <div className="icon-box-premium">🤖</div>
            <h3>Asistente Virtual 24/7</h3>
            <p>Atención automatizada que filtra casos viables y agenda citas mientras te enfocas en litigar.</p>
          </div>
          <div className="service-card-premium">
            <div className="icon-box-premium">⚖️</div>
            <h3>Investigación Avanzada</h3>
            <p>IA especializada que encuentra fallos y doctrina relevante en tiempo récord con precisión quirúrgica.</p>
          </div>
          <div className="service-card-premium">
            <div className="icon-box-premium">📂</div>
            <h3>CRM Legal Inteligente</h3>
            <p>Control total de tus expedientes y documentos en un entorno seguro y visualmente intuitivo.</p>
          </div>
          <div className="service-card-premium">
            <div className="icon-box-premium">📅</div>
            <h3>Agenda Judicial</h3>
            <p>Notificaciones inteligentes de plazos y audiencias sincronizadas con tu flujo de trabajo.</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="section-container bg-radial-accent">
        <div className="section-header">
          <h2 className="section-title">Excelencia a tu Alcance</h2>
          <p className="section-subtitle">Elige el plan que impulsará tu crecimiento profesional.</p>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card-premium">
            <h3>Starter</h3>
            <div className="price-tag">Gratis <small>/ 14 días</small></div>
            <ul className="benefits-list">
              <li>✓ Asistente IA Básico</li>
              <li>✓ Hasta 5 consultas diarias</li>
              <li>✓ Búsqueda de jurisprudencia</li>
            </ul>
            <Link href="/register" className="btn-outline-gold">Comenzar Gratis</Link>
          </div>
          <div className="pricing-card-premium featured">
            <div className="top-badge">MÁS ELEGIDO</div>
            <h3>Profesional</h3>
            <div className="price-tag gold">$25.000 <small>/ mes</small></div>
            <ul className="benefits-list">
              <li>✓ <strong>Asistente IA Ilimitado</strong></li>
              <li>✓ <strong>Gestión Completa de Clientes</strong></li>
              <li>✓ Alertas de plazos y vencimientos</li>
              <li>✓ Soporte VIP 24/7</li>
            </ul>
            <Link href="/register" className="btn-gold-fill">Suscribirse Ahora</Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta-section slide-up">
        <div className="cta-glass-card">
          <div className="cta-content">
            <h2 className="cta-title">¿Listo para transformar tu práctica legal?</h2>
            <p className="cta-text">Únete a los cientos de abogados que ya están liderando con tecnología de élite.</p>
            <div className="cta-buttons">
              <Link href="/register" className="btn-gold-fill large">Empezar Ahora</Link>
              <Link href="#features" className="link-item white-text">Ver todos los servicios ↗</Link>
            </div>
          </div>
          <div className="cta-glow"></div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer-premium-v2">
        <div className="footer-v2-grid">
          <div className="footer-v2-main">
            <div className="footer-v2-brand">
              <img src="/logo.png" alt="Logo" className="footer-v2-logo-img" width="40" height="40" />
              <span className="footer-v2-logo-text">Judic-IA <span className="justice-emoji">⚖️</span></span>
            </div>
            <p className="footer-v2-desc">
              La plataforma de inteligencia jurídica líder en Argentina.
              Elevamos el estándar de la práctica legal con tecnología de vanguardia.
            </p>
            <div className="footer-v2-socials">
              <span className="social-icon">𝕏</span>
              <span className="social-icon">LinkedIn</span>
              <span className="social-icon">IG</span>
            </div>
          </div>

          <div className="footer-v2-links">
            <div className="v2-nav-col">
              <h4>Plataforma</h4>
              <Link href="/login">Acceso Abogados</Link>
              <Link href="/consultas/auth">Área de Clientes</Link>
              <Link href="#pricing">Planes y Precios</Link>
              <Link href="/demo">Demo Interactiva</Link>
            </div>
            <div className="v2-nav-col">
              <h4>Compañía</h4>
              <Link href="#">Sobre Judic-IA</Link>
              <Link href="#">Centro de Ayuda</Link>
              <Link href="#">Blog LegalTech</Link>
              <Link href="#">Contacto</Link>
            </div>
            <div className="v2-nav-col">
              <h4>Legales</h4>
              <Link href="#">Políticas de Privacidad</Link>
              <Link href="#">Términos de Servicio</Link>
              <Link href="#">Seguridad de Datos</Link>
              <Link href="#">Cookies</Link>
            </div>
          </div>
        </div>

        <div className="footer-v2-bottom">
          <div className="footer-v2-bottom-content">
            <p>© 2026 Judic-IA LegalTech Argentina. Todos los derechos reservados.</p>
            <div className="footer-status-indicator">
              <span className="status-dot"></span> Sistemas Operativos (Vercel Core)
            </div>
          </div>
        </div>
      </footer>

      {/* Styles moved to app/landing.css to prevent FOUC */}


      {/* Sales Bot - Selling the SaaS */}
      <SafeChatWidget
        mode="sales"
        initialMessage="¡Hola! 👋 Soy el asistente de ventas de Judic-IA. ¿Tienes preguntas sobre cómo automatizar tu estudio?"
      />
    </main>
  );
}
