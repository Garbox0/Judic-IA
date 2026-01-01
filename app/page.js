"use client";
import styles from "./page.module.css";
import Link from "next/link";
import ChatWidget from "./components/ChatWidget";
import { useState } from 'react';

export default function Home() {

  return (
    <main className={styles.main}>
      {/* Navbar */}
      <nav className="glass-navbar">
        <div className="nav-brand">
          <img src="/logo.png" alt="Logo" className="nav-logo" />
          <span className="nav-title">Judic-IA</span>
        </div>
        <div className="nav-links">
          <Link href="#features" className="link-item">Servicios</Link>
          <Link href="#pricing" className="link-item">Precios</Link>
          <Link href="/dashboard" className="btn-login">Login Abogado</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="badge-new">✨ Nueva Versión 2.0</div>
          <h1 className="hero-title">
            Tu Estudio Jurídico, <br />
            <span className="gradient-text">Potenciado por IA.</span>
          </h1>
          <p className="hero-subtitle">
            Automatiza la atención de consultas, investiga jurisprudencia en segundos y gestiona tus expedientes en una sola plataforma segura.
            <br />Especializado en Derecho Laboral Argentino.
          </p>
          <div className="hero-actions">
            <Link href="/demo" className="btn-primary glow">
              Probar Demo Cliente ↘️
            </Link>
            <Link href="#pricing" className="btn-secondary">
              Ver Planes y Precios
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
        </div>
      </section>

      {/* Services Grid */}
      <section id="features" className="section-container">
        <h2 className="section-title">Todo lo que necesitas para litigar mejor</h2>
        <div className="services-grid">
          <div className="service-card glass-card">
            <div className="icon-box">🤖</div>
            <h3>Asistente Virtual 24/7</h3>
            <p>Tu propio chatbot en tu web. Responde consultas básicas, filtra casos viables y agenda citas automáticamente mientras duermes.</p>
          </div>
          <div className="service-card glass-card">
            <div className="icon-box">⚖️</div>
            <h3>Investigación Legal</h3>
            <p>Buscador jurídico con IA. Encuentra fallos, leyes y doctrina relevante al instante. Genera resúmenes y estrategias de caso.</p>
          </div>
          <div className="service-card glass-card">
            <div className="icon-box">📂</div>
            <h3>Gestión de Expedientes</h3>
            <p>Un CRM legal diseñado para abogados. Organiza clientes, documentos y estados procesales en un tablero visual tipo Kanban.</p>
          </div>
          <div className="service-card glass-card">
            <div className="icon-box">📅</div>
            <h3>Agenda Inteligente</h3>
            <p>Nunca pierdas un plazo. Tu agenda te notifica vencimientos y audiencias importantes. Sincronizada con tus casos.</p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="section-container">
        <h2 className="section-title">Automatiza tu estudio en 3 pasos</h2>
        <div className="steps-container">
          <div className="step-item">
            <div className="step-number">1</div>
            <h3>Regístrate</h3>
            <p>Crea tu cuenta profesional y configura tu perfil.</p>
          </div>
          <div className="connector"></div>
          <div className="step-item">
            <div className="step-number">2</div>
            <h3>Personaliza</h3>
            <p>Entrena a tu IA con tus preferencias y horarios.</p>
          </div>
          <div className="connector"></div>
          <div className="step-item">
            <div className="step-number">3</div>
            <h3>Automatiza</h3>
            <p>Instala el widget y deja que trabaje por ti.</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="section-container">
        <h2 className="section-title">Planes flexibles</h2>
        <div className="pricing-grid">
          <div className="pricing-card glass-card">
            <h3>Starter</h3>
            <div className="price">Gratis <small>/ 14 días</small></div>
            <ul>
              <li>✓ Asistente IA Básico</li>
              <li>✓ Hasta 5 consultas/día</li>
              <li>✓ Acceso a Investigación</li>
            </ul>
            <Link href="/login" className="btn-outline">Comenzar Prueba</Link>
          </div>
          <div className="pricing-card glass-card featured">
            <div className="featured-badge">RECOMENDADO</div>
            <h3>Profesional</h3>
            <div className="price">$15.000 <small>/ mes</small></div>
            <ul>
              <li>✓ <strong>Asistente IA Ilimitado</strong></li>
              <li>✓ <strong>Gestión de Clientes Full</strong></li>
              <li>✓ Agenda y Vencimientos</li>
              <li>✓ Soporte Prioritario</li>
            </ul>
            <Link href="/login" className="btn-primary">Suscribirse Ahora</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer glass-panel">
        <div className="footer-content">
          <div className="footer-brand">Judic-IA</div>
          <div className="footer-links">
            <span>© 2024 Judic-IA LegalTech</span>
            <Link href="#">Términos</Link>
            <Link href="#">Privacidad</Link>
            <Link href="/dashboard">Acceso Clientes</Link>
          </div>
        </div>
      </footer>

      {/* Styles */}
      <style jsx>{`
        /* GLOBAL LAYOUT */
        .glass-navbar {
            position: fixed; top: 1.5rem; left: 50%; transform: translateX(-50%);
            width: 90%; max-width: 1100px; display: flex; justifyContent: space-between;
            align-items: center; padding: 0.8rem 2rem; z-index: 100; borderRadius: 99px;
            background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1);
        }
        .nav-brand { display: flex; align-items: center; gap: 0.8rem; }
        .nav-logo { width: 35px; }
        .nav-title { font-weight: 800; font-size: 1.4rem; color: #fbbf24; letter-spacing: -0.02em; }
        .nav-links { display: flex; gap: 2rem; align-items: center; font-size: 0.95rem; }
        .link-item { color: #cbd5e1; text-decoration: none; transition: 0.2s; }
        .link-item:hover { color: white; }
        .btn-login { color: #fbbf24; font-weight: 600; text-decoration: none; }

        /* HERO */
        .hero-section {
            min-height: 90vh; display: flex; align-items: center; justify-content: center;
            text-align: center; padding-top: 6rem; position: relative; overflow: hidden;
        }
        .hero-content { z-index: 2; max-width: 800px; padding: 0 1rem; }
        .badge-new {
            display: inline-block; background: rgba(251, 191, 36, 0.1); color: #fbbf24;
            padding: 0.4rem 1rem; border-radius: 99px; font-size: 0.85rem; font-weight: 600;
            border: 1px solid rgba(251, 191, 36, 0.3); margin-bottom: 1.5rem;
        }
        .hero-title { font-size: 4rem; font-weight: 800; line-height: 1.1; margin-bottom: 1.5rem; color: white; }
        .gradient-text {
            background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            text-shadow: 0 0 30px rgba(251, 191, 36, 0.3);
        }
        .hero-subtitle { font-size: 1.25rem; color: #94a3b8; margin-bottom: 2.5rem; line-height: 1.6; }
        .hero-actions { display: flex; gap: 1rem; justify-content: center; }
        .btn-primary {
            background: #fbbf24; color: #0f172a; padding: 1rem 2rem; border-radius: 12px;
            font-weight: 700; text-decoration: none; border: none; transition: all 0.2s;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(251, 191, 36, 0.2); }
        .btn-secondary {
            background: rgba(255,255,255,0.05); color: white; padding: 1rem 2rem; border-radius: 12px;
            font-weight: 600; text-decoration: none; border: 1px solid rgba(255,255,255,0.1); transition: all 0.2s;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }
        .btn-outline {
             color: #fbbf24; padding: 0.8rem 1.5rem; border-radius: 8px; border: 1px solid #fbbf24;
             font-weight: 600; text-decoration: none; display: inline-block; width: 100%; text-align: center;
        }
        .btn-outline:hover { background: rgba(251, 191, 36, 0.1); }

        /* SECTIONS */
        .section-container { max-width: 1100px; margin: 0 auto; padding: 6rem 2rem; text-align: center; }
        .section-title { font-size: 2.5rem; font-weight: 700; color: white; margin-bottom: 3rem; }

        /* GRIDS */
        .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 2rem; }
        .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 400px)); gap: 3rem; justify-content: center; }

        .glass-card {
            background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.05);
            padding: 2.5rem; border-radius: 20px; text-align: left; transition: 0.3s;
            backdrop-filter: blur(10px);
        }
        .glass-card:hover { transform: translateY(-5px); border-color: rgba(251, 191, 36, 0.3); background: rgba(30, 41, 59, 0.6); }

        .service-card h3 { color: white; margin: 1rem 0; font-size: 1.3rem; }
        .service-card p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
        .icon-box { font-size: 2.5rem; margin-bottom: 0.5rem; }

        .pricing-card { position: relative; }
        .pricing-card.featured { border: 1px solid #fbbf24; background: rgba(251, 191, 36, 0.05); }
        .featured-badge {
            position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
            background: #fbbf24; color: #0f172a; font-size: 0.75rem; font-weight: 800;
            padding: 0.3rem 0.8rem; border-radius: 99px;
        }
        .pricing-card h3 { color: white; font-size: 1.5rem; margin-bottom: 0.5rem; }
        .pricing-card .price { font-size: 2.5rem; font-weight: 800; color: white; margin-bottom: 2rem; }
        .pricing-card .price small { font-size: 1rem; color: #94a3b8; font-weight: 400; }
        .pricing-card ul { list-style: none; padding: 0; margin-bottom: 2rem; text-align: left; }
        .pricing-card li { color: #cbd5e1; margin-bottom: 0.8rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); }

        /* STEPS */
        .steps-container { display: flex; align-items: flex-start; justify-content: center; gap: 2rem; flex-wrap: wrap; }
        .step-item { flex: 1; max-width: 250px; text-align: center; }
        .step-number {
            width: 50px; height: 50px; background: rgba(251, 191, 36, 0.2); color: #fbbf24;
            font-size: 1.5rem; font-weight: 800; border-radius: 50%; display: flex;
            align-items: center; justify-content: center; margin: 0 auto 1.5rem;
            border: 2px solid #fbbf24;
        }
        .connector { width: 50px; height: 2px; background: rgba(255,255,255,0.1); margin-top: 25px; display: none; }
        @media(min-width: 768px) { .connector { display: block; } }

        .step-item h3 { color: white; margin-bottom: 0.8rem; }
        .step-item p { color: #94a3b8; font-size: 0.95rem; }

        /* FOOTER */
        .footer { padding: 3rem 0; margin-top: 4rem; border-top: 1px solid rgba(255,255,255,0.05); }
        .footer-content {
            max-width: 1100px; margin: 0 auto; padding: 0 2rem; display: flex;
            justify-content: space-between; align-items: center;
        }
        .footer-brand { font-weight: 800; color: white; font-size: 1.2rem; }
        .footer-links { display: flex; gap: 2rem; color: #64748b; font-size: 0.9rem; }
        .footer-links a { color: #94a3b8; text-decoration: none; }
        .footer-links a:hover { color: #fbbf24; }

        /* BLOBS */
        .hero-visual { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; overflow: hidden; }
        .orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.4; }
        .orb-1 { width: 400px; height: 400px; background: #fbbf24; top: -100px; right: -100px; animation: float 10s infinite alternate; }
        .orb-2 { width: 500px; height: 500px; background: #009ee3; bottom: -150px; left: -150px; opacity: 0.2; animation: float 15s infinite reverse; }
        
        @keyframes float { from { transform: translate(0,0); } to { transform: translate(30px, 30px); } }

        @media(max-width: 768px) {
            .hero-title { font-size: 2.5rem; }
            .nav-links { display: none; } /* Mobile menu todo */
            .steps-container { flex-direction: column; align-items: center; }
            .connector { display: none; }
        }
      `}</style>

      {/* Sales Bot - Selling the SaaS */}
      <ChatWidget
        mode="sales"
        initialMessage="¡Hola! 👋 Soy el asistente de ventas de Judic-IA. ¿Tienes preguntas sobre cómo automatizar tu estudio?"
      />
    </main>
  );
}
