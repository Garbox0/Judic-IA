"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { demoStats, demoProfile } from '../lib/demoData'; // [NEW] Mock

import {
  Search,
  Users,
  FolderOpen,
  Calendar,
  BookOpen,
  Settings,
  Calculator,
  Book,
  Globe,
  X,
  AlertTriangle
} from 'lucide-react';
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';

export default function DashboardHome({ isDemo = false, basePath = '/dashboard' }) {
  const [user, setUser] = useState(isDemo ? { user_metadata: { first_name: 'Dr. Martínez' } } : null);
  const [profile, setProfile] = useState(isDemo ? demoProfile : null);
  const [stats, setStats] = useState(isDemo ? demoStats : { clients: 0, deadlines: 0 });
  const [showPublicBanner, setShowPublicBanner] = useState(false);
  const [showPaymentBanner, setShowPaymentBanner] = useState(false);

  useEffect(() => {
    if (profile && profile.verification_status === 'verified' && !profile.is_public) {
      const dismissed = sessionStorage.getItem('judicia-public-banner-dismissed');
      if (!dismissed) setShowPublicBanner(true);
    }
    if (profile && profile.subscription_status === 'past_due') {
      const dismissed = sessionStorage.getItem('judicia-payment-banner-dismissed');
      if (!dismissed) setShowPaymentBanner(true);
    }
  }, [profile]);

  useEffect(() => {
    if (isDemo) return;

    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const todayStr = new Date().toISOString().split('T')[0];

        // Parallel fetch: profile + inquiries count + deadlines count
        const [profileRes, inquiryRes, deadlineRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('inquiries').select('*', { count: 'exact', head: true })
            .neq('status', 'link_generated').neq('source', 'manual').eq('assigned_lawyer_id', user.id),
          supabase.from('deadlines').select('*', { count: 'exact', head: true })
            .eq('user_id', user.id).eq('status', 'pending')
            .gte('due_date', `${todayStr}T00:00:00Z`).lte('due_date', `${todayStr}T23:59:59Z`)
        ]);

        if (profileRes.data) setProfile(profileRes.data);
        setStats({
          clients: !inquiryRes.error ? (inquiryRes.count || 0) : 0,
          deadlines: !deadlineRes.error ? (deadlineRes.count || 0) : 0
        });
      }
    };
    getData();
  }, [isDemo]);

  // Helper to adjust links
  const getLink = (path) => {
    return isDemo ? path.replace('/dashboard', basePath) : path;
  };

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
      id: 'calculators',
      title: 'Calculadora',
      desc: 'Herramientas de cálculo de indemnizaciones y plazos.',
      icon: <Calculator size={24} />,
      link: '/dashboard/calculators',
      color: '#f59e0b'
    },
    {
      id: 'legislation',
      title: 'Legislación',
      desc: 'Acceso rápido a normativas y códigos vigentes.',
      icon: <Book size={24} />,
      link: '/dashboard/legislation',
      color: '#8b5cf6'
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
    <div className={`dashboard-container ${isDemo ? 'demo-mode' : ''}`}>

      <div className="breadcrumb">
        <span className="breadcrumb-current">Gabinete de {user?.user_metadata?.first_name || 'Legal'}</span>
      </div>

      <header className="dashboard-header">
        <h2>Hola, {user?.user_metadata?.first_name}</h2>
        <div className="header-stats">
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Calendar size={16} /> <b>{stats.deadlines}</b> vencimientos hoy</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Users size={16} /> <b>{stats.clients}</b> clientes activos</span>
        </div>
        <UsageGuide content={dashboardManuals.dashboard} />
      </header>

      {showPaymentBanner && (
        <div className="dash-payment-banner">
          <AlertTriangle size={20} className="dash-payment-banner-icon" />
          <div className="dash-payment-banner-text">
            <strong>Problema con tu pago.</strong> Tu último pago no pudo procesarse. Tenés 7 días para regularizarlo antes de que tu cuenta baje al plan gratuito.
          </div>
          <Link href="/dashboard/settings?tab=billing" className="dash-payment-banner-btn">
            Regularizar
          </Link>
          <button
            type="button"
            className="dash-public-banner-close"
            onClick={() => {
              setShowPaymentBanner(false);
              sessionStorage.setItem('judicia-payment-banner-dismissed', '1');
            }}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showPublicBanner && (
        <div className="dash-public-banner">
          <Globe size={20} className="dash-public-banner-icon" />
          <div className="dash-public-banner-text">
            <strong>¡Tu perfil está verificado!</strong> Activá tu perfil público para que clientes te encuentren en el marketplace.
          </div>
          <Link href="/dashboard/settings" className="dash-public-banner-btn">
            Activar
          </Link>
          <button
            type="button"
            className="dash-public-banner-close"
            onClick={() => {
              setShowPublicBanner(false);
              sessionStorage.setItem('judicia-public-banner-dismissed', '1');
            }}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="dashboard-grid">
        {tools.map((tool, index) => (
          <Link href={getLink(tool.link)} key={tool.id} className="dashboard-card-link">
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
