"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import SafeChatWidget from '../components/SafeChatWidget';

import './dashboard.css';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    // ... logic same ...
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
  }, [router]);

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
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="dashboard-layout">
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
        >
          ☰
        </button>
        <span className="mobile-brand">Judic-IA</span>
      </div>

      {/* SIDEBAR */}
      <aside className={`sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
        <div className="logo-section">
          <Link href="/dashboard" className="logo-link">
            <h1>Judic-IA</h1>
          </Link>
          <div className="plan-badge">
            {profile?.plan_tier === 'professional' ? '👑 PRO SUITE' : '⚖️ PLAN STARTER'}
          </div>
        </div>

        <nav className="nav-links">
          <Link href="/dashboard/research" className={`nav-item ${pathname.includes('/research') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <span>🔍 Jurisprudencia</span>
          </Link>
          <Link href="/dashboard/clients" className={`nav-item ${pathname.includes('/clients') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <span>👥 Clientes</span>
          </Link>
          <Link href="/dashboard/cases" className={`nav-item ${pathname.includes('/cases') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <span>📁 Expedientes</span>
          </Link>
          <Link href="/dashboard/agenda" className={`nav-item ${pathname.includes('/agenda') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <span>📅 Plazos</span>
          </Link>
          <Link href="/dashboard/settings" className={`nav-item ${pathname.includes('/settings') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <span>⚙️ Ajustes</span>
          </Link>
          <Link href="/dashboard/library" className={`nav-item ${pathname.includes('/library') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
            <span>📚 Biblioteca</span>
          </Link>
          {user?.email === 'gbrlescalada@gmail.com' && user?.id === '365cd259-4f1e-4004-a677-1eda06a5147e' && (
            <Link href="/dashboard/admin" className={`nav-item ${pathname.includes('/admin') ? 'active' : ''}`} onClick={() => setMobileSidebarOpen(false)}>
              <span className="text-gold-400">🛡️ Admin Panel</span>
            </Link>
          )}
        </nav>

        {profile?.plan_tier !== 'professional' && (
          <div
            className="upgrade-card"
            onClick={() => router.push('/dashboard/settings?tab=billing')}
          >
            <div className="upgrade-glow"></div>
            <div className="upgrade-content">
              <span className="spark-icon">✨</span>
              <span className="elite-text">Oferta Elite</span>
              <span className="arrow-icon">→</span>
            </div>
          </div>
        )}

        <div className="user-profile">
          <div className="profile-info">
            <strong>{getDisplayName()}</strong>
            <small>{user?.email}</small>
          </div>
          <button
            className="btn-logout"
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
          >
            SALIR
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-viewport">
        {children}
      </main>

      <SafeChatWidget
        mode="internal"
        initialMessage="Hola. Soy tu asistente de soporte técnico. ¿En qué puedo ayudarte?"
      />
    </div>
  );
}
