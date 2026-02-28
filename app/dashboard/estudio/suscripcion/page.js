"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, CheckCircle2, AlertTriangle, XCircle, CalendarClock } from 'lucide-react';

const PLAN_LABELS  = { enterprise_s: 'Enterprise S', enterprise_m: 'Enterprise M', enterprise_l: 'Enterprise L', enterprise_xl: 'Enterprise XL' };
const PLAN_PRICES  = { enterprise_s: '$89.000', enterprise_m: '$149.000', enterprise_l: '$249.000', enterprise_xl: '$449.000' };
const PLAN_MEMBERS = { enterprise_s: 'Hasta 5 miembros', enterprise_m: 'Hasta 10 miembros', enterprise_l: 'Hasta 20 miembros', enterprise_xl: 'Miembros ilimitados' };

const STATUS_CONFIG = {
  active:    { icon: CheckCircle2, color: '#22c55e', label: 'Activa' },
  cancelled: { icon: XCircle,      color: '#f87171', label: 'Cancelada' },
  past_due:  { icon: AlertTriangle,color: '#fbbf24', label: 'Pago pendiente' },
  inactive:  { icon: CreditCard,   color: '#94a3b8', label: 'Inactiva' },
};

export default function SuscripcionPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [org,     setOrg]     = useState(null);
  const [role,    setRole]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // On mount: if ?status=success → sync immediately
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: prof } = await supabase
        .from('profiles')
        .select('org_id, plan_tier')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!prof?.org_id) { router.push('/dashboard'); return; }

      const { data: member } = await supabase
        .from('org_members')
        .select('role, org:org_id(id, razon_social, name, plan_tier, subscription_status, subscription_expiry, mp_preapproval_id)')
        .eq('user_id', session.user.id)
        .eq('org_id', prof.org_id)
        .maybeSingle();

      if (!member) { router.push('/dashboard/estudio'); return; }

      setOrg(member.org);
      setRole(member.role);

      // Auto-sync si venimos de MercadoPago con ?status=success
      if (searchParams.get('status') === 'success' && member.role === 'owner') {
        setSyncing(true);
        try {
          const res = await fetch('/api/mp/org-subscription/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ orgId: member.org?.id }),
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            setOrg(prev => ({ ...prev, subscription_status: 'active', subscription_expiry: data.subscription_expiry }));
            setSuccess('¡Suscripción activada correctamente!');
          } else {
            setError(data.error || 'No se pudo sincronizar la suscripción. Si ya pagaste, esperá unos minutos y recargá.');
          }
        } catch {
          setError('Error de conexión al sincronizar.');
        } finally {
          setSyncing(false);
        }
      }

      setLoading(false);
    };
    init();
  }, [router, searchParams]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/mp/org-subscription/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ orgId: org?.id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setOrg(prev => ({ ...prev, subscription_status: 'active', subscription_expiry: data.subscription_expiry }));
        setSuccess('Estado sincronizado correctamente.');
      } else {
        setError(data.error || 'No se encontró una suscripción activa.');
      }
    } catch {
      setError('Error de conexión.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/mp/org-subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ orgId: org?.id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setOrg(prev => ({ ...prev, subscription_status: 'cancelled' }));
        setSuccess('Suscripción cancelada. Mantenés acceso hasta que venza el período actual.');
        setShowCancelConfirm(false);
      } else {
        setError(data.error || 'No se pudo cancelar. Intentá de nuevo.');
      }
    } catch {
      setError('Error de conexión.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading || syncing) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="estudio-spinner" />
      {syncing && <span style={{ marginLeft: 12, color: 'var(--text-secondary)' }}>Sincronizando estado...</span>}
    </div>
  );

  const orgName    = org?.razon_social || org?.name || 'Mi Estudio';
  const planTier   = org?.plan_tier || 'enterprise_s';
  const planLabel  = PLAN_LABELS[planTier] || 'Enterprise';
  const planPrice  = PLAN_PRICES[planTier] || '';
  const planMembers = PLAN_MEMBERS[planTier] || '';
  const subStatus  = org?.subscription_status || 'inactive';
  const statusCfg  = STATUS_CONFIG[subStatus] || STATUS_CONFIG.inactive;
  const StatusIcon = statusCfg.icon;

  const expiryStr = org?.subscription_expiry
    ? new Date(org.subscription_expiry).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  const isOwner = role === 'owner';
  const isActive = subStatus === 'active';
  const canCancel = isOwner && isActive;

  return (
    <div className="estudio-page">
      <div className="estudio-page-header">
        <h2 className="estudio-page-title">Suscripción</h2>
        <p className="estudio-page-subtitle">Gestión del plan Enterprise de {orgName}</p>
      </div>

      {success && (
        <div className="estudio-alert estudio-alert-success" role="alert">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
      {error && (
        <div className="estudio-alert estudio-alert-error" role="alert">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Estado actual */}
      <div className="estudio-sub-status-card">
        <div className="estudio-sub-status-row">
          <div className="estudio-sub-status-icon" style={{ color: statusCfg.color }}>
            <StatusIcon size={22} />
          </div>
          <div className="estudio-sub-status-info">
            <span className="estudio-sub-status-label">Estado</span>
            <span className="estudio-sub-status-value" style={{ color: statusCfg.color }}>
              {statusCfg.label}
            </span>
          </div>
        </div>

        <div className="estudio-sub-detail-grid">
          <div className="estudio-sub-detail-item">
            <span className="estudio-sub-detail-label">Plan</span>
            <span className="estudio-sub-detail-value">{planLabel}</span>
          </div>
          <div className="estudio-sub-detail-item">
            <span className="estudio-sub-detail-label">Precio</span>
            <span className="estudio-sub-detail-value">{planPrice}<small>/mes</small></span>
          </div>
          <div className="estudio-sub-detail-item">
            <span className="estudio-sub-detail-label">Miembros</span>
            <span className="estudio-sub-detail-value">{planMembers}</span>
          </div>
          {expiryStr && (
            <div className="estudio-sub-detail-item">
              <span className="estudio-sub-detail-label">
                <CalendarClock size={13} style={{ marginRight: 4 }} />
                {isActive ? 'Próximo cobro' : 'Acceso hasta'}
              </span>
              <span className="estudio-sub-detail-value">{expiryStr}</span>
            </div>
          )}
        </div>
      </div>

      {/* Acciones (solo owner) */}
      {isOwner && (
        <div className="estudio-sub-actions">
          {/* Sincronizar manualmente */}
          {!isActive && (
            <button className="estudio-btn estudio-btn-primary" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Sincronizando...' : 'Verificar estado de pago'}
            </button>
          )}

          {/* Cancelar (solo si activa) */}
          {canCancel && !showCancelConfirm && (
            <button
              className="estudio-btn estudio-btn-ghost estudio-btn-danger"
              onClick={() => setShowCancelConfirm(true)}
            >
              Cancelar suscripción
            </button>
          )}

          {/* Confirmación de cancelación */}
          {showCancelConfirm && (
            <div className="estudio-cancel-confirm">
              <p>¿Estás seguro? Mantendrás acceso hasta que venza el período actual ({expiryStr || 'fin del ciclo'}).</p>
              <div className="estudio-cancel-confirm-btns">
                <button
                  className="estudio-btn estudio-btn-danger"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
                </button>
                <button
                  className="estudio-btn estudio-btn-ghost"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={cancelling}
                >
                  Volver
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="estudio-sub-help">
        ¿Problemas con tu suscripción?{' '}
        <a href="mailto:soporte@judic-ia.com" className="estudio-link">Contactá a soporte</a>.
      </p>
    </div>
  );
}
