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
    <div className="dashboard-container">

      <div className="breadcrumb">
        <span className="breadcrumb-current">Gabinete de {user?.user_metadata?.first_name || 'Legal'}</span>
      </div>

      <header className="dashboard-header">
        <h2>Bienvenido, Dr. {user?.user_metadata?.first_name}</h2>
        <div className="header-stats">
          <span>📅 <b>{stats.deadlines}</b> vencimientos hoy</span>
          <span>👥 <b>{stats.clients}</b> clientes activos</span>
        </div>
      </header>

      <section className="dashboard-grid">
        {tools.map((tool, index) => (
          <Link href={tool.link} key={tool.id} className="dashboard-card-link">
            <div className={`dashboard-card ${index === 0 ? 'primary' : ''}`}>
              <div className="card-icon">
                {tool.icon}
              </div>
              <div>
                <h3>{tool.title}</h3>
                <p>{tool.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

    </div>
  );
}
