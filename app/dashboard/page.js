"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

import {
  Search,
  Users,
  FolderOpen,
  Calendar,
  BookOpen,
  Settings
} from 'lucide-react';

export default function DashboardHome() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ clients: 0, deadlines: 0 });

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Fetch Real Client Count (Inquiries)
        const { count: inquiryCount, error: inquiryError } = await supabase
          .from('inquiries')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'link_generated')
          .eq('assigned_lawyer_id', user.id);

        if (!inquiryError) {
          setStats(prev => ({ ...prev, clients: inquiryCount || 0 }));
        }

        // Fetch Today's Deadlines Count
        const todayStr = new Date().toISOString().split('T')[0];
        const { count: deadlineCount, error: deadlineError } = await supabase
          .from('deadlines')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .gte('due_date', `${todayStr}T00:00:00Z`)
          .lte('due_date', `${todayStr}T23:59:59Z`);

        if (!deadlineError) {
          setStats(prev => ({ ...prev, deadlines: deadlineCount || 0 }));
        }
      }
    };
    getData();
  }, []);

  const tools = [
    {
      id: 'research',
      title: 'Jurisprudencia',
      desc: 'Consulta normativa, códigos y fallos con IA.',
      icon: <Search size={24} />,
      link: '/dashboard/research',
      color: 'var(--gold)'
    },
    {
      id: 'clients',
      title: 'Clientes',
      desc: 'Administra tus consultas y contactos entrantes.',
      icon: <Users size={24} />,
      link: '/dashboard/clients',
      color: '#6366f1'
    },
    {
      id: 'cases',
      title: 'Expedientes',
      desc: 'Gestión centralizada de tus casos oficiales.',
      icon: <FolderOpen size={24} />,
      link: '/dashboard/cases',
      color: '#3b82f6'
    },
    {
      id: 'agenda',
      title: 'Plazos',
      desc: 'Controla tus fechas, plazos y audiencias.',
      icon: <Calendar size={24} />,
      link: '/dashboard/agenda',
      color: '#10b981'
    },
    {
      id: 'library',
      title: 'Biblioteca',
      desc: 'Base de conocimiento y precedentes guardados.',
      icon: <BookOpen size={24} />,
      link: '/dashboard/library',
      color: '#a855f7'
    },
    {
      id: 'settings',
      title: 'Ajustes',
      desc: 'Configuración de perfil, firma y facturación.',
      icon: <Settings size={24} />,
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
        <h2>Hola, {user?.user_metadata?.first_name}</h2>
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
