"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  PowerOff
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
  { value: 'CABA', label: 'Ciudad de Buenos Aires (CABA)' },
  { value: 'CSJN_SORTEOS', label: 'Sorteos Federal (CSJN)' }
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Diaria (Lunes a Viernes)' },
  { value: 'weekly', label: 'Semanal' }
];

const ALERT_PACKS = [
  { id: 'alert_pack_3', label: 'Comprar 3 alertas' },
  { id: 'alert_pack_10', label: 'Comprar 10 alertas' },
  { id: 'alert_pack_25', label: 'Comprar 25 alertas' }
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

function normalizeRpcAlertId(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && raw[0]) {
    if (typeof raw[0] === 'string') return raw[0];
    if (typeof raw[0] === 'object') return raw[0].id || raw[0].alert_id || '';
  }
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
    return 'Necesitas una suscripcion activa para usar alertas.';
  }
  if (up.includes('QUERY_INVALIDA')) {
    return 'Debes ingresar un termino valido (minimo 3 caracteres).';
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
  const [buyingAlertPack, setBuyingAlertPack] = useState('');

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

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAlerts([]);
        setAlertCredits(0);
        return;
      }

      const { data: alertsData, error: alertsError } = await supabase
        .from('case_alerts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (alertsError) throw alertsError;
      setAlerts(alertsData || []);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('alert_credits_extra')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        const txt = readErrorMessage(profileError, '');
        if (!txt.toLowerCase().includes('alert_credits_extra')) {
          throw profileError;
        }
        setAlertCredits(0);
      } else {
        setAlertCredits(Number(profile?.alert_credits_extra || 0));
      }
    } catch (err) {
      console.error('[AlertsPanel] fetch error:', err);
      setError('No se pudieron cargar tus alertas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleBuyAlertPack = useCallback(async (packId) => {
    setError('');
    setSuccess('');
    setBuyingAlertPack(packId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('No hay sesion activa.');

      const response = await fetch('/api/mp/alerts/create', {
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
    } catch (err) {
      setError('No se pudo iniciar la compra: ' + readErrorMessage(err));
    } finally {
      setBuyingAlertPack('');
    }
  }, []);

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

      const { data: createdAlertRaw, error: createError } = await supabase.rpc('create_case_alert', {
        p_portal: portal,
        p_search_query: cleanQuery,
        p_frequency: frequency,
        p_jurisdiction: hasCsjnDraft ? null : (jurisdiction || null)
      });

      if (createError) throw createError;

      const createdAlertId = normalizeRpcAlertId(createdAlertRaw);
      if (createdAlertId && hasCsjnDraft) {
        const encodedFilters = encodeCsjnAlertFilters(buildDraftCsjnFilters());
        if (encodedFilters) {
          const { error: updateError } = await supabase
            .from('case_alerts')
            .update({ fuero_id: encodedFilters })
            .eq('id', createdAlertId)
            .eq('user_id', session.user.id);

          if (updateError) {
            console.error('[AlertsPanel] No se pudieron guardar filtros CSJN:', updateError);
          }
        }
      }

      setSuccess('Alerta creada y activada.');
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
    csjnRoleDenunciado
  ]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Seguro que deseas eliminar esta alerta?')) return;

    setError('');
    setSuccess('');

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
            Creditos de alerta disponibles: <strong>{alertCredits}</strong>
          </p>
          <div className="alerts-pack-list">
            {ALERT_PACKS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                className="alerts-pack-btn"
                onClick={() => handleBuyAlertPack(pack.id)}
                disabled={buyingAlertPack === pack.id}
              >
                {buyingAlertPack === pack.id ? 'Procesando...' : pack.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="pjn-submit-btn alerts-new-btn"
          onClick={() => setIsAdding((prev) => !prev)}
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
                  <option key={item.value} value={item.value}>{item.label}</option>
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
          <h4 className="alerts-list-title">Tus alertas activas</h4>

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
            <button type="button" className="alerts-empty-action" onClick={() => setIsAdding(true)}>
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

                  <div className="alerts-card-actions">
                    <button
                      type="button"
                      className="alerts-action-btn alerts-action-run"
                      onClick={() => handleRunAlert(alertItem)}
                      disabled={runningAlertId === alertItem.id}
                    >
                      {runningAlertId === alertItem.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                      Probar
                    </button>

                    <button
                      type="button"
                      className="alerts-action-btn alerts-action-toggle"
                      onClick={() => handleToggle(alertItem)}
                    >
                      {alertItem.is_active ? <PowerOff size={14} aria-hidden="true" /> : <Power size={14} aria-hidden="true" />}
                      {alertItem.is_active ? 'Pausar' : 'Activar'}
                    </button>

                    <button
                      type="button"
                      className="alerts-action-delete"
                      onClick={() => handleDelete(alertItem.id)}
                      aria-label="Eliminar alerta"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
