"use client";
import React from 'react';
import Link from 'next/link';

export default function DemoDashboardHome() {
    // Hardcoded Demo Stats
    const stats = { clients: 12, deadlines: 3 };
    const user = { user_metadata: { first_name: 'Martínez' } };

    const tools = [
        {
            id: 'research',
            title: 'Investigación Legal',
            desc: 'Consulta normativa, códigos y fallos con IA. (Funcional)',
            icon: '🔍',
            link: '/demo/dashboard/research', // Redirects to Demo Research
            color: 'var(--primary)',
            active: true
        },
        {
            id: 'clients',
            title: 'Mis Clientes',
            desc: 'Administra tus expedientes y contactos.',
            icon: '👥',
            link: '#',
            color: '#6366f1',
            active: false
        },
        {
            id: 'agenda',
            title: 'Agenda Judicial',
            desc: 'Controla tus plazos y audiencias.',
            icon: '📅',
            link: '#',
            color: '#10b981',
            active: false
        },
        {
            id: 'settings',
            title: 'Configuración',
            desc: 'Ajusta tu perfil y firma digital.',
            icon: '⚙️',
            link: '#',
            color: '#94a3b8',
            active: false
        }
    ];

    const handleRestrictedClick = (e, tool) => {
        if (!tool.active) {
            e.preventDefault();
            alert("🔒 Esta función no está disponible en la Demo pública.\n\nContáctanos para una prueba completa o crea tu cuenta.");
        }
    };

    return (
        <div className="home-container">
            <nav className="demo-nav-bar">
                <div className="brand">Judic-IA <span className="tag">DEMO</span></div>
                <Link href="/demo" className="back-link">← Volver al Chat</Link>
            </nav>

            <header className="home-header">
                <h1 className="welcome-text">
                    Bienvenido, Dr. {user?.user_metadata?.first_name}
                </h1>
                <div className="daily-brief">
                    <span className="brief-item">📅 <b>{stats.deadlines}</b> Vencimientos hoy</span>
                    <span className="brief-divider">·</span>
                    <span className="brief-item">📩 <b>{stats.clients}</b> Clientes activos</span>
                </div>
            </header>

            <div className="hub-grid">
                {tools.map((tool, index) => (
                    <Link
                        href={tool.link}
                        key={tool.id}
                        className={`hub-card-link ${!tool.active ? 'disabled-link' : ''}`}
                        onClick={(e) => handleRestrictedClick(e, tool)}
                    >
                        <div className={`hub-card glass-card ${index === 0 ? 'card-primary' : 'card-secondary'} ${!tool.active ? 'card-locked' : ''}`}>
                            <div className="card-icon" style={{
                                color: index === 0 ? '#020617' : tool.color,
                                background: index === 0 ? 'var(--primary)' : `${tool.color}15`,
                                border: index === 0 ? 'none' : `1px solid ${tool.color}30`
                            }}>
                                {tool.icon}
                            </div>
                            <div className="card-body">
                                <h3>
                                    {tool.title}
                                    {!tool.active && <span className="lock-icon">🔒</span>}
                                </h3>
                                <p>{tool.desc}</p>
                            </div>
                            {tool.active && <div className="card-arrow">→</div>}
                        </div>
                    </Link>
                ))}
            </div>

            <style jsx>{`
        .home-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
          background: #020617; /* Match Demo BG */
          font-family: var(--font-outfit);
        }
        .demo-nav-bar {
            position: absolute;
            top: 2rem;
            left: 2rem;
            right: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .brand {
            font-family: 'Playfair Display', serif;
            font-size: 1.5rem;
            color: #f8fafc;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .tag {
            font-family: 'Inter', sans-serif;
            font-size: 0.75rem;
            background: rgba(251, 191, 36, 0.1);
            color: #fbbf24;
            padding: 0.2rem 0.6rem;
            border-radius: 20px;
            border: 1px solid rgba(251, 191, 36, 0.2);
        }
        .back-link {
            color: #94a3b8;
            text-decoration: none;
            font-size: 0.9rem;
            transition: 0.2s;
        }
        .back-link:hover { color: white; }

        .home-header {
          margin-bottom: 3.5rem;
          text-align: center;
          max-width: 800px;
        }
        .welcome-text {
          font-size: 2.4rem;
          font-weight: 800;
          color: white;
          letter-spacing: -0.02em;
          margin-bottom: 1rem;
        }
        .daily-brief {
            display: inline-flex;
            align-items: center;
            gap: 1rem;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 0.5rem 1.2rem;
            border-radius: 99px;
            color: #94a3b8;
            font-size: 0.9rem;
            backdrop-filter: blur(5px);
        }
        .brief-item b { color: var(--primary); font-weight: 700; }
        .brief-divider { color: rgba(255,255,255,0.1); }

        .hub-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          width: 100%;
          max-width: 900px;
        }
        .hub-card-link {
          text-decoration: none;
          display: block;
        }
        .disabled-link { cursor: not-allowed; }

        .hub-card {
          padding: 2rem;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.05);
          position: relative;
          background: rgba(15, 23, 42, 0.4);
          border-radius: 20px;
          overflow: hidden;
        }
        
        .card-locked {
            opacity: 0.6;
            filter: grayscale(0.4);
        }

        /* Primary Card (Research) */
        .card-primary {
            border: 1px solid rgba(212, 178, 76, 0.3);
            background: linear-gradient(135deg, rgba(212, 178, 76, 0.05), rgba(2, 6, 23, 0.6));
            box-shadow: 0 0 30px rgba(212, 178, 76, 0.05);
        }
        .card-primary .card-body h3 { color: var(--primary); }

        .hub-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 15px 40px rgba(0,0,0,0.4);
        }
        .card-locked:hover {
             transform: none;
             box-shadow: none;
             border-color: rgba(255, 255, 255, 0.1);
        }

        .card-primary:hover {
            box-shadow: 0 15px 40px rgba(212, 178, 76, 0.1);
            border-color: var(--primary);
        }

        .card-icon {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
          flex-shrink: 0;
          transition: all 0.25s ease;
        }
        .hub-card:hover .card-icon { 
          transform: scale(1.1) rotate(-3deg);
        }
        .card-locked:hover .card-icon { transform: none; }

        .card-body h3 {
          font-size: 1.2rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.3rem;
          letter-spacing: -0.01em;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .lock-icon { font-size: 0.9rem; opacity: 0.5; }

        .card-body p {
          color: var(--muted);
          font-size: 0.9rem;
          line-height: 1.4;
          margin: 0;
        }
        .card-arrow {
          margin-left: auto;
          font-size: 1.2rem;
          color: var(--primary);
          opacity: 0.4;
          transform: translateX(-5px);
          transition: all 0.25s;
        }
        .hub-card:hover .card-arrow {
          opacity: 1;
          transform: translateX(0);
        }

        @media (max-width: 900px) {
          .hub-grid { grid-template-columns: 1fr; }
          .welcome-text { font-size: 2rem; }
          .hub-card { padding: 1.5rem; }
        }
      `}</style>
        </div>
    );
}
