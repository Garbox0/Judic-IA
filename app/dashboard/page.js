"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function DashboardHome() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const tools = [
    {
      id: 'research',
      title: 'Investigación Legal',
      desc: 'Consulta normativa, códigos y fallos con IA.',
      icon: '🔍',
      link: '/dashboard/research',
      color: 'var(--primary)'
    },
    {
      id: 'clients',
      title: 'Mis Clientes',
      desc: 'Administra tus expedientes y contactos.',
      icon: '👥',
      link: '/dashboard/clients',
      color: '#6366f1'
    },
    {
      id: 'agenda',
      title: 'Agenda Judicial',
      desc: 'Controla tus plazos y audiencias.',
      icon: '📅',
      link: '/dashboard/agenda',
      color: '#10b981'
    },
    {
      id: 'settings',
      title: 'Configuración',
      desc: 'Ajusta tu perfil y firma digital.',
      icon: '⚙️',
      link: '/dashboard/settings',
      color: '#94a3b8'
    }
  ];

  return (
    <div className="home-container">
      <header className="home-header">
        <h1 className="welcome-text">
          Bienvenido, <span className="gold-gradient">
            Dr. {user?.user_metadata?.first_name || 'Colega'}
          </span>
        </h1>
        <p className="subtitle">¿Qué herramienta necesitas hoy para tu estudio?</p>
      </header>

      <div className="hub-grid">
        {tools.map((tool) => (
          <Link href={tool.link} key={tool.id} className="hub-card-link">
            <div className="hub-card glass-card">
              <div className="card-icon" style={{ background: `${tool.color}15`, border: `1px solid ${tool.color}30` }}>
                {tool.icon}
              </div>
              <div className="card-body">
                <h3>{tool.title}</h3>
                <p>{tool.desc}</p>
              </div>
              <div className="card-arrow">→</div>
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
        }
        .home-header {
          margin-bottom: 3.5rem;
          text-align: center;
          max-width: 800px;
        }
        .welcome-text {
          font-size: 3rem;
          font-weight: 800;
          color: white;
          letter-spacing: -0.03em;
          margin-bottom: 0.5rem;
        }
        .gold-gradient {
          background: linear-gradient(135deg, #fff 30%, var(--primary) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subtitle {
          font-size: 1.1rem;
          color: var(--muted);
          opacity: 0.7;
          font-weight: 400;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .hub-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2rem;
          width: 100%;
          max-width: 1000px;
        }
        .hub-card-link {
          text-decoration: none;
          display: block;
        }
        .hub-card {
          padding: 2rem 2.5rem;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.05);
          position: relative;
          background: rgba(15, 23, 42, 0.4);
          border-radius: 24px;
          overflow: hidden;
        }
        .hub-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: radial-gradient(circle at 0% 0%, rgba(197, 160, 33, 0.08), transparent 70%);
          opacity: 0;
          transition: opacity 0.5s;
        }
        .hub-card:hover {
          transform: translateY(-5px) scale(1.01);
          border-color: rgba(197, 160, 33, 0.4);
          background: rgba(15, 23, 42, 0.6);
          box-shadow: 0 15px 30px rgba(0,0,0,0.3), 0 0 20px rgba(197, 160, 33, 0.1);
        }
        .hub-card:hover::after { opacity: 1; }

        .card-icon {
          width: 60px;
          height: 60px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          flex-shrink: 0;
          transition: all 0.4s ease;
          box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }
        .hub-card:hover .card-icon { 
          transform: scale(1.1) rotate(-5deg);
        }

        .card-body h3 {
          font-size: 1.3rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.4rem;
          letter-spacing: -0.01em;
        }
        .card-body p {
          color: var(--muted);
          font-size: 0.95rem;
          line-height: 1.5;
          margin: 0;
          opacity: 0.8;
        }
        .card-arrow {
          margin-left: auto;
          font-size: 1.5rem;
          color: var(--primary);
          opacity: 0.2;
          transform: translateX(-10px);
          transition: all 0.4s;
        }
        .hub-card:hover .card-arrow {
          opacity: 1;
          transform: translateX(0);
        }

        @media (max-width: 900px) {
          .hub-grid { grid-template-columns: 1fr; }
          .welcome-text { font-size: 2.2rem; }
          .hub-card { padding: 1.5rem; }
        }
      `}</style>
    </div>
  );
}
