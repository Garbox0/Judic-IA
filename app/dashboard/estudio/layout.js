"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, LayoutDashboard, Inbox, Users, BarChart2,
  Scale, Settings, LogOut, Menu, X, Sun, Moon, ArrowLeft, Coins,
  Search, Archive, CreditCard
} from 'lucide-react';
import './estudio-dashboard.css';

const ROLE_LABELS = { owner: 'Titular', supervisor: 'Supervisor', abogado: 'Abogado', lawyer: 'Abogado' };
const PLAN_LABELS = { enterprise_s: 'Enterprise S', enterprise_m: 'Enterprise M', enterprise_l: 'Enterprise L', enterprise_xl: 'Enterprise XL' };

const PLAN_PRICES = { enterprise_s: '$89.000', enterprise_m: '$149.000', enterprise_l: '$249.000', enterprise_xl: '$449.000' };
const PLAN_MEMBERS = { enterprise_s: 'Hasta 5 miembros', enterprise_m: 'Hasta 10 miembros', enterprise_l: 'Hasta 20 miembros', enterprise_xl: 'Hasta 40 miembros' };

function SubscriptionGate({ org, role }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/mp/org-subscription/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ orgId: org?.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al iniciar el pago'); return; }
      window.open(data.init_point, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const planLabel = PLAN_LABELS[org?.plan_tier] || 'Enterprise';
  const planPrice = PLAN_PRICES[org?.plan_tier] || '';
  const planMembers = PLAN_MEMBERS[org?.plan_tier] || '';
  const isCancelled = org?.subscription_status === 'cancelled';

  return (
    <div className="estudio-sub-gate">
      <div className="estudio-sub-gate-card">
        <div className="estudio-sub-gate-icon">
          <CreditCard size={32} />
        </div>
        <h2 className="estudio-sub-gate-title">
          {isCancelled ? 'Suscripción cancelada' : 'Activá tu suscripción'}
        </h2>
        <p className="estudio-sub-gate-desc">
          {isCancelled
            ? 'Tu suscripción fue cancelada. Para volver a utilizar el panel del estudio, reactivá el plan.'
            : 'El acceso al panel del estudio requiere una suscripción activa.'
          }
        </p>

        {role === 'owner' ? (
          <>
            <div className="estudio-sub-gate-plan">
              <span className="estudio-sub-gate-plan-name">{planLabel}</span>
              <span className="estudio-sub-gate-plan-price">{planPrice}<span>/mes</span></span>
              <span className="estudio-sub-gate-plan-members">{planMembers}</span>
            </div>
            {error && <p className="estudio-sub-gate-error">{error}</p>}
            <button
              className="estudio-sub-gate-btn"
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? 'Redirigiendo...' : isCancelled ? 'Reactivar suscripción →' : 'Suscribirme ahora →'}
            </button>
            <p className="estudio-sub-gate-note">
              Pago mensual recurrente via MercadoPago. Podés cancelar en cualquier momento.
            </p>
          </>
        ) : (
          <p className="estudio-sub-gate-contact">
            Contactá al titular del estudio para activar la suscripción.
          </p>
        )}
      </div>
    </div>
  );
}

export default function EstudioLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [org, setOrg] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    try {
      const t = localStorage.getItem('app-theme') || 'light';
      setTheme(t);
    } catch { }
  }, []);

  useEffect(() => {
    if (theme === 'light') document.body.classList.add('light-theme');
    else document.body.classList.remove('light-theme');
    try { localStorage.setItem('app-theme', theme); } catch { }
  }, [theme]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      setUser(session.user);

      // Fetch profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, plan_tier, org_id')
        .eq('id', session.user.id)
        .single();

      setProfile(prof);

      // Fetch org membership
      if (prof?.org_id) {
        const { data: member } = await supabase
          .from('org_members')
          .select('role, org:org_id(id, name, razon_social, type, verification_status, plan_tier, member_limit, subscription_status, subscription_expiry)')
          .eq('user_id', session.user.id)
          .eq('org_id', prof.org_id)
          .single();

        if (
          !member ||
          member.org?.type !== 'estudio' ||
          member.org?.verification_status !== 'verified'
        ) {
          router.push('/dashboard');
          return;
        }

        setOrg(member.org);
        setRole(member.role);
      } else {
        router.push('/dashboard');
        return;
      }

      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) return (
    <div className="estudio-layout">
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="estudio-spinner" />
      </div>
    </div>
  );

  const orgName = org?.razon_social || org?.name || 'Mi Estudio';
  const planLabel = PLAN_LABELS[org?.plan_tier] || 'Enterprise';
  const roleLabel = ROLE_LABELS[role] || 'Abogado';
  const displayName = profile?.full_name || user?.email || 'Usuario';
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const canSupervise = role === 'owner' || role === 'supervisor';
  const canManageMembers = role === 'owner';

  const navItems = [
    { href: '/dashboard/estudio', label: 'Resumen', icon: LayoutDashboard, exact: true },
    { href: '/dashboard/estudio/bandeja', label: 'Bandeja', icon: Inbox },
    ...(canSupervise ? [{ href: '/dashboard/estudio/supervision', label: 'Supervisión', icon: BarChart2 }] : []),
    { href: '/dashboard/estudio/buscar', label: 'Buscar', icon: Search },
    { href: '/dashboard/estudio/archivados', label: 'Archivados', icon: Archive },
    ...(canManageMembers ? [{ href: '/dashboard/estudio/miembros', label: 'Miembros', icon: Users }] : []),
    { href: '/dashboard/estudio/creditos', label: 'Créditos', icon: Coins },
    ...(canManageMembers ? [{ href: '/dashboard/estudio/suscripcion', label: 'Suscripción', icon: CreditCard }] : []),
  ];

  const externalItems = [
    { href: '/dashboard/research', label: 'Investigación', icon: Scale },
    { href: '/dashboard/settings', label: 'Ajustes', icon: Settings },
  ];

  const isActive = (href, exact = false) => exact
    ? pathname === href
    : pathname.startsWith(href);

  return (
    <div className={`estudio-layout ${theme === 'light' ? 'light-theme' : ''}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="estudio-mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile header */}
      <div className="estudio-mobile-header">
        <button className="estudio-mobile-toggle" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">
          <Menu size={20} />
        </button>
        <span className="estudio-mobile-brand">{orgName}</span>
        <button className="estudio-mobile-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-label="Cambiar tema">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`estudio-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Navegación del estudio">
        {sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 4 }}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        )}

        <div className="estudio-logo-section">
          <h1 title={orgName}>{orgName}</h1>
          <div className="estudio-plan-badge">
            <Building2 size={10} /> {planLabel}
          </div>
        </div>

        <nav className="estudio-nav" aria-label="Menú del estudio">
          <span className="estudio-nav-divider">Panel</span>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive(item.href, item.exact) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} className="nav-icon" />
              <span>{item.label}</span>
            </Link>
          ))}

          <span className="estudio-nav-divider" style={{ marginTop: 8 }}>Herramientas</span>
          {externalItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-item nav-external"
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} className="nav-icon" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="estudio-user-section">
          <div className="estudio-user-row">
            <div className="estudio-user-avatar">{initials}</div>
            <div className="estudio-user-info">
              <span className="estudio-user-name">{displayName}</span>
              <span className="estudio-user-role">{roleLabel}</span>
            </div>
            <button
              className="estudio-logout-btn"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                  await fetch('/api/auth/2fa/logout', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}` }
                  }).catch(() => { });
                }
                await supabase.auth.signOut();
                router.push('/login');
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
          <Link href="/dashboard" className="estudio-back-link" onClick={() => setSidebarOpen(false)}>
            <ArrowLeft size={13} /> Volver a mi panel
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="estudio-main" id="main-content">
        {org?.subscription_status !== 'active'
          ? <SubscriptionGate org={org} role={role} />
          : children
        }
      </main>
    </div>
  );
}
