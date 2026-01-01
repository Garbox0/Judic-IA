"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import ChatWidget from '../components/ChatWidget';

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
      return `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`;
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
            <span className="logo-text">Judic-IA</span>
          </Link>
        </div>

        <div className="sidebar-divider"></div>

        <nav className="nav-links">
          <Link href="/dashboard/research" className={`nav-item ${pathname.includes('/research') ? 'active' : ''}`}>
            <span className="nav-icon">🔍</span> Investigación Legal
          </Link>
          <Link href="/dashboard/clients" className={`nav-item ${pathname.includes('/clients') ? 'active' : ''}`}>
            <span className="nav-icon">👥</span> Mis Clientes
          </Link>
          <Link href="/dashboard/agenda" className={`nav-item ${pathname.includes('/agenda') ? 'active' : ''}`}>
            <span className="nav-icon">📅</span> Agenda
          </Link>
          <Link href="/dashboard/settings" className={`nav-item ${pathname.includes('/settings') ? 'active' : ''}`}>
            <span className="nav-icon">⚙️</span> Configuración
          </Link>
        </nav>

        <div className="sidebar-divider"></div>

        <div className="user-profile glass-card">
          <div className="profile-upper">
            <div className="avatar glow-avatar">
              {getInitials()}
            </div>
            <div className="info">
              <p className="name">
                {getDisplayName()}
              </p>
              <p className="role">{user?.email}</p>
            </div>
          </div>
          <button
            className="btn-logout-premium"
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
          >
            <span className="icon">🚪</span> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-viewport">
        {children}
      </main>

      <ChatWidget
        mode="internal"
        initialMessage="¡Hola! Soy tu asistente de soporte de Judic-IA. ¿Necesitas ayuda para navegar en tu Gabinete Jurídico?"
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

        /* SIDEBAR */
        .sidebar {
          width: 280px;
          height: 100vh;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          z-index: 100;
          border-radius: 0;
          flex-shrink: 0;
        }
        .logo-link {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          text-decoration: none;
        }
        .logo-section {
          margin-bottom: 3rem;
          padding-left: 0.5rem;
        }
        .dashboard-logo {
          width: 32px;
          height: 32px;
        }
        .logo-text {
          font-size: 1.5rem;
          font-weight: 900;
          color: white;
          letter-spacing: -0.01em;
          background: linear-gradient(to right, white, var(--primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .sidebar-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.05), transparent);
          margin: 1.2rem 0;
          width: 100%;
        }
        .nav-links {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
          margin-top: 2rem;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 1.2rem 1.8rem;
          color: #94a3b8;
          text-decoration: none;
          border-radius: 16px;
          transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
          font-size: 1rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border: 1px solid transparent;
          position: relative;
        }
        .nav-item:hover {
          color: white;
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.05);
          padding-left: 2rem;
        }
        .nav-item.active {
          background: rgba(197, 160, 33, 0.08);
          color: var(--primary);
          border: 1px solid rgba(197, 160, 33, 0.2);
          box-shadow: 0 0 25px rgba(197, 160, 33, 0.08);
          padding-left: 2rem;
        }
        .nav-item.active::after {
          content: '';
          position: absolute;
          left: 0;
          top: 15%;
          bottom: 15%;
          width: 4px;
          background: var(--primary);
          border-radius: 0 4px 4px 0;
          box-shadow: 0 0 15px var(--primary-glow);
        }
        .nav-icon { 
          font-size: 1.6rem; 
          transition: all 0.3s;
          filter: grayscale(1) opacity(0.5);
        }
        .nav-item:hover .nav-icon, .nav-item.active .nav-icon {
          filter: grayscale(0) opacity(1);
          transform: scale(1.15);
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
          transition: all 0.3s;
        }
        .user-profile:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(197, 160, 33, 0.15);
          transform: translateY(-2px);
        }
        .profile-upper {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--primary), #8a6a1b);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .info { min-width: 0; }
        .info .name {
          font-weight: 700;
          font-size: 0.95rem;
          color: white;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: 0.01em;
        }
        .info .role {
          font-size: 0.75rem;
          color: #94a3b8;
          margin-top: 0.1rem;
          opacity: 0.8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .btn-logout-premium {
          width: 100%;
          padding: 0.8rem;
          background: rgba(239, 68, 68, 0.03);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.1);
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .btn-logout-premium:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: #ef4444;
          color: white;
        }

        /* VIEWPORT */
        .main-viewport {
          flex: 1;
          height: 100vh;
          overflow-y: auto;
          position: relative;
          background: radial-gradient(circle at 50% 0%, rgba(197, 160, 33, 0.03) 0%, transparent 50%);
        }
      `}</style>
    </div>
  );
}
