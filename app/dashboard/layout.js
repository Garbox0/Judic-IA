"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { demoProfile } from '../lib/demoData'; // [NEW] Mock Data
import {
  LogOut,
  Scale,
  Users,
  FolderOpen,
  CalendarClock,
  Settings,
  BookOpen,
  ShieldCheck,
  Menu,
  Crown,
  Sparkles,
  Book,
  Calculator,
  Sun,
  Moon
} from 'lucide-react';
import SafeChatWidget from '../components/SafeChatWidget';
import SessionGuard from '../components/SessionGuard';

import './dashboard.css';

export default function DashboardLayout({ children, isDemo = false, basePath = '/dashboard', mockProfile = null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(!isDemo); // If demo, not loading initial auth
  const [user, setUser] = useState(isDemo ? { email: 'demo@judicia.com', id: 'demo' } : null);
  const [profile, setProfile] = useState(isDemo ? (mockProfile || demoProfile) : null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
  };

  // Sync theme with body class for global scope (Modals, Portals, etc.)
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  useEffect(() => {
    if (isDemo) return; // Skip Auth Check in Demo Mode

    const checkSession = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.push('/login');
        return;
      }

      // SECURITY: Prevent Clients from accessing Lawyer Dashboard
      if (user.user_metadata?.role === 'client') {
        await supabase.auth.signOut();
        router.push('/consultas/auth/login?error=access_denied&error_description=Acceso+Restringido');
        return;
      }

      setUser(user);

      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profileError && profileData) {
        setProfile(profileData);

        // BLOQUE 4: ACTIVAR DEMO AUTOMÁTICAMENTE
        if (!profileData.subscription_status || !profileData.demo_expires_at) {
          console.log("🎭 New User detected, activating Demo...");
          fetch('/api/demo/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id })
          }).then(res => res.json()).then(data => {
            if (data.ok) {
              console.log("✅ Demo Activated!", data);
              // Update local state to reflect changes instantly
              setProfile(prev => ({
                ...prev,
                subscription_status: 'demo',
                plan_tier: 'starter',
                demo_expires_at: data.demo_expires_at
              }));
            }
          }).catch(err => console.error("❌ Failed to activate demo:", err));
        }
      }

      setLoading(false);
    };
    checkSession();
  }, [router, isDemo]);

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
    </div>
  );

  // Helper to get display name
  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name;
    if (user?.user_metadata?.first_name) {
      return `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''} `;
    }
    return 'Usuario';
  };

  // Helper to get initials
  const getInitials = () => {
    const name = getDisplayName();
    if (name === 'Usuario' && user?.email) return user.email[0].toUpperCase();
    return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Helper for links
  const getLink = (path) => {
    return path === '/dashboard' ? basePath : `${basePath}/${path.replace('/dashboard/', '')}`;
  };

  return (
    <div className={`dashboard-layout ${isDemo ? 'demo-mode' : ''} ${theme === 'light' ? 'light-theme' : ''}`}>
      {/* MOBILE OVERLAY */}
      {mobileSidebarOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* MOBILE HEADER */}
      <div className="mobile-header">
        <button
          className="mobile-toggle-btn"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <span className="mobile-brand">Judic-IA {isDemo && <span className="demo-badge">DEMO</span>}</span>
      </div>

      {/* FLOATING THEME TOGGLE */}
      <button
        className="floating-theme-toggle"
        onClick={toggleTheme}
        title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
        aria-label="Alternar tema"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* SIDEBAR */}
      <aside className={`sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
        <div className="logo-section">
          {isDemo ? (
            <div className="logo-link" style={{ cursor: 'default' }}>
              <h1>Judic-IA</h1>
              <span className="demo-tag">Modo Demo</span>
            </div>
          ) : (
            <Link href="/dashboard" className="logo-link">
              <h1>Judic-IA</h1>
            </Link>
          )}

          <div className="plan-badge">
            {profile?.plan_tier === 'professional' ? (
              <span className="plan-inline"><Crown size={14} /> PRO SUITE</span>
            ) : (
              <span className="plan-inline"><Scale size={14} /> PLAN STARTER</span>
            )}
          </div>
        </div>

        <nav className="nav-links">
          {/* We mapped these manually, so we just update the Hrefs */}
          <Link href={isDemo ? `${basePath}/research` : '/dashboard/research'} className={`nav-item ${pathname.includes('/research') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <Scale size={18} className="nav-icon" />
            <span>Jurisprudencia</span>
          </Link>
          <Link href={isDemo ? `${basePath}/clients` : '/dashboard/clients'} className={`nav-item ${pathname.includes('/clients') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <Users size={18} className="nav-icon" />
            <span>Clientes</span>
          </Link>
          <Link href={isDemo ? `${basePath}/cases` : '/dashboard/cases'} className={`nav-item ${pathname.includes('/cases') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <FolderOpen size={18} className="nav-icon" />
            <span>Expedientes</span>
          </Link>
          <Link href={isDemo ? `${basePath}/agenda` : '/dashboard/agenda'} className={`nav-item ${pathname.includes('/agenda') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <CalendarClock size={18} className="nav-icon" />
            <span>Plazos</span>
          </Link>
          <Link href={isDemo ? `${basePath}/calculators` : '/dashboard/calculators'} className={`nav-item ${pathname.includes('/calculators') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <Calculator size={18} className="nav-icon" />
            <span>Calculadoras</span>
          </Link>
          <Link href={isDemo ? `${basePath}/legislation` : '/dashboard/legislation'} className={`nav-item ${pathname.includes('/legislation') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <Book size={18} className="nav-icon" />
            <span>Legislación</span>
          </Link>
          <Link href={isDemo ? `${basePath}/library` : '/dashboard/library'} className={`nav-item ${pathname.includes('/library') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <BookOpen size={18} className="nav-icon" />
            <span>Biblioteca</span>
          </Link>
          <Link href={isDemo ? `${basePath}/settings` : '/dashboard/settings'} className={`nav-item ${pathname.includes('/settings') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <Settings size={18} className="nav-icon" />
            <span>Ajustes</span>
          </Link>
          {!isDemo && user?.email === 'gbrlescalada@gmail.com' && user?.id === '365cd259-4f1e-4004-a677-1eda06a5147e' && (
            <Link href="/dashboard/admin" className={`nav-item ${pathname.includes('/admin') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
              <ShieldCheck size={18} className="nav-icon" />
              <span className="text-gold-400">Admin Panel</span>
            </Link>
          )}
        </nav>

        {!isDemo && profile?.plan_tier !== 'professional' && (
          <div
            className="upgrade-card"
            onClick={() => router.push('/dashboard/settings?tab=billing')}
          >
            <div className="upgrade-glow"></div>
            <div className="upgrade-content">
              <Sparkles size={16} className="spark-icon" />
              <span className="elite-text">Oferta Elite</span>
              <span className="arrow-icon">→</span>
            </div>
          </div>
        )}

        {isDemo && (
          <div style={{ padding: '1rem', marginTop: 'auto' }}>
            <Link href="/" className="btn-primary" style={{ display: 'block', textAlign: 'center', fontSize: '0.8rem', padding: '0.5rem' }}>
              Salir de Demo
            </Link>
          </div>
        )}

        <div className="user-profile">
          <div className="user-avatar">
            {getInitials()}
          </div>
          <div className="profile-info">
            <span className="user-name">{getDisplayName()}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          {!isDemo && (
            <button
              className="btn-logout"
              title="Cerrar Sesión"
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-viewport">
        {children}
      </main>

      {!isDemo && (
        <SafeChatWidget
          mode="internal"
          initialMessage="Hola. Soy tu asistente de soporte técnico. ¿En qué puedo ayudarte?"
        />
      )}

      {/* SECURITY HEARTBEAT */}
      {!isDemo && <SessionGuard targetId={user?.id} tableName="profiles" />}
    </div>
  );
}
