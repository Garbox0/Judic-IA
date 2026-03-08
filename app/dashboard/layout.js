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
  ShieldAlert,
  Menu,
  Crown,
  Sparkles,
  Calculator,
  Newspaper,
  Globe,
  Sun,
  Moon,
  X,
  Building2,
  MessageSquare
} from 'lucide-react';
import dynamic from 'next/dynamic';

const CommunityChatWidget = dynamic(() => import('../components/CommunityChatWidget'), { ssr: false });
const SessionGuard = dynamic(() => import('../components/SessionGuard'), { ssr: false });

import './dashboard.css';

export default function DashboardLayout({ children, isDemo = false, basePath = '/dashboard', mockProfile = null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(!isDemo); // If demo, not loading initial auth
  const [user, setUser] = useState(isDemo ? { email: 'demo@judicia.com', id: 'demo' } : null);
  const [profile, setProfile] = useState(isDemo ? (mockProfile || demoProfile) : null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [show2faBanner, setShow2faBanner] = useState(false);
  const [isEstudioMember, setIsEstudioMember] = useState(false);

  // Load theme from localStorage
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('app-theme') || 'light';
      setTheme(savedTheme);
    } catch { /* SSR or incognito fallback */ }
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

  // Redirect estudio members whenever they land on the root /dashboard
  useEffect(() => {
    if (!isDemo && isEstudioMember && pathname === '/dashboard') {
      router.push('/dashboard/estudio');
    }
  }, [pathname, isEstudioMember, isDemo, router]);

  useEffect(() => {
    if (isDemo) return; // Skip Auth Check in Demo Mode

    const checkSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/login');
        return;
      }
      const user = session.user;
      if (!user) {
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

        // Check si pertenece a un estudio verificado
        if (profileData.org_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('type, verification_status')
            .eq('id', profileData.org_id)
            .maybeSingle();

          if (orgData?.type === 'estudio' && orgData?.verification_status === 'verified') {
            setIsEstudioMember(true);
            if (pathname === '/dashboard') {
              router.push('/dashboard/estudio');
              return;
            }
          }
        }

        // Banner 2FA: mostrar si no tiene 2FA y no lo descartó antes
        if (!profileData.two_factor_email) {
          const dismissed = localStorage.getItem(`2fa_banner_dismissed_${user.id}`);
          if (!dismissed) setShow2faBanner(true);
        }

        // 2FA: si está habilitado y no verificado (JWT app_metadata), volver al login
        // El login detecta la sesión activa y muestra el paso OTP automáticamente
        if (profileData.two_factor_email && !user.app_metadata?.two_fa_verified_at) {
          router.push('/login');
          return;
        }

        // BLOQUE 4: ACTIVAR TRIAL AUTOMÁTICAMENTE
        // No aplica para cuentas enterprise (ya tienen su propio plan)
        const isEnterprise = profileData.plan_tier === 'enterprise' || profileData.plan_tier === 'pending_enterprise';
        if (!isEnterprise && (!profileData.subscription_status || !profileData.trial_ends_at)) {
          console.log("🎭 New User detected, activating Trial...");
          fetch('/api/demo/activate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ user_id: user.id })
          }).then(res => res.json()).then(data => {
            if (data.ok) {
              console.log("✅ Trial Activated!", data);
              // Update local state to reflect changes instantly
              setProfile(prev => ({
                ...prev,
                subscription_status: 'active',
                plan_tier: 'trial',
                trial_ends_at: data.trial_ends_at || data.demo_expires_at // Backward compatibility
              }));
            }
          }).catch(err => console.error("❌ Failed to activate trial:", err));
        }
      }

      setLoading(false);
    };
    checkSession();
  }, [router, isDemo]);

  // Estudio routes have their own layout — skip individual dashboard wrapper
  if (pathname.startsWith('/dashboard/estudio')) {
    return <>{children}</>;
  }

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
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>

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
          aria-expanded={mobileSidebarOpen}
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
        aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
        aria-pressed={theme === 'light'}
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
            {['enterprise', 'pending_enterprise', 'enterprise_member', 'enterprise_s', 'enterprise_m', 'enterprise_l', 'enterprise_xl'].includes(profile?.plan_tier) ? (
              <span className="plan-inline"><Building2 size={14} /> ENTERPRISE</span>
            ) : profile?.plan_tier === 'professional' ? (
              <span className="plan-inline"><Crown size={14} /> PRO SUITE</span>
            ) : profile?.plan_tier === 'trial' ? (
              <span className="plan-inline"><Sparkles size={14} /> TRIAL</span>
            ) : (
              <span className="plan-inline"><Scale size={14} /> PLAN STARTER</span>
            )}
          </div>
        </div>

        <nav className="nav-links" aria-label="Menú principal">
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
          <Link href={isDemo ? `${basePath}/boletin` : '/dashboard/boletin'} className={`nav-item ${pathname.includes('/boletin') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <Newspaper size={18} className="nav-icon" />
            <span>Boletín Oficial</span>
          </Link>
          <Link href={isDemo ? `${basePath}/federal` : '/dashboard/federal'} className={`nav-item ${pathname.includes('/federal') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <Globe size={18} className="nav-icon" />
            <span>Hub Federal</span>
          </Link>
          <Link href={isDemo ? `${basePath}/library` : '/dashboard/library'} className={`nav-item ${pathname.includes('/library') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <BookOpen size={18} className="nav-icon" />
            <span>Jurisprudencias</span>
          </Link>
          {!isDemo && (
            <Link href="/dashboard/whatsapp" className={`nav-item ${pathname.includes('/whatsapp') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
              <MessageSquare size={18} className="nav-icon" style={{ color: pathname.includes('/whatsapp') ? undefined : '#25d366' }} />
              <span>Agente WhatsApp</span>
              <span className="nav-badge-new">BETA</span>
            </Link>
          )}
          <Link href={isDemo ? `${basePath}/settings` : '/dashboard/settings'} className={`nav-item ${pathname.includes('/settings') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <Settings size={18} className="nav-icon" />
            <span>Ajustes</span>
          </Link>
          {!isDemo && isEstudioMember && (
            <Link href="/dashboard/estudio" className={`nav-item ${pathname.startsWith('/dashboard/estudio') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
              <Building2 size={18} className="nav-icon" />
              <span>Panel Estudio</span>
            </Link>
          )}
          {!isDemo && user?.email === 'gbrlescalada@gmail.com' && user?.id === '365cd259-4f1e-4004-a677-1eda06a5147e' && (
            <Link href="/dashboard/admin" className={`nav-item ${pathname.includes('/admin') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
              <ShieldCheck size={18} className="nav-icon" />
              <span className="text-gold-400">Admin Panel</span>
            </Link>
          )}
        </nav>

        {!isDemo && !['professional', 'enterprise', 'pending_enterprise', 'enterprise_member', 'enterprise_s', 'enterprise_m', 'enterprise_l', 'enterprise_xl'].includes(profile?.plan_tier) && (
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
              aria-label="Cerrar sesión"
              onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                  await fetch('/api/auth/2fa/logout', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                  }).catch(() => { });
                }
                await supabase.auth.signOut();
                router.push('/login');
              }}
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-viewport" id="main-content">
        {!isDemo && show2faBanner && (
          <div className="banner-2fa" role="alert">
            <ShieldAlert size={18} className="banner-2fa-icon" />
            <span>
              Tu cuenta no está protegida con verificación en dos pasos.{' '}
              <Link href="/dashboard/settings?tab=security" className="banner-2fa-link" onClick={() => setShow2faBanner(false)}>
                Activar 2FA →
              </Link>
            </span>
            <button
              className="banner-2fa-close"
              aria-label="Descartar aviso"
              onClick={() => {
                setShow2faBanner(false);
                localStorage.setItem(`2fa_banner_dismissed_${user?.id}`, '1');
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {children}
      </main>

      {!isDemo && <CommunityChatWidget />}

      {/* SECURITY HEARTBEAT */}
      {!isDemo && <SessionGuard targetId={user?.id} tableName="profiles" />}
    </div>
  );
}
