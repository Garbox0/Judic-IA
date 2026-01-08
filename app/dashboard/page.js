"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function DashboardHome() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ clients: 0, deadlines: 0 });

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Fetch Real Client Count (Inquiries)
        const { count, error } = await supabase
          .from('inquiries')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'link_generated')
          .eq('assigned_lawyer_id', user.id); // Ensure we only count user's clients

        if (!error) {
          setStats(prev => ({ ...prev, clients: count || 0 }));
        }
      }
    };
    getData();
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
          <Link href={tool.link} key={tool.id} className="hub-card-link">
            <div className={`hub-card glass-card ${index === 0 ? 'card-primary' : 'card-secondary'}`}>
              <div className="card-icon" style={{
                color: index === 0 ? '#020617' : tool.color,
                background: index === 0 ? 'var(--primary)' : `${tool.color}15`,
                border: index === 0 ? 'none' : `1px solid ${tool.color}30`
              }}>
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

        .card-body h3 {
          font-size: 1.2rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.3rem;
          letter-spacing: -0.01em;
        }
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
