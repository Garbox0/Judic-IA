"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import {
  Activity,
  Plus,
  Loader2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  CalendarClock,
  Search,
  Play,
  Power,
  PowerOff,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react';
import './pjn-search.css';
import {
  CSJN_DEPENDENCIA_OPTIONS,
  buildCsjnFilterSummary,
  decodeCsjnAlertFilters,
  encodeCsjnAlertFilters,
  normalizeCsjnAlertFilters
} from '@/lib/csjnAlertFilters';

const PORTAL_OPTIONS = [
  { value: 'PJN', label: 'Nacion y Federal (PJN)' },
  { value: 'SCBA', label: 'Buenos Aires (SCBA)' },
  { value: 'CABA', label: 'Ciudad de Buenos Aires (CABA) — TSJ' },
  { value: 'CSJN_SORTEOS', label: 'Sorteos Federal (CSJN)' }
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Diaria (Lunes a Viernes)' },
  { value: 'weekly', label: 'Semanal' }
];

const ALERT_PACKS = [
  { id: 'alert_pack_1', credits: 1, amount: 8900, badge: null },
  { id: 'alert_pack_10', credits: 10, amount: 59000, badge: 'Popular' },
  { id: 'alert_pack_100', credits: 100, amount: 429000, badge: 'Mejor valor' }
];

function readErrorMessage(err, fallback = 'Error inesperado') {
  if (!err) return fallback;
  if (typeof err === 'string' && err.trim()) return err;
  if (typeof err.message === 'string' && err.message.trim()) return err.message;
  if (typeof err.details === 'string' && err.details.trim()) return err.details;
  if (typeof err.hint === 'string' && err.hint.trim()) return err.hint;
  try {
    const serialized = JSON.stringify(err);
    if (serialized && serialized !== '{}') return serialized;
  } catch {
    return fallback;
  }
  return fallback;
}

function normalizeApiAlertId(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') return raw.id || raw.alert_id || '';
  return '';
}

function mapAlertOperationError(err) {
  const text = readErrorMessage(err, 'Error desconocido');
  const up = text.toUpperCase();

  if (up.includes('ALERT_CREDITS_EXHAUSTED')) {
    return 'No tenes creditos de alerta disponibles. Compra un pack para continuar.';
  }
  if (up.includes('SUBSCRIPTION_REQUIRED')) {
    return 'Necesitas una suscripcion profesional activa para usar alertas.';
  }
  if (up.includes('QUERY_INVALIDA')) {
    return 'Debes ingresar un termino valido (minimo 3 caracteres).';
  }
  if (up.includes('PORTAL_PROXIMAMENTE')) {
    return 'Este portal estara disponible proximamente.';
  }
  if (up.includes('PORTAL_INVALIDO')) {
    return 'Portal invalido para crear alerta.';
  }
  if (up.includes('ALERT_NOT_FOUND')) {
    return 'No se encontro la alerta o no tienes permisos.';
  }
  if (up.includes('CREATE_CASE_ALERT')) {
    return 'Falta aplicar la migracion de funciones de alerta en base de datos.';
  }
  if (up.includes('CREATE_CASE_ALERT_FAILED')) {
    return 'No se pudo crear la alerta. Intenta nuevamente.';
  }
  if (up.includes('ALERT_CREDIT_DEBIT_FAILED')) {
    return 'No se pudo descontar el credito de alerta. Intenta nuevamente.';
  }
  if (up.includes('FREQUENCY_INVALIDA')) {
    return 'Frecuencia invalida para la alerta.';
  }
  if (up.includes('PROFILE_LOAD_FAILED')) {
    return 'No se pudo validar tu perfil para crear la alerta.';
  }
  if (up.includes('SET_CASE_ALERT_STATUS')) {
    return 'No se pudo actualizar el estado de la alerta.';
  }

  return text;
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('es-AR');
  } catch {
    return String(value);
  }
}

function formatArs(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '0';
  return amount.toLocaleString('es-AR');
}

function isFutureDate(value) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed > new Date();
}

function hasActivePaidSubscription(profile) {
  if (!profile) return false;
  if (profile.role === 'admin') return true;       // admin siempre habilitado
  if (profile.plan_tier === 'enterprise') return true;
  if (profile.plan_tier !== 'professional') return false;

  if (profile.subscription_status === 'active') {
    return isFutureDate(profile.subscription_expiry);
  }

  if (profile.subscription_status === 'past_due') {
    return isFutureDate(profile.grace_period_ends_at);
  }

  return false;
}

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isAdding, setIsAdding] = useState(false);
  const [portal, setPortal] = useState('CSJN_SORTEOS');
  const [jurisdiction, setJurisdiction] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [saving, setSaving] = useState(false);

  const [runMode, setRunMode] = useState('exact');
  const [runDate, setRunDate] = useState('');
  const [runFromDate, setRunFromDate] = useState('');
  const [runToDate, setRunToDate] = useState('');
  const [testingDraft, setTestingDraft] = useState(false);
  const [runningAlertId, setRunningAlertId] = useState('');
  const [testRun, setTestRun] = useState(null);

  const [csjnDependencyOfficeId, setCsjnDependencyOfficeId] = useState('');
  const [csjnIntervinienteName, setCsjnIntervinienteName] = useState('');
  const [csjnRoleDenunciante, setCsjnRoleDenunciante] = useState(true);
  const [csjnRoleDenunciado, setCsjnRoleDenunciado] = useState(true);

  const [alertCredits, setAlertCredits] = useState(0);
  const [alertCreditsSource, setAlertCreditsSource] = useState('individual'); // 'individual' | 'org'
  const [alertOrgName, setAlertOrgName] = useState(null);
  const [alertIsOrgOwner, setAlertIsOrgOwner] = useState(false);
  const [buyingAlertPack, setBuyingAlertPack] = useState('');
  const [isPackModalOpen, setIsPackModalOpen] = useState(false);
  const [canManageAlerts, setCanManageAlerts] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState('');
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const [historyByAlertId, setHistoryByAlertId] = useState({});
  const [loadingHistoryId, setLoadingHistoryId] = useState(null);
  const [matchesHistory, setMatchesHistory] = useState({});
  const [loadingMatchesId, setLoadingMatchesId] = useState(null);
  const [expandedMatchesId, setExpandedMatchesId] = useState(null);
  const successTimeoutRef = useRef(null);

  const hasCsjnDraft = portal === 'CSJN_SORTEOS';
  const hasCsjnAlerts = useMemo(
    () => alerts.some((item) => item.portal === 'CSJN_SORTEOS'),
    [alerts]
  );

  const buildDraftCsjnFilters = useCallback(() => {
    return normalizeCsjnAlertFilters({
      dependencyOfficeId: csjnDependencyOfficeId,
      dependencyLabel: CSJN_DEPENDENCIA_OPTIONS.find((item) => item.value === csjnDependencyOfficeId)?.label || '',
      intervinienteName: csjnIntervinienteName,
      roleDenunciante: csjnRoleDenunciante,
      roleDenunciado: csjnRoleDenunciado
    });
  }, [csjnDependencyOfficeId, csjnIntervinienteName, csjnRoleDenunciado, csjnRoleDenunciante]);

  const resetDraftCsjnFilters = useCallback(() => {
    setCsjnDependencyOfficeId('');
    setCsjnIntervinienteName('');
    setCsjnRoleDenunciante(true);
    setCsjnRoleDenunciado(true);
  }, []);

  const fetchAlertHistory = useCallback(async (alertId) => {
    if (historyByAlertId[alertId]) return; // already loaded
    setLoadingHistoryId(alertId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/research/alerts/${alertId}/history?limit=8`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.ok) {
        setHistoryByAlertId(prev => ({ ...prev, [alertId]: json.logs || [] }));
      }
    } catch { /* ignore */ } finally {
      setLoadingHistoryId(null);
    }
  }, [historyByAlertId]);

  const toggleHistory = useCallback((alertId) => {
    setExpandedAlertId(prev => {
      const next = prev === alertId ? null : alertId;
      if (next) fetchAlertHistory(alertId);
      return next;
    });
  }, [fetchAlertHistory]);

  const loadMatchesHistory = useCallback(async (alertId) => {
    if (matchesHistory[alertId]) {
      // already loaded — just toggle visibility
      setExpandedMatchesId(prev => prev === alertId ? null : alertId);
      return;
    }
    setLoadingMatchesId(alertId);
    setExpandedMatchesId(alertId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/research/alerts/${alertId}/matches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.ok) {
        setMatchesHistory(prev => ({ ...prev, [alertId]: { total: json.total || 0, matches: json.matches || [] } }));
      }
    } catch { /* ignore */ } finally {
      setLoadingMatchesId(null);
    }
  }, [matchesHistory]);

  const setTransientSuccess = useCallback((message, timeoutMs = 7000) => {
    setSuccess(message);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    successTimeoutRef.current = setTimeout(() => {
      setSuccess('');
      successTimeoutRef.current = null;
    }, timeoutMs);
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError('');

    // Show cached credits immediately to avoid perceived delay
    try {
      const cached = sessionStorage.getItem('alert_credits_cache');
      if (cached) {
        const c = JSON.parse(cached);
        setAlertCredits(c.credits ?? 0);
        setAlertCreditsSource(c.source || 'individual');
        setAlertOrgName(c.orgName || null);
        setAlertIsOrgOwner(c.isOrgOwner || false);
      }
    } catch { /* ignore */ }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAlerts([]);
        setAlertCredits(0);
        setCanManageAlerts(false);
        return;
      }

      // Fetch alerts, profile and credits in parallel
      const [
        { data: alertsData, error: alertsError },
        { data: profile, error: profileError },
        credRes,
      ] = await Promise.all([
        supabase.from('case_alerts').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('role, alert_credits_extra, subscription_status, plan_tier, subscription_expiry, grace_period_ends_at').eq('id', session.user.id).maybeSingle(),
        fetch('/api/alerts/credits', { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ]);

      if (alertsError) throw alertsError;
      setAlerts(alertsData || []);

      if (profileError) {
        const txt = readErrorMessage(profileError, '');
        if (!txt.toLowerCase().includes('alert_credits_extra')) {
          throw profileError;
        }
        setAlertCredits(0);
        setCanManageAlerts(false);
      } else {
        setCanManageAlerts(hasActivePaidSubscription(profile));

        // Process credits result
        try {
          if (credRes.ok) {
            const credData = await credRes.json();
            setAlertCredits(credData.credits ?? 0);
            setAlertCreditsSource(credData.source || 'individual');
            setAlertOrgName(credData.orgName || null);
            setAlertIsOrgOwner(credData.isOrgOwner || false);
            sessionStorage.setItem('alert_credits_cache', JSON.stringify(credData));
          } else {
            setAlertCredits(Number(profile?.alert_credits_extra || 0));
          }
        } catch {
          setAlertCredits(Number(profile?.alert_credits_extra || 0));
        }
      }
    } catch (err) {
      console.error('[AlertsPanel] fetch error:', err);
      setError('No se pudieron cargar tus alertas.');
      setCanManageAlerts(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const status = params.get('alert_credits');
    if (!status) return;

    if (status === 'ok') {
      setTransientSuccess('Creditos de alerta acreditados. Ya podes activar alertas por 30 dias.', 9000);
      setError('');
    } else if (status === 'pending') {
      setTransientSuccess('Pago de alertas pendiente. Los creditos se acreditaran en breve.', 9000);
      setError('');
    } else {
      setError('El pago no se completo. Intenta nuevamente.');
      setSuccess('');
    }

    fetchAlerts();

    params.delete('alert_credits');
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, [fetchAlerts, setTransientSuccess]);

  const handleBuyAlertPack = useCallback(async (packId) => {
    setError('');
    setSuccess('');

    if (!canManageAlerts) {
      setError('Necesitas una suscripcion profesional activa para comprar creditos de alerta.');
      return;
    }

    setBuyingAlertPack(packId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('No hay sesion activa.');

      // Owner de estudio verificado compra para el pool org, el resto compra individual
      const alertCreateEndpoint = alertCreditsSource === 'org' && alertIsOrgOwner
        ? '/api/mp/org-alerts/create'
        : '/api/mp/alerts/create';

      const response = await fetch(alertCreateEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ pack_id: packId })
      });

      const payload = await response.json();
      if (!response.ok || !payload?.init_point) {
        throw new Error(payload?.message || payload?.error || 'No se pudo iniciar la compra.');
      }

      window.open(payload.init_point, '_blank', 'noopener,noreferrer');
      setIsPackModalOpen(false);
      setTransientSuccess('Checkout de Mercado Pago abierto en una nueva pestana. Si cerras esa ventana, la compra no se acredita.', 6500);
    } catch (err) {
      setError('No se pudo iniciar la compra: ' + readErrorMessage(err));
    } finally {
      setBuyingAlertPack('');
    }
  }, [canManageAlerts, setTransientSuccess]);

  const runImmediateSearch = useCallback(async ({
    targetPortal,
    query,
    alertId = null,
    filters = null,
    date = null,
    fromDate = null,
    toDate = null
  }) => {
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) throw new Error('Debes ingresar un termino para buscar.');

    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error('No hay sesion activa.');

    const response = await fetch('/api/research/alerts/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        portal: targetPortal,
        query: cleanQuery,
        alertId,
        filters,
        date: date || null,
        fromDate: fromDate || null,
        toDate: toDate || null
      })
    });

    const payload = await response.json();
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'No se pudo ejecutar la corrida inmediata.');
    }

    setTestRun({
      ...payload,
      preview_query: cleanQuery,
      preview_alert_id: alertId || null,
      preview_filters: filters || null
    });

    return payload;
  }, []);

  const handleTestDraft = useCallback(async () => {
    setError('');
    setSuccess('');

    if (portal !== 'CSJN_SORTEOS') {
      setError('La corrida inmediata hoy esta habilitada para Sorteos Federal.');
      return;
    }

    if (!searchQuery.trim()) {
      setError('Debes ingresar una persona, empresa o termino.');
      return;
    }

    if (csjnIntervinienteName.trim() && !csjnRoleDenunciante && !csjnRoleDenunciado) {
      setError('Selecciona al menos un rol para interviniente.');
      return;
    }

    if (runMode === 'exact' && !runDate) {
      setError('Selecciona una fecha exacta para la corrida manual.');
      return;
    }

    if (runMode === 'range' && (!runFromDate || !runToDate)) {
      setError('Completa fecha desde y fecha hasta para rango.');
      return;
    }

    setTestingDraft(true);
    try {
      const filters = buildDraftCsjnFilters();
      await runImmediateSearch({
        targetPortal: portal,
        query: searchQuery,
        filters,
        date: runMode === 'exact' ? runDate : null,
        fromDate: runMode === 'range' ? runFromDate : null,
        toDate: runMode === 'range' ? runToDate : null
      });
      setSuccess('Corrida manual completada.');
    } catch (err) {
      setError(readErrorMessage(err));
    } finally {
      setTestingDraft(false);
    }
  }, [
    buildDraftCsjnFilters,
    csjnIntervinienteName,
    csjnRoleDenunciado,
    csjnRoleDenunciante,
    portal,
    runDate,
    runFromDate,
    runImmediateSearch,
    runMode,
    runToDate,
    searchQuery
  ]);

  const handleAddAlert = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!canManageAlerts) {
      setIsPackModalOpen(true);
      return;
    }

    const cleanQuery = searchQuery.trim();
    if (!cleanQuery || cleanQuery.length < 3) {
      setError('Debes ingresar un termino valido (minimo 3 caracteres).');
      return;
    }

    if (hasCsjnDraft && csjnIntervinienteName.trim() && !csjnRoleDenunciante && !csjnRoleDenunciado) {
      setError('Selecciona al menos un rol para interviniente.');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesion activa.');

      const encodedFilters = hasCsjnDraft
        ? encodeCsjnAlertFilters(buildDraftCsjnFilters())
        : null;

      const response = await fetch('/api/research/alerts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          portal,
          search_query: cleanQuery,
          frequency,
          jurisdiction: hasCsjnDraft ? null : (jurisdiction || null),
          fuero_id: encodedFilters || null
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'CREATE_CASE_ALERT_FAILED');
      }

      const createdAlertId = normalizeApiAlertId(payload?.alert);
      if (!createdAlertId) {
        throw new Error('CREATE_CASE_ALERT_FAILED');
      }

      if (typeof payload?.credits_left === 'number') {
        setAlertCredits(Number(payload.credits_left));
      }

      setSuccess('Alerta creada y activada por 30 dias.');
      setIsAdding(false);
      setSearchQuery('');
      setJurisdiction('');
      setFrequency('daily');
      resetDraftCsjnFilters();
      await fetchAlerts();
    } catch (err) {
      setError('Error al guardar la alerta: ' + mapAlertOperationError(err));
    } finally {
      setSaving(false);
    }
  }, [
    buildDraftCsjnFilters,
    fetchAlerts,
    frequency,
    hasCsjnDraft,
    jurisdiction,
    portal,
    resetDraftCsjnFilters,
    searchQuery,
    csjnIntervinienteName,
    csjnRoleDenunciante,
    csjnRoleDenunciado,
    canManageAlerts
  ]);

  const handleDelete = useCallback(async (id) => {
    setError('');
    setSuccess('');
    setConfirmDeleteId('');

    try {
      const { error: deleteError } = await supabase
        .from('case_alerts')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setAlerts((prev) => prev.filter((item) => item.id !== id));
      setSuccess('Alerta eliminada.');
    } catch (err) {
      setError('No se pudo eliminar la alerta: ' + mapAlertOperationError(err));
    }
  }, []);

  const handleToggle = useCallback(async (alertItem) => {
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase.rpc('set_case_alert_status', {
        p_alert_id: alertItem.id,
        p_activate: !alertItem.is_active
      });

      if (updateError) throw updateError;
      await fetchAlerts();
      setSuccess(alertItem.is_active ? 'Alerta pausada.' : 'Alerta activada.');
    } catch (err) {
      setError('No se pudo actualizar la alerta: ' + mapAlertOperationError(err));
    }
  }, [fetchAlerts]);

  const handleRunAlert = useCallback(async (alertItem) => {
    setError('');
    setSuccess('');
    setRunningAlertId(alertItem.id);

    try {
      const filters = decodeCsjnAlertFilters(alertItem.fuero_id || '') || null;

      await runImmediateSearch({
        targetPortal: alertItem.portal,
        query: alertItem.search_query || alertItem.query_value,
        alertId: alertItem.id,
        filters,
        date: runMode === 'exact' && alertItem.portal === 'CSJN_SORTEOS' ? runDate : null,
        fromDate: runMode === 'range' && alertItem.portal === 'CSJN_SORTEOS' ? runFromDate : null,
        toDate: runMode === 'range' && alertItem.portal === 'CSJN_SORTEOS' ? runToDate : null
      });

      setSuccess('Corrida manual ejecutada.');
      await fetchAlerts();
    } catch (err) {
      setError(readErrorMessage(err));
    } finally {
      setRunningAlertId('');
    }
  }, [fetchAlerts, runDate, runFromDate, runImmediateSearch, runMode, runToDate]);

  return (
    <section className="pjn-search-container alerts-panel" aria-labelledby="alerts-panel-title">
      <div className="pjn-search-header alerts-header">
        <div className="alerts-header-copy">
          <div className="pjn-search-title">
            <Activity size={22} aria-hidden="true" />
            <h3 id="alerts-panel-title">Motor de Vigilancia de Expedientes</h3>
          </div>
          <p className="pjn-search-subtitle" id="alerts-panel-description">
            Configura busquedas automaticas. El sistema revisa novedades y detecta coincidencias por expediente, persona o empresa.
          </p>

          <p className="alerts-credits" aria-live="polite">
            {alertCreditsSource === 'org'
              ? <>Pool del estudio {alertOrgName ? `(${alertOrgName})` : ''}: <strong>{alertCredits}</strong></>
              : <>Creditos de alerta disponibles: <strong>{alertCredits}</strong></>
            }
          </p>
          <p className="alerts-credits-note">
            Cada credito activa 1 alerta por 30 dias.
          </p>
          <div className="alerts-pack-list">
            {alertCreditsSource === 'org' ? (
              alertIsOrgOwner ? (
                <button
                  type="button"
                  className="alerts-pack-btn alerts-pack-open-btn"
                  onClick={() => setIsPackModalOpen(true)}
                >
                  Comprar para el estudio
                </button>
              ) : (
                <span className="alerts-credits-note">El titular compra créditos para el estudio.</span>
              )
            ) : (
              <button
                type="button"
                className="alerts-pack-btn alerts-pack-open-btn"
                onClick={() => setIsPackModalOpen(true)}
              >
                Comprar creditos de alerta
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          className="pjn-submit-btn alerts-new-btn"
          onClick={() => canManageAlerts ? setIsAdding((prev) => !prev) : setIsPackModalOpen(true)}
        >
          <Plus size={16} aria-hidden="true" /> {isAdding ? 'Cerrar' : 'Nueva Alerta'}
        </button>
      </div>

      {error && (
        <div className="pjn-error alerts-feedback" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="pjn-error alerts-feedback alerts-feedback-success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{success}</span>
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAddAlert} className="pjn-search-form alerts-create-form" aria-describedby="alerts-panel-description">
          <h4 className="alerts-form-title">
            <Search size={16} aria-hidden="true" /> Configurar Nueva Alerta
          </h4>

          <div className="pjn-fields alerts-form-fields">
            <div className="pjn-field">
              <label htmlFor="alerts_portal">Portal Base</label>
              <select
                id="alerts_portal"
                value={portal}
                onChange={(e) => setPortal(e.target.value)}
              >
                {PORTAL_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value} disabled={item.disabled}>{item.label}</option>
                ))}
              </select>
            </div>

            {portal !== 'CSJN_SORTEOS' && (
              <div className="pjn-field">
                <label htmlFor="alerts_jurisdiction">Jurisdiccion / Fuero (opcional)</label>
                <input
                  id="alerts_jurisdiction"
                  type="text"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  placeholder="Ej: Laboral, Federal, Penal..."
                />
              </div>
            )}

            <div className="pjn-field pjn-field-full">
              <label htmlFor="alerts_query">Persona / Empresa / Termino a vigilar</label>
              <input
                id="alerts_query"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ej: Perez Juan o Mercado Libre SRL"
                required
              />
            </div>

            {hasCsjnDraft && (
              <>
                <div className="pjn-field">
                  <label htmlFor="alerts_csjn_office">Dependencia asignada (opcional)</label>
                  <select
                    id="alerts_csjn_office"
                    value={csjnDependencyOfficeId}
                    onChange={(e) => setCsjnDependencyOfficeId(e.target.value)}
                  >
                    <option value="">Todas</option>
                    {CSJN_DEPENDENCIA_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>

                <div className="pjn-field">
                  <label htmlFor="alerts_csjn_interviniente">Interviniente (opcional)</label>
                  <input
                    id="alerts_csjn_interviniente"
                    type="text"
                    value={csjnIntervinienteName}
                    onChange={(e) => setCsjnIntervinienteName(e.target.value)}
                    placeholder="Apellido y/o nombre"
                  />
                </div>

                <div className="pjn-field pjn-field-full alerts-role-row">
                  <span className="alerts-role-label">Rol del interviniente</span>
                  <label className="alerts-role-check" htmlFor="alerts_role_denunciante">
                    <input
                      id="alerts_role_denunciante"
                      type="checkbox"
                      checked={csjnRoleDenunciante}
                      onChange={(e) => setCsjnRoleDenunciante(e.target.checked)}
                    />
                    Denunciante
                  </label>
                  <label className="alerts-role-check" htmlFor="alerts_role_denunciado">
                    <input
                      id="alerts_role_denunciado"
                      type="checkbox"
                      checked={csjnRoleDenunciado}
                      onChange={(e) => setCsjnRoleDenunciado(e.target.checked)}
                    />
                    Denunciado
                  </label>
                </div>
              </>
            )}

            <div className="pjn-field">
              <label htmlFor="alerts_frequency">Frecuencia de revision</label>
              <select
                id="alerts_frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                {FREQUENCY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>

          {hasCsjnDraft && (
            <fieldset className="alerts-run-mode-fieldset">
              <legend className="alerts-run-mode-legend">Corrida manual inmediata</legend>

              <div className="alerts-run-mode-toggle">
                <button
                  type="button"
                  className={`alerts-run-mode-btn ${runMode === 'exact' ? 'active' : ''}`}
                  onClick={() => setRunMode('exact')}
                >
                  Fecha exacta
                </button>
                <button
                  type="button"
                  className={`alerts-run-mode-btn ${runMode === 'range' ? 'active' : ''}`}
                  onClick={() => setRunMode('range')}
                >
                  Rango
                </button>
              </div>

              {runMode === 'exact' ? (
                <div className="alerts-run-date-field">
                  <label htmlFor="alerts_run_date" className="sr-only">Fecha exacta</label>
                  <input
                    id="alerts_run_date"
                    type="date"
                    className="alerts-date-input"
                    value={runDate}
                    onChange={(e) => setRunDate(e.target.value)}
                  />
                </div>
              ) : (
                <div className="alerts-run-date-range">
                  <div className="alerts-run-date-field">
                    <label htmlFor="alerts_run_from" className="sr-only">Fecha desde</label>
                    <input
                      id="alerts_run_from"
                      type="date"
                      className="alerts-date-input"
                      value={runFromDate}
                      onChange={(e) => setRunFromDate(e.target.value)}
                    />
                  </div>
                  <div className="alerts-run-date-field">
                    <label htmlFor="alerts_run_to" className="sr-only">Fecha hasta</label>
                    <input
                      id="alerts_run_to"
                      type="date"
                      className="alerts-date-input"
                      value={runToDate}
                      onChange={(e) => setRunToDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </fieldset>
          )}

          <div className="pjn-actions alerts-form-actions">
            <button type="button" className="pjn-reset-btn" onClick={() => setIsAdding(false)}>
              Cancelar
            </button>

            {hasCsjnDraft && (
              <button
                type="button"
                className="pjn-reset-btn alerts-search-now-btn"
                onClick={handleTestDraft}
                disabled={testingDraft}
              >
                {testingDraft ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Search size={15} aria-hidden="true" />}
                Buscar ahora
              </button>
            )}

            <button type="submit" className="pjn-submit-btn" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
              {saving ? 'Guardando...' : 'Guardar y Activar Alerta'}
            </button>
          </div>
        </form>
      )}

      {testRun && (
        <div className={`alerts-test-run ${isAdding ? 'with-form' : ''}`}>
          <div className="alerts-test-run-head">
            <strong className="alerts-test-run-title">
              Corrida completada: {testRun.new_matches_total ?? testRun.matches_total ?? 0} nuevo(s)
            </strong>
            <span className="alerts-test-run-time">{formatDate(testRun.run_at)}</span>
          </div>

          {testRun?.preview_filters && (
            <div className="alerts-test-run-filter">
              Filtros: {buildCsjnFilterSummary(testRun.preview_filters) || 'Sin filtros'}
            </div>
          )}

          <div className="alerts-test-run-meta">
            Coincidencias: {testRun.matches_total || 0} | Dataset evaluado: {testRun.scoped_dataset_total || testRun.dataset_total || 0}
          </div>

          {(testRun.new_matches || testRun.matches || []).length > 0 ? (
            <div className="alerts-test-run-list">
              {(testRun.new_matches || testRun.matches).slice(0, 10).map((item) => (
                <div className="alerts-test-run-item" key={item.id || `${item.expediente}-${item.assigned_date}`}>
                  <div className="alerts-test-run-item-title">
                    {item.expediente || 'Expediente'} - {item.match_score || 0}%
                  </div>
                  <div className="alerts-test-run-item-meta">
                    {item.assigned_date || '-'} | {item.dependencia_asignada || 'Dependencia no informada'}
                  </div>
                  <div className="alerts-test-run-item-meta">
                    Denunciados: {item.denunciados || '-'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="alerts-test-run-empty">No hubo coincidencias en la corrida actual.</p>
          )}
        </div>
      )}

      <div className="alerts-list-container">
        <div className="alerts-list-header">
          <h4 className="alerts-list-title">Tus alertas</h4>

          {hasCsjnAlerts && (
            <fieldset className="alerts-manual-run">
              <label className="alerts-manual-run-label">Corrida manual</label>
              <button
                type="button"
                className={`alerts-run-mode-btn alerts-run-mode-btn-compact ${runMode === 'exact' ? 'active' : ''}`}
                onClick={() => setRunMode('exact')}
              >
                Exacta
              </button>
              <button
                type="button"
                className={`alerts-run-mode-btn alerts-run-mode-btn-compact ${runMode === 'range' ? 'active' : ''}`}
                onClick={() => setRunMode('range')}
              >
                Rango
              </button>

              {runMode === 'exact' ? (
                <input
                  type="date"
                  className="alerts-date-input"
                  value={runDate}
                  onChange={(e) => setRunDate(e.target.value)}
                  aria-label="Fecha exacta para corrida"
                />
              ) : (
                <>
                  <input
                    type="date"
                    className="alerts-date-input"
                    value={runFromDate}
                    onChange={(e) => setRunFromDate(e.target.value)}
                    aria-label="Fecha desde para corrida"
                  />
                  <input
                    type="date"
                    className="alerts-date-input"
                    value={runToDate}
                    onChange={(e) => setRunToDate(e.target.value)}
                    aria-label="Fecha hasta para corrida"
                  />
                </>
              )}
            </fieldset>
          )}
        </div>

        {!hasCsjnAlerts && (
          <p className="alerts-list-hint">El modo manual por fecha aparece cuando tengas alertas CSJN.</p>
        )}

        {loading ? (
          <div className="alerts-loading">
            <Loader2 className="animate-spin" size={22} aria-hidden="true" />
            <p>Cargando alertas...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="pjn-empty alerts-empty">
            <CalendarClock size={34} aria-hidden="true" />
            <p>No tenes alertas configuradas por ahora.</p>
            <button
              type="button"
              className="alerts-empty-action"
              onClick={() => canManageAlerts ? setIsAdding(true) : setIsPackModalOpen(true)}
            >
              Crear tu primera alerta
            </button>
          </div>
        ) : (
          <div className="alerts-list">
            {alerts.map((alertItem) => {
              const csjnFilters = decodeCsjnAlertFilters(alertItem.fuero_id || '') || null;
              const filterSummary = csjnFilters ? buildCsjnFilterSummary(csjnFilters) : '';
              const portalLabel = PORTAL_OPTIONS.find((item) => item.value === alertItem.portal)?.label || alertItem.portal;

              return (
                <article
                  key={alertItem.id}
                  className={`alerts-card ${alertItem.is_active ? 'is-active' : ''}`}
                  aria-label={`Alerta ${alertItem.search_query || alertItem.query_value}`}
                >
                  <div className="alerts-card-main">
                    <div className="alerts-card-title-row">
                      <Activity className={`alerts-card-icon ${alertItem.is_active ? 'active' : ''}`} size={16} aria-hidden="true" />
                      <h5 className="alerts-card-title">{alertItem.search_query || alertItem.query_value || 'Alerta'}</h5>
                      <span className="alerts-card-status">{alertItem.is_active ? 'Activa' : 'Pausada'}</span>
                    </div>

                    <div className="alerts-card-meta">
                      <span>{portalLabel}</span>
                      <span>{alertItem.frequency === 'weekly' ? 'Semanal' : 'Diaria'}</span>
                      <span>Creada: {formatDate(alertItem.created_at)}</span>
                    </div>

                    {filterSummary && <div className="alerts-card-filter">{filterSummary}</div>}

                    <div className="alerts-card-stat">
                      <span className="alerts-card-stat-run">Ultima corrida: {formatDate(alertItem.last_run_at)}</span>
                      {' | '}
                      <span className="alerts-card-stat-matches">Coincidencias: {alertItem.last_result_count || 0}</span>
                      {' | '}
                      <span className="alerts-card-stat-new">Nuevas: {alertItem.last_new_count || 0}</span>
                    </div>
                  </div>

                  {/* Historial botón */}
                  <div className="alerts-card-actions">
                    <button
                      type="button"
                      className={`alerts-action-btn alerts-action-history ${expandedAlertId === alertItem.id ? 'active' : ''}`}
                      onClick={() => toggleHistory(alertItem.id)}
                      aria-expanded={expandedAlertId === alertItem.id}
                      aria-label="Ver historial de ejecuciones"
                    >
                      {loadingHistoryId === alertItem.id
                        ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                        : expandedAlertId === alertItem.id
                          ? <ChevronUp size={13} aria-hidden="true" />
                          : <ChevronDown size={13} aria-hidden="true" />
                      }
                      Historial
                    </button>

                    <button
                      type="button"
                      className="alerts-action-btn alerts-action-run"
                      onClick={() => handleRunAlert(alertItem)}
                      disabled={runningAlertId === alertItem.id}
                      aria-label={`Probar alerta: ${alertItem.search_query || alertItem.query_value}`}
                    >
                      {runningAlertId === alertItem.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                      Probar
                    </button>

                    <button
                      type="button"
                      className="alerts-action-btn alerts-action-toggle"
                      onClick={() => handleToggle(alertItem)}
                      aria-label={`${alertItem.is_active ? 'Pausar' : 'Activar'} alerta: ${alertItem.search_query || alertItem.query_value}`}
                    >
                      {alertItem.is_active ? <PowerOff size={14} aria-hidden="true" /> : <Power size={14} aria-hidden="true" />}
                      {alertItem.is_active ? 'Pausar' : 'Activar'}
                    </button>

                    {confirmDeleteId === alertItem.id ? (
                      <div className="alerts-confirm-delete" role="group" aria-label="Confirmar eliminacion">
                        <span className="alerts-confirm-label">¿Eliminar?</span>
                        <button
                          type="button"
                          className="alerts-confirm-yes"
                          onClick={() => handleDelete(alertItem.id)}
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          className="alerts-confirm-no"
                          onClick={() => setConfirmDeleteId('')}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="alerts-action-delete"
                        onClick={() => setConfirmDeleteId(alertItem.id)}
                        aria-label={`Eliminar alerta: ${alertItem.search_query || alertItem.query_value}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* Panel de historial expandible */}
                  {expandedAlertId === alertItem.id && (
                    <div className="alerts-history-panel" role="region" aria-label="Historial de ejecuciones">
                      {loadingHistoryId === alertItem.id ? (
                        <div className="alerts-history-loading">
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                          <span>Cargando historial...</span>
                        </div>
                      ) : !historyByAlertId[alertItem.id] || historyByAlertId[alertItem.id].length === 0 ? (
                        <p className="alerts-history-empty">
                          <Clock size={14} aria-hidden="true" /> Esta alerta todavía no tiene ejecuciones registradas.
                        </p>
                      ) : (
                        <table className="alerts-history-table" aria-label="Ejecuciones de la alerta">
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Estado</th>
                              <th>Coincidencias</th>
                              <th>Nuevas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyByAlertId[alertItem.id].map(log => (
                              <>
                                <tr key={log.id} className={log.has_error ? 'alerts-history-row-error' : ''}>
                                  <td>{formatDate(log.ran_at)}</td>
                                  <td>
                                    {log.has_error
                                      ? <span className="alerts-history-status-err" title={log.error_short || ''}>❌ Error</span>
                                      : <span className="alerts-history-status-ok">✔️ OK</span>
                                    }
                                  </td>
                                  <td>{log.results_found ?? '-'}</td>
                                  <td>
                                    {log.new_count !== null
                                      ? <strong className={log.new_count > 0 ? 'alerts-history-new-highlight' : ''}>{log.new_count}</strong>
                                      : '-'
                                    }
                                  </td>
                                </tr>
                                {log.samples?.length > 0 && (
                                  <tr key={`${log.id}-samples`} className="alerts-history-samples-row">
                                    <td colSpan={4}>
                                      <ul className="alerts-history-samples">
                                        {log.samples.map((s, i) => (
                                          <li key={i} className="alerts-history-sample-item">
                                            <span className="alerts-history-sample-exp">{s.expediente}</span>
                                            <span className="alerts-history-sample-car">{s.caratula}</span>
                                            {s.link && (
                                              <a href={s.link} target="_blank" rel="noopener noreferrer" className="alerts-history-sample-link">Ver →</a>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </td>
                                  </tr>
                                )}
                              </>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Historial completo de expedientes detectados */}
                      <div className="alerts-matches-history-section">
                        <div className="alerts-matches-history-header">
                          <span className="alerts-matches-history-label">Historial de expedientes detectados</span>
                          <button
                            type="button"
                            className="alerts-matches-history-btn"
                            onClick={() => loadMatchesHistory(alertItem.id)}
                            disabled={loadingMatchesId === alertItem.id}
                            aria-expanded={expandedMatchesId === alertItem.id}
                          >
                            {loadingMatchesId === alertItem.id
                              ? <><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Cargando...</>
                              : expandedMatchesId === alertItem.id
                                ? 'Ocultar historial'
                                : 'Ver todos los expedientes detectados \u2192'
                            }
                          </button>
                        </div>

                        {expandedMatchesId === alertItem.id && matchesHistory[alertItem.id] && (
                          <div className="alerts-matches-history" role="region" aria-label="Expedientes detectados">
                            {matchesHistory[alertItem.id].matches.length === 0 ? (
                              <p className="alerts-matches-empty">Todavía no hay expedientes detectados para esta alerta.</p>
                            ) : (
                              <>
                                <p className="alerts-matches-total">
                                  {matchesHistory[alertItem.id].total} expediente(s) detectado(s) en total
                                </p>
                                <div className="alerts-matches-table-wrap">
                                  <table className="alerts-matches-table" aria-label="Expedientes detectados">
                                    <thead>
                                      <tr>
                                        <th>Fecha</th>
                                        <th>Expediente</th>
                                        <th>Carátula</th>
                                        <th>Ver</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {matchesHistory[alertItem.id].matches.map((match) => (
                                        <tr key={match.id} className="alerts-matches-row">
                                          <td className="alerts-matches-cell-date">{formatDate(match.found_at)}</td>
                                          <td className="alerts-matches-cell-exp">{match.expediente || '-'}</td>
                                          <td className="alerts-matches-cell-car">{match.caratula || '-'}</td>
                                          <td className="alerts-matches-cell-link">
                                            {match.link
                                              ? <a href={match.link} target="_blank" rel="noopener noreferrer" className="alerts-history-sample-link">Ver →</a>
                                              : <span className="alerts-matches-no-link">—</span>
                                            }
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {isPackModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="alerts-pack-modal-overlay quota-modal-overlay"
          onClick={() => setIsPackModalOpen(false)}
        >
          <div
            className="alerts-pack-modal-card quota-modal-card quota-modal-packs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alerts-pack-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="alerts-pack-modal-icon quota-icon-circle" aria-hidden="true">
              <span className="quota-icon-emoji">+</span>
            </div>
            <h4 id="alerts-pack-modal-title" className="alerts-pack-modal-title quota-title">
              Paquetes unicos de alertas
            </h4>
            <p className="alerts-pack-modal-subtitle quota-desc">
              1 credito = 1 alerta activa por 30 dias. Los creditos extra no vencen.
            </p>

            {!canManageAlerts ? (
              <div className="credits-no-sub">
                <p>Necesitas una suscripcion profesional activa para comprar creditos de alerta.</p>
                <button
                  type="button"
                  className="btn-quota-pro"
                  onClick={() => {
                    setIsPackModalOpen(false);
                    window.location.href = '/dashboard/settings?tab=billing';
                  }}
                >
                  Ver plan profesional
                </button>
              </div>
            ) : (
              <>
                <div className="alerts-pack-grid credit-packs-grid">
                  {ALERT_PACKS.map((pack) => (
                    <button
                      key={pack.id}
                      type="button"
                      className={`alerts-pack-card credit-pack-card ${buyingAlertPack === pack.id ? 'loading' : ''}`}
                      disabled={Boolean(buyingAlertPack)}
                      onClick={() => handleBuyAlertPack(pack.id)}
                    >
                      {pack.badge && <span className="alerts-pack-badge pack-badge">{pack.badge}</span>}
                      <span className="alerts-pack-credits pack-credits">{pack.credits}</span>
                      <span className="alerts-pack-label pack-label">alertas / 30 dias</span>
                      <span className="alerts-pack-price pack-price">$ {formatArs(pack.amount)} ARS</span>
                      {buyingAlertPack === pack.id && <Loader2 size={15} className="animate-spin alerts-pack-spinner pack-spinner" aria-hidden="true" />}
                    </button>
                  ))}
                </div>

                <p className="alerts-pack-modal-note quota-reset-note">
                  Ideal para sumar sujetos monitoreados sin cambiar tu suscripcion mensual.
                </p>
              </>
            )}

            <div className="alerts-pack-modal-actions quota-actions">
              <button
                type="button"
                className="btn-quota-cancel"
                onClick={() => setIsPackModalOpen(false)}
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
