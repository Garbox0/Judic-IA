"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import SafeChatWidget from '../components/SafeChatWidget';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.push('/login');
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
    <div style={{
      background: '#020617',
      height: '100vh',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Outfit, sans-serif'
    }}>
      <div className="loading-spinner"></div>
      <style jsx>{`
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(197, 160, 33, 0.1);
          border-top: 3px solid var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
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
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      {/* SIDEBAR */}
      <aside className="sidebar glass-panel">
        <div className="logo-section">
          <Link href="/dashboard" className="logo-link">
            <img src="/logo.png" alt="Judic-IA" className="dashboard-logo" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="logo-text">Judic-IA</span>
              {profile && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    router.push('/dashboard/settings?tab=billing');
                  }}
                  className={`plan-badge-btn ${profile.plan_tier === 'professional' ? 'pro' : 'starter'}`}
                >
                  {profile.plan_tier === 'professional' ? '👑 PRO SUITE' : '⚖️ PLAN STARTER'}
                </button>
              )}
            </div>
          </Link>
        </div>

        <div className="sidebar-divider"></div>

        <nav className="nav-links">
          <Link href="/dashboard/research" className={`nav-item ${pathname.includes('/research') ? 'active' : ''}`}>
            <span className="nav-icon">🔍</span>
            <span className="nav-label">Investigación</span>
          </Link>
          <Link href="/dashboard/clients" className={`nav-item ${pathname.includes('/clients') ? 'active' : ''}`}>
            <span className="nav-icon">👥</span>
            <span className="nav-label">Clientes</span>
          </Link>
          <Link href="/dashboard/agenda" className={`nav-item ${pathname.includes('/agenda') ? 'active' : ''}`}>
            <span className="nav-icon">📅</span>
            <span className="nav-label">Agenda</span>
          </Link>
          <Link href="/dashboard/settings" className={`nav-item ${pathname.includes('/settings') ? 'active' : ''}`}>
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Ajustes</span>
          </Link>
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

        <div className="sidebar-divider"></div>

        <div className="user-profile glass-card">
          <div className="profile-upper">
            <div className={`avatar glow-avatar ${profile?.avatar_url ? 'has-image' : ''}`}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="avatar-image-sidebar" />
              ) : (
                getInitials()
              )}
            </div>
            <div className="info">
              <p className="name">{getDisplayName()}</p>
              <p className="role">{user?.email}</p>
            </div>
          </div>
          <button
            className="btn-logout-premium"
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
          >
            <span className="icon">🚪</span> SALIR
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

      <style jsx>{`
        .dashboard-layout {
          display: flex;
          height: 100vh;
          background-color: var(--background);
          color: var(--foreground);
          overflow: hidden;
          font-family: 'Outfit', sans-serif;
        }

        /* SIDEBAR refined */
        .sidebar {
          width: 280px;
          height: 100vh;
          padding: 2.5rem 1.2rem;
          display: flex;
          flex-direction: column;
          z-index: 100;
          border-radius: 0;
          flex-shrink: 0;
          background: var(--glass-strong);
          backdrop-filter: blur(12px);
          border-right: 1px solid rgba(255, 255, 255, 0.05);
        }
        .logo-link {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          text-decoration: none;
        }
        .logo-section {
          margin-bottom: 2.5rem;
          padding-left: 0.5rem;
        }
        .dashboard-logo {
          width: 36px;
          height: 36px;
          filter: drop-shadow(0 0 8px var(--primary-glow));
        }
        .logo-text {
          font-size: 1.4rem;
          font-weight: 900;
          color: white;
          letter-spacing: -0.02em;
        }

        /* PLAN BADGE BTN */
        .plan-badge-btn {
          background: transparent;
          border: none;
          padding: 2px 0;
          text-align: left;
          cursor: pointer;
          font-family: 'Outfit', sans-serif;
          font-size: 0.65rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          transition: all 0.3s;
          margin-top: -2px;
        }
        .plan-badge-btn.starter { color: #64748b; }
        .plan-badge-btn.pro { color: #fbbf24; text-shadow: 0 0 10px rgba(251, 191, 36, 0.3); }
        .plan-badge-btn:hover {
          transform: translateX(3px);
          filter: brightness(1.3);
        }

        .sidebar-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.05), transparent);
          margin: 1.5rem 0;
          width: 100%;
        }

        .nav-links {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          margin-top: 1rem;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 1.2rem;
          padding: 1rem 1.4rem;
          color: #94a3b8;
          text-decoration: none;
          border-radius: 14px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          border: 1px solid transparent;
        }
        .nav-item:hover {
          color: white;
          background: rgba(255, 255, 255, 0.03);
          transform: translateX(5px);
        }
        .nav-item.active {
          background: rgba(212, 178, 76, 0.1);
          color: var(--primary);
          border: 1px solid rgba(212, 178, 76, 0.15);
          border-left: 3px solid var(--primary); /* Active Indicator */
          box-shadow: 0 4px 20px rgba(212, 178, 76, 0.05);
        }

        /* UPGRADE CARD refined */
        .upgrade-card {
          position: relative;
          margin: 1.5rem 0.8rem;
          padding: 1.1rem;
          background: rgba(212, 178, 76, 0.05);
          border: 1px solid rgba(212, 178, 76, 0.2);
          border-radius: 99px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 4s infinite ease-in-out; /* Pulsing effect */
        }
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(212,178,76, 0); border-color: rgba(212,178,76, 0.2); }
            50% { box-shadow: 0 0 15px 0 rgba(212,178,76, 0.15); border-color: rgba(212,178,76, 0.4); }
            100% { box-shadow: 0 0 0 0 rgba(212,178,76, 0); border-color: rgba(212,178,76, 0.2); }
        }
        .upgrade-card:hover {
          background: rgba(251, 191, 36, 0.1);
          border-color: #fbbf24;
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(251, 191, 36, 0.15);
        }
        .upgrade-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          color: #fbbf24;
          font-weight: 700;
          font-size: 0.9rem;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }
        .spark-icon { font-size: 1.1rem; }
        .arrow-icon {
          opacity: 0.6;
          transition: transform 0.3s;
          font-size: 1.1rem;
        }
        .upgrade-card:hover .arrow-icon {
          transform: translateX(4px);
          opacity: 1;
        }
        .upgrade-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(251, 191, 36, 0.1), transparent 70%);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .upgrade-card:hover .upgrade-glow {
          opacity: 1;
        }

        .user-profile {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.2rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
        }
        .profile-upper {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--primary), #8a6a1b);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .avatar-image-sidebar { width: 100%; height: 100%; object-fit: cover; border-radius: 11px; }
        .info .name {
          font-weight: 700;
          font-size: 0.9rem;
          color: white;
          margin: 0;
        }
        .info .role {
          font-size: 0.7rem;
          color: #64748b;
          margin-top: 0.1rem;
        }
        .btn-logout-premium {
          width: 100%;
          padding: 0.7rem;
          background: rgba(239, 68, 68, 0.05);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.15);
          border-radius: 10px;
          font-weight: 800;
          font-size: 0.7rem;
          cursor: pointer;
          transition: all 0.3s;
          letter-spacing: 0.1em;
        }
        .btn-logout-premium:hover {
          background: #ef4444;
          color: white;
          border-color: #ef4444;
        }

        /* VIEWPORT */
        .main-viewport {
          flex: 1;
          height: 100vh;
          overflow-y: auto;
          position: relative;
          background: #020617;
          background-image: 
            radial-gradient(at 0% 0%, rgba(197, 160, 33, 0.03) 0, transparent 50%), 
            radial-gradient(at 100% 100%, rgba(197, 160, 33, 0.02) 0, transparent 50%);
        }
      `}</style>
    </div>
  );
}
