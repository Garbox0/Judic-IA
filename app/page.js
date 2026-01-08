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
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap');
      `}</style>

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

      {/* Styles */}
      <style jsx>{`
        /* COLORS & FONTS */
        :global(body) {
          background-color: #020617;
          font-family: 'Inter', sans-serif;
        }

        .text-glow { text-shadow: 0 0 15px rgba(251, 191, 36, 0.4); }
        .justice-emoji { font-style: normal; }
        .italic-serif { font-family: 'Playfair Display', serif; font-style: italic; font-weight: 700; }

        /* NAVBAR */
        .glass-navbar {
            position: fixed; top: 0; left: 0; width: 100%; z-index: 1000;
            background: rgba(2, 6, 23, 0.7); backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            padding: 1rem 0;
        }
        .nav-container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 0 2rem; }
        .nav-brand { display: flex; align-items: center; gap: 0.75rem; }
        .nav-logo { width: 38px; filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.3)); }
        .nav-title { font-size: 1.4rem; font-weight: 800; color: #fbbf24; letter-spacing: -0.01em; }
        
        .nav-links { display: flex; gap: 2.5rem; align-items: center; }
        .link-item { color: #94a3b8; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: 0.3s; }
        .link-item:hover { color: #fbbf24; }
        
        .btn-login-premium { 
            background: rgba(251, 191, 36, 0.1); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3);
            padding: 0.6rem 1.4rem; border-radius: 10px; font-weight: 700; text-decoration: none; transition: 0.3s;
        }
        .btn-login-premium:hover { background: #fbbf24; color: #020617; transform: translateY(-1px); box-shadow: 0 8px 20px rgba(251, 191, 36, 0.2); }

        /* HERO */
        .hero-section {
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
            padding-top: 5rem; position: relative; overflow: hidden;
            background: radial-gradient(circle at 50% 10%, #0f172a, #020617);
        }
        .hero-content { z-index: 10; max-width: 900px; padding: 0 2rem; }
        .badge-new {
            display: inline-block; background: linear-gradient(90deg, rgba(251, 191, 36, 0.1), rgba(217, 119, 6, 0.1));
            color: #fbbf24; padding: 0.5rem 1.25rem; border-radius: 99px; font-size: 0.85rem; font-weight: 600;
            border: 1px solid rgba(251, 191, 36, 0.2); margin-bottom: 2rem;
            backdrop-filter: blur(5px);
        }
        .hero-title { font-family: 'Playfair Display', serif; font-size: clamp(3rem, 6vw, 5rem); font-weight: 900; line-height: 0.95; margin-bottom: 1.5rem; color: #f8fafc; }
        .gradient-text {
            background: linear-gradient(135deg, #fbbf24 0%, #fcd34d 50%, #d97706 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .hero-subtitle { font-size: 1.4rem; color: #94a3b8; margin-bottom: 3rem; line-height: 1.6; max-width: 700px; margin-left: auto; margin-right: auto; font-weight: 300; }
        .hero-actions { display: flex; gap: 1.5rem; justify-content: center; }
        
        .btn-primary-glow {
            background: linear-gradient(135deg, #fbbf24, #d97706); color: #020617; padding: 1.1rem 2.5rem; border-radius: 14px;
            font-weight: 800; text-decoration: none; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 10px 25px rgba(217, 119, 6, 0.3); font-size: 1.1rem;
        }
        .btn-primary-glow:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 20px 40px rgba(217, 119, 6, 0.4); }
        
        .btn-secondary-outline {
            background: rgba(255, 255, 255, 0.03); color: #f8fafc; padding: 1.1rem 2.5rem; border-radius: 14px;
            font-weight: 700; text-decoration: none; border: 1px solid rgba(255, 255, 255, 0.1); 
            backdrop-filter: blur(5px); transition: 0.3s; font-size: 1.1rem;
        }
        .btn-secondary-outline:hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.2); }

        /* ORBS */
        .hero-visual { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; }
        .orb { position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.3; }
        .orb-1 { width: 500px; height: 500px; background: #fbbf24; top: -150px; right: -150px; animation: float 12s infinite alternate; }
        .orb-2 { width: 600px; height: 600px; background: #3b82f6; bottom: -200px; left: -200px; opacity: 0.15; animation: float 18s infinite reverse; }
        .orb-3 { width: 300px; height: 300px; background: #f59e0b; top: 40%; left: 10%; opacity: 0.1; animation: pulse 8s infinite alternate; }
        
        @keyframes float { 0% { transform: translate(0, 0); } 100% { transform: translate(50px, 40px); } }
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.1; } 100% { transform: scale(1.2); opacity: 0.2; } }

        /* SECTIONS */
        .section-container { max-width: 1200px; margin: 0 auto; padding: 8rem 2rem; }
        .section-header { text-align: center; margin-bottom: 5rem; }
        .section-title { font-family: 'Playfair Display', serif; font-size: 3.5rem; font-weight: 800; color: #f8fafc; margin-bottom: 1rem; }
        .section-subtitle { font-size: 1.2rem; color: #64748b; font-weight: 400; max-width: 600px; margin: 0 auto; }

        /* SERVICES GRID */
        .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 2.5rem; }
        .service-card-premium {
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.3), rgba(15, 23, 42, 0.3));
            border: 1px solid rgba(255, 255, 255, 0.05); padding: 3rem 2rem; border-radius: 24px;
            backdrop-filter: blur(10px); transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
            text-align: center;
        }
        .service-card-premium:hover {
            transform: translateY(-8px); border-color: rgba(251, 191, 36, 0.3);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4); background: rgba(30, 41, 59, 0.5);
        }
        .icon-box-premium {
            font-size: 3rem; margin-bottom: 1.5rem; display: inline-flex;
            width: 80px; height: 80px; background: rgba(251, 191, 36, 0.05);
            align-items: center; justify-content: center; border-radius: 20px;
            border: 1px solid rgba(251, 191, 36, 0.1);
        }
        .service-card-premium h3 { font-size: 1.5rem; color: #f8fafc; margin-bottom: 1rem; font-weight: 700; }
        .service-card-premium p { color: #94a3b8; font-size: 1rem; line-height: 1.6; font-weight: 400; }

        /* PRICING */
        .bg-radial-accent { background: radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.03), transparent); }
        .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 420px)); gap: 3rem; justify-content: center; }
        .pricing-card-premium {
            background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 4rem 3rem; border-radius: 30px; text-align: center; position: relative;
            backdrop-filter: blur(10px); transition: 0.3s;
        }
        .pricing-card-premium.featured {
            border: 2px solid #fbbf24; box-shadow: 0 0 50px rgba(251, 191, 36, 0.1);
            background: rgba(15, 23, 42, 0.8); transform: scale(1.05); z-index: 5;
        }
        .top-badge {
            position: absolute; top: -15px; left: 50%; transform: translateX(-50%);
            background: #fbbf24; color: #020617; font-size: 0.8rem; font-weight: 900;
            padding: 0.5rem 1.5rem; border-radius: 99px; letter-spacing: 0.05em;
        }
        .price-tag { font-size: 3rem; font-weight: 800; color: #f8fafc; margin: 2rem 0; }
        .price-tag.gold { color: #fbbf24; text-shadow: 0 0 20px rgba(251, 191, 36, 0.2); }
        .price-tag small { font-size: 1rem; color: #64748b; font-weight: 400; }
        
        .benefits-list { list-style: none; padding: 0; margin-bottom: 3rem; text-align: left; }
        .benefits-list li { color: #94a3b8; margin-bottom: 1.25rem; font-size: 1rem; padding-left: 1.5rem; position: relative; }
        .benefits-list li::before { content: '✓'; position: absolute; left: 0; color: #fbbf24; font-weight: 800; }
        
        .btn-outline-gold {
            display: block; padding: 1rem; border: 1px solid #fbbf24; color: #fbbf24;
            text-decoration: none; border-radius: 12px; font-weight: 700; transition: 0.3s;
        }
        .btn-outline-gold:hover { background: rgba(251, 191, 36, 0.1); box-shadow: 0 0 20px rgba(251, 191, 36, 0.2); }
        
        .btn-gold-fill {
            display: block; padding: 1.1rem; background: #fbbf24; color: #020617;
            text-decoration: none; border-radius: 12px; font-weight: 800; transition: 0.3s;
            box-shadow: 0 10px 20px rgba(251, 191, 36, 0.3);
        }
        .btn-gold-fill:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(251, 191, 36, 0.4); filter: brightness(1.1); }


        /* FINAL CTA */
        .final-cta-section { padding: 10rem 2rem; position: relative; z-index: 10; }
        .cta-glass-card {
            max-width: 1000px; margin: 0 auto;
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6));
            border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 40px;
            padding: 5rem; text-align: center; position: relative; overflow: hidden;
            backdrop-filter: blur(20px);
        }
        .cta-content { position: relative; z-index: 2; }
        .cta-title { font-family: 'Playfair Display', serif; font-size: 3rem; color: #f8fafc; margin-bottom: 1rem; }
        .cta-text { font-size: 1.2rem; color: #94a3b8; margin-bottom: 2.5rem; max-width: 600px; margin-left: auto; margin-right: auto; }
        .cta-buttons { display: flex; gap: 2rem; justify-content: center; align-items: center; }
        .cta-glow { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 300px; height: 300px; background: #fbbf24; filter: blur(100px); opacity: 0.1; pointer-events: none; }
        .white-text { color: white !important; }

        /* FOOTER V2 */
        .footer-premium-v2 {
            background: #020617; border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 8rem 2rem 4rem;
        }
        .footer-v2-grid { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; gap: 6rem; flex-wrap: wrap; }
        .footer-v2-main { flex: 1; min-width: 300px; }
        .footer-v2-brand { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .footer-v2-logo-img { width: 40px; }
        .footer-v2-logo-text { font-family: 'Playfair Display', serif; color: #fbbf24; font-size: 1.8rem; font-weight: 900; }
        .footer-v2-desc { color: #64748b; line-height: 1.7; font-size: 1rem; max-width: 400px; margin-bottom: 2rem; }
        .footer-v2-socials { display: flex; gap: 1.5rem; }
        .social-icon { color: #475569; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: 0.3s; }
        .social-icon:hover { color: #fbbf24; }

        .footer-v2-links { display: flex; gap: 5rem; flex-wrap: wrap; }
        .v2-nav-col h4 { color: #f8fafc; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2rem; font-weight: 900; }
        .v2-nav-col { display: flex; flex-direction: column; gap: 1rem; }
        .v2-nav-col a { color: #64748b; text-decoration: none; transition: 0.3s; font-size: 0.95rem; }
        .v2-nav-col a:hover { color: #fbbf24; padding-left: 5px; }

        .footer-v2-bottom { border-top: 1px solid rgba(255, 255, 255, 0.03); margin-top: 6rem; padding-top: 3rem; }
        .footer-v2-bottom-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; color: #334155; font-size: 0.85rem; }
        .footer-status-indicator { display: flex; align-items: center; gap: 0.5rem; color: #475569; }
        .status-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 10px #10b981; }
        .slide-up { animation: slideUp 0.8s ease forwards; opacity: 0; }
        .slide-up-delayed { animation: slideUp 0.8s ease 0.2s forwards; opacity: 0; }
        .slide-up-extra-delayed { animation: slideUp 0.8s ease 0.4s forwards; opacity: 0; }
        .fade-in { animation: fadeIn 1s ease forwards; }

        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        @media(max-width: 850px) {
            .hero-title { font-size: 3.5rem; }
            .pricing-card-premium.featured { transform: scale(1); }
            .hero-actions { flex-direction: column; }
            .nav-links { display: none; }
        }
      `}</style>

      {/* Sales Bot - Selling the SaaS */}
      <SafeChatWidget
        mode="sales"
        initialMessage="¡Hola! 👋 Soy el asistente de ventas de Judic-IA. ¿Tienes preguntas sobre cómo automatizar tu estudio?"
      />
    </main>
  );
}
