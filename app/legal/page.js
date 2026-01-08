"use client";
import React from 'react';
import Link from 'next/link';

export default function LegalPage() {
    return (
        <main>
            <Link href="/" className="back">← Volver al inicio</Link>

            <header>
                <h1>Información Legal y Seguridad</h1>
                <div className="subtitle">
                    Transparencia, confidencialidad y protección de la información profesional.
                </div>
            </header>

            {/* TÉRMINOS */}
            <section>
                <h2>1. Términos de Servicio</h2>
                <p>
                    Bienvenido a <strong>Judic-IA</strong>. Al utilizar nuestra plataforma,
                    aceptás los presentes términos y condiciones.
                </p>
                <ul>
                    <li>Judic-IA es una herramienta de asistencia mediante inteligencia artificial.</li>
                    <li>No reemplaza el criterio ni el juicio profesional del abogado.</li>
                    <li>El acceso es personal, profesional e intransferible.</li>
                    <li>Nos reservamos el derecho de suspender cuentas ante usos indebidos.</li>
                    <li>Los pagos se procesan de forma segura a través de plataformas externas.</li>
                </ul>
            </section>

            {/* PRIVACIDAD */}
            <section>
                <h2>2. Política de Privacidad</h2>
                <p>
                    La privacidad de tu información y la de tus clientes es una prioridad.
                </p>
                <ul>
                    <li>No compartimos datos personales con terceros sin consentimiento.</li>
                    <li>Los datos se utilizan únicamente para la prestación del servicio.</li>
                    <li>Podés solicitar la eliminación de tus datos en cualquier momento.</li>
                    <li>No utilizamos conversaciones para entrenar modelos sin anonimización.</li>
                </ul>
            </section>

            {/* SEGURIDAD */}
            <section>
                <h2>3. Seguridad de los Datos</h2>
                <p>
                    Implementamos estándares de seguridad alineados con las mejores prácticas
                    de la industria tecnológica.
                </p>

                <div className="badges">
                    <div className="badge">🔒 Encriptación SSL</div>
                    <div className="badge">🛡️ Datos anonimizados</div>
                    <div className="badge">💾 Backups automáticos</div>
                    <div className="badge">☁️ Infraestructura segura</div>
                </div>

                <p>
                    Las consultas realizadas dentro de Judic-IA son confidenciales y se procesan
                    en entornos protegidos, respetando el secreto profesional.
                </p>
            </section>

            <footer>
                © {new Date().getFullYear()} Judic-IA · Todos los derechos reservados
            </footer>

            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');
      `}</style>

            <style jsx>{`
        :root{
          --bg:#020617;
          --card:#0f172a;
          --gold:#fbbf24;
          --muted:#94a3b8;
          --text:#e2e8f0;
        }

        main {
          max-width: 900px;
          margin: 0 auto;
          padding: 4rem 2rem 6rem;
          color: #e2e8f0;
          font-family: 'Inter', sans-serif;
        }

        .back {
          display: inline-block;
          margin-bottom: 2.5rem;
          color: #94a3b8;
          text-decoration: none;
          font-size: .9rem;
          transition: color 0.2s;
        }

        .back:hover { color: #fbbf24; }

        header {
          margin-bottom: 3rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }

        h1 {
          font-family: 'Playfair Display', serif;
          font-size: 2.6rem;
          color: #fbbf24;
          margin: 0 0 .5rem 0;
        }

        .subtitle {
          color: #94a3b8;
          font-size: 1.05rem;
        }

        section {
          margin-top: 2.5rem;
          background: rgba(15,23,42,.55);
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 22px;
          padding: 2.5rem;
          box-shadow: 0 30px 60px rgba(0,0,0,.4);
        }

        section h2 {
          font-family: 'Playfair Display', serif;
          font-size: 1.6rem;
          margin: 0 0 1.2rem 0;
          color: #f1f5f9;
        }

        section p {
          line-height: 1.75;
          color: #cbd5e1;
        }

        ul {
          padding-left: 1.4rem;
          margin-top: 1rem;
        }

        li {
          margin-bottom: .6rem;
          color: #cbd5e1;
        }

        .badges {
          display: flex;
          flex-wrap: wrap;
          gap: .8rem;
          margin: 1.5rem 0;
        }

        .badge {
          display: flex;
          align-items: center;
          gap: .5rem;
          padding: .55rem 1rem;
          border-radius: 999px;
          background: rgba(251,191,36,.1);
          border: 1px solid rgba(251,191,36,.25);
          color: #fbbf24;
          font-weight: 600;
          font-size: .85rem;
        }

        footer {
          margin-top: 4rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255,255,255,.06);
          text-align: center;
          color: #64748b;
          font-size: .9rem;
        }
      `}</style>
        </main>
    );
}
