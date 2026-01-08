"use client";
import React from 'react';
import Link from 'next/link';
import '../globals.css';

export default function LegalPage() {
    return (
        <main className="legal-main">
            <style jsx global>{`
        body { background: #020617; color: #f8fafc; font-family: 'Inter', sans-serif; }
        .legal-main { max-width: 900px; margin: 0 auto; padding: 4rem 2rem; }
        
        .legal-header { text-align: center; margin-bottom: 4rem; padding-bottom: 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .legal-title { font-family: 'Playfair Display', serif; font-size: 3rem; color: #fbbf24; margin-bottom: 1rem; }
        .legal-subtitle { color: #94a3b8; font-size: 1.1rem; }

        .legal-nav { 
            position: sticky; top: 1rem; z-index: 10; 
            background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(12px);
            padding: 1rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);
            display: flex; justify-content: center; gap: 1.5rem; margin-bottom: 4rem;
        }
        .legal-nav a { color: #cbd5e1; text-decoration: none; font-weight: 500; transition: 0.3s; }
        .legal-nav a:hover { color: #fbbf24; }
        
        .legal-section { margin-bottom: 5rem; scroll-margin-top: 120px; }
        .section-title { font-family: 'Playfair Display', serif; font-size: 2rem; color: #f8fafc; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.8rem; }
        .section-icon { font-size: 1.8rem; }
        
        .legal-content { color: #cbd5e1; line-height: 1.8; font-size: 1.05rem; }
        .legal-content h3 { color: #fbbf24; font-size: 1.3rem; margin: 2rem 0 1rem; }
        .legal-content ul { padding-left: 1.5rem; margin-bottom: 1.5rem; }
        .legal-content li { margin-bottom: 0.5rem; }
        .legal-content p { margin-bottom: 1.5rem; }

        .btn-back { display: inline-block; margin-bottom: 2rem; color: #64748b; text-decoration: none; font-weight: 600; transition: 0.3s; }
        .btn-back:hover { color: #fbbf24; }
      `}</style>

            <Link href="/" className="btn-back">← Volver al Inicio</Link>

            <header className="legal-header">
                <h1 className="legal-title">Centro Legal y de Privacidad</h1>
                <p className="legal-subtitle">Transparencia y claridad son los pilares de Judic-IA.</p>
            </header>

            <nav className="legal-nav">
                <Link href="#terms">Términos de Servicio</Link>
                <Link href="#privacy">Política de Privacidad</Link>
                <Link href="#security">Seguridad de Datos</Link>
            </nav>

            <section id="terms" className="legal-section">
                <h2 className="section-title"><span className="section-icon">📜</span> Términos de Servicio</h2>
                <div className="legal-content">
                    <p>Última actualización: Enero 2026</p>
                    <p>Bienvenido a Judic-IA. Al utilizar nuestra plataforma, aceptas cumplir con los siguientes términos. Estos términos rigen el uso de nuestro software de gestión legal basado en IA.</p>

                    <h3>1. Uso Aceptable</h3>
                    <p>Usted se compromete a utilizar Judic-IA únicamente para fines legales y profesionales legítimos. Está prohibido utilizar la plataforma para procesar información ilícita o violar derechos de terceros.</p>

                    <h3>2. Propiedad Intelectual</h3>
                    <p>Todo el software, algoritmos, y diseños de Judic-IA son propiedad exclusiva de nuestra empresa. El usuario retiene la total propiedad de los datos y expedientes cargados en el sistema.</p>

                    <h3>3. Limitación de Responsabilidad</h3>
                    <p>Judic-IA es una herramienta de asistencia. La IA no reemplaza el juicio profesional de un abogado. No nos hacemos responsables por decisiones legales tomadas basándose únicamente en sugerencias de la IA.</p>
                </div>
            </section>

            <section id="privacy" className="legal-section">
                <h2 className="section-title"><span className="section-icon">🔒</span> Política de Privacidad</h2>
                <div className="legal-content">
                    <p>Su privacidad es sagrada para nosotros. Esta política detalla cómo manejamos su información.</p>

                    <h3>1. Recolección de Datos</h3>
                    <p>Recopilamos información necesaria para la prestación del servicio: datos de contacto, información de facturación y los datos de expedientes que usted carga activamente.</p>

                    <h3>2. Uso de la Información</h3>
                    <ul>
                        <li>Provisión y mejora del servicio.</li>
                        <li>Facturación y notificaciones administrativas.</li>
                        <li>No vendemos ni compartimos sus datos con terceros para fines publicitarios.</li>
                    </ul>

                    <h3>3. Cookies</h3>
                    <p>Utilizamos cookies esenciales para mantener su sesión segura y cookies analíticas anónimas para mejorar el rendimiento de la plataforma.</p>
                </div>
            </section>

            <section id="security" className="legal-section">
                <h2 className="section-title"><span className="section-icon">🛡️</span> Seguridad de Datos</h2>
                <div className="legal-content">
                    <p>Implementamos estándares de industria para proteger su información sensible y la de sus clientes.</p>

                    <h3>1. Encriptación</h3>
                    <p>Todos los datos se transmiten mediante TLS 1.3 (HTTPS) y se almacenan encriptados en reposo (AES-256) utilizando infraestructura de Supabase Enterprise.</p>

                    <h3>2. Acceso y Control</h3>
                    <p>Solo usted y su personal autorizado tienen acceso a sus expedientes. Nuestro personal de soporte técnico no tiene acceso a sus datos legales salvo autorización expresa para soporte.</p>
                </div>
            </section>

            <footer style={{ textAlign: 'center', color: '#64748b', marginTop: '4rem', fontSize: '0.9rem' }}>
                <p>© 2026 Judic-IA LegalTech Argentina. Todos los derechos reservados.</p>
            </footer>
        </main>
    );
}
