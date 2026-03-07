"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search,
  Loader2,
  FileText,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Building2,
  Hash,
  Calendar,
  User,
  Eye,
  ChevronDown,
  ChevronUp,
  Clock3,
  FolderPlus,
  CheckCircle2,
  Coins,
  XCircle,
  ShoppingCart,
  Download
} from 'lucide-react';
import { getPjnParteTypeRule, resolvePjnParteType } from '@/lib/pjnParteRules';
import './pjn-search.css';

const JURISDICTIONS = [
  { value: '', label: 'Seleccionar camara...' },
  { value: '0', label: 'CSJ - Corte Suprema de Justicia de la Nacion' },
  { value: '1', label: 'CIV - Camara Nacional de Apelaciones en lo Civil' },
  { value: '2', label: 'CAF - Camara Nacional de Apelaciones en lo Contencioso Administrativo Federal' },
  { value: '3', label: 'CCF - Camara Nacional de Apelaciones en lo Civil y Comercial Federal' },
  { value: '4', label: 'CNE - Camara Nacional Electoral' },
  { value: '5', label: 'CSS - Camara Federal de la Seguridad Social' },
  { value: '6', label: 'CPE - Camara Nacional de Apelaciones en lo Penal Economico' },
  { value: '7', label: 'CNT - Camara Nacional de Apelaciones del Trabajo' },
  { value: '8', label: 'CFP - Camara Criminal y Correccional Federal' },
  { value: '9', label: 'CCC - Camara Nacional de Apelaciones en lo Criminal y Correccional' },
  { value: '10', label: 'COM - Camara Nacional de Apelaciones en lo Comercial' },
  { value: '11', label: 'CPF - Camara Federal de Casacion Penal' },
  { value: '12', label: 'CPN - Camara Nacional Casacion Penal' },
  { value: '13', label: 'FBB - Justicia Federal de Bahia Blanca' },
  { value: '14', label: 'FCR - Justicia Federal de Comodoro Rivadavia' },
  { value: '15', label: 'FCB - Justicia Federal de Cordoba' },
  { value: '16', label: 'FCT - Justicia Federal de Corrientes' },
  { value: '17', label: 'FGR - Justicia Federal de General Roca' },
  { value: '18', label: 'FLP - Justicia Federal de La Plata' },
  { value: '19', label: 'FMP - Justicia Federal de Mar del Plata' },
  { value: '20', label: 'FMZ - Justicia Federal de Mendoza' },
  { value: '21', label: 'FPO - Justicia Federal de Posadas' },
  { value: '22', label: 'FPA - Justicia Federal de Parana' },
  { value: '23', label: 'FRE - Justicia Federal de Resistencia' },
  { value: '24', label: 'FSA - Justicia Federal de Salta' },
  { value: '25', label: 'FRO - Justicia Federal de Rosario' },
  { value: '26', label: 'FSM - Justicia Federal de San Martin' },
  { value: '27', label: 'FTU - Justicia Federal de Tucuman' }
];

const PARTE_TYPES = [
  { value: '', label: 'Todos' },
  { value: 'ACTOR', label: 'ACTOR' },
  { value: 'AFILIADO', label: 'AFILIADO' },
  { value: 'AGRUPACION POLITICA', label: 'AGRUPACION POLITICA' },
  { value: 'AMICUS CURIAE', label: 'AMICUS CURIAE' },
  { value: 'AUTORIDAD DE MESA', label: 'AUTORIDAD DE MESA' },
  { value: 'AUTORIDAD PARTIDARIA', label: 'AUTORIDAD PARTIDARIA' },
  { value: 'CANDIDATO', label: 'CANDIDATO' },
  { value: 'CAUSANTE', label: 'CAUSANTE' },
  { value: 'CIUDADANO', label: 'CIUDADANO' },
  { value: 'CONCURSADO', label: 'CONCURSADO' },
  { value: 'CUERPO COLEGIADO', label: 'CUERPO COLEGIADO' },
  { value: 'DAMNIFICADO', label: 'DAMNIFICADO' },
  { value: 'DEMANDADO', label: 'DEMANDADO' },
  { value: 'DENUNCIADO', label: 'DENUNCIADO' },
  { value: 'DENUNCIANTE', label: 'DENUNCIANTE' },
  { value: 'EJECUTADO/S', label: 'EJECUTADO/S' },
  { value: 'EJECUTANTE/S', label: 'EJECUTANTE/S' },
  { value: 'EMPLEADO PUBLICO', label: 'EMPLEADO PUBLICO' },
  { value: 'FALLIDO', label: 'FALLIDO' },
  { value: 'FUNCIONARIO PUBLICO', label: 'FUNCIONARIO PUBLICO' },
  { value: 'HEREDERO/S', label: 'HEREDERO/S' },
  { value: 'IMPUTADO', label: 'IMPUTADO' },
  { value: 'INCIDENTISTA', label: 'INCIDENTISTA' },
  { value: 'INTERVENTOR JUDICIAL', label: 'INTERVENTOR JUDICIAL' },
  { value: 'INTERVENTOR PARTIDARIO', label: 'INTERVENTOR PARTIDARIO' },
  { value: 'JUNTA ELECTORAL PARTIDARIA', label: 'JUNTA ELECTORAL PARTIDARIA' },
  { value: 'LISTA DE CANDIDATOS PARTIDARIOS', label: 'LISTA DE CANDIDATOS PARTIDARIOS' },
  { value: 'LISTA DE PRECANDIDATOS O CANDIDATOS', label: 'LISTA DE PRECANDIDATOS O CANDIDATOS' },
  { value: 'ONG', label: 'ONG' },
  { value: 'ORGANISMO PUBLICO', label: 'ORGANISMO PUBLICO' },
  { value: 'PETICIONANTE', label: 'PETICIONANTE' },
  { value: 'PRECANDIDATO', label: 'PRECANDIDATO' },
  { value: 'PRESUNTO FALLIDO', label: 'PRESUNTO FALLIDO' },
  { value: 'QUERELLANTE', label: 'QUERELLANTE' },
  { value: 'REQUERIDO', label: 'REQUERIDO' },
  { value: 'REQUIRENTE', label: 'REQUIRENTE' },
  { value: 'SINDICO', label: 'SINDICO' },
  { value: 'SOLICITANTE', label: 'SOLICITANTE' },
  { value: 'TERCERO AUTONOMO/PRINCIPAL', label: 'TERCERO AUTONOMO/PRINCIPAL' },
  { value: 'VOLUNTARIO', label: 'VOLUNTARIO' }
];

const PAGE_SIZE = 20;
const DETAIL_PAGE_SIZE = 20;

function readErrorMessage(err, fallback = 'Error inesperado') {
  if (!err) return fallback;
  if (typeof err === 'string' && err.trim()) return err;
  if (typeof err.message === 'string' && err.message.trim()) return err.message;
  return fallback;
}

function parseExpediente(expedienteRaw = '') {
  const text = String(expedienteRaw || '').replace(/\s+/g, ' ').trim();
  const match = text.match(/^([A-Z]{2,6})?\s*([0-9]{1,7})\/(\d{4})/i);
  if (!match) return null;
  return {
    prefix: (match[1] || '').toUpperCase(),
    numero: match[2],
    anio: match[3]
  };
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('es-AR');
  } catch {
    return String(value);
  }
}

export default function PJNSearchPanel() {
  const [searchType, setSearchType] = useState('parte');
  const [jurisdiction, setJurisdiction] = useState('');
  const [numero, setNumero] = useState('');
  const [anio, setAnio] = useState('');
  const [nombre, setNombre] = useState('');
  const [parteTipo, setParteTipo] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState(null);
  const [page, setPage] = useState(1);
  const [simulatedProgress, setSimulatedProgress] = useState(0);

  const [expandedRowKey, setExpandedRowKey] = useState('');
  const [detailLoadingKey, setDetailLoadingKey] = useState('');
  const [detailErrorByKey, setDetailErrorByKey] = useState({});
  const [detailByKey, setDetailByKey] = useState({});
  const [detailPageByKey, setDetailPageByKey] = useState({});

  // Créditos e importación
  const [antecedentesCredits, setAntecedentesCredits] = useState(null);
  const [creditsSource, setCreditsSource] = useState('individual'); // 'individual' | 'org'
  const [creditsOrgName, setCreditsOrgName] = useState(null);
  const [isOrgOwner, setIsOrgOwner] = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [importStateByKey, setImportStateByKey] = useState({});
  const [importedCaseIdByKey, setImportedCaseIdByKey] = useState({});

  // Sesión persistente para evitar captchas (Modo Turbo)
  const [currentSessionId, setCurrentSessionId] = useState(null);

  useEffect(() => {
    async function loadCredits() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/pjn/credits', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAntecedentesCredits(data.credits ?? 0);
      setCreditsSource(data.source || 'individual');
      setCreditsOrgName(data.orgName || null);
      setIsOrgOwner(data.isOrgOwner || false);
    }
    loadCredits();
  }, []);

  const currentJurisdictionLabel = useMemo(
    () => JURISDICTIONS.find((item) => item.value === jurisdiction)?.label || '',
    [jurisdiction]
  );

  const handleImport = useCallback(async (row, rowKey, detail) => {
    if (antecedentesCredits !== null && antecedentesCredits <= 0) {
      setShowCreditsModal(true);
      return;
    }
    setImportStateByKey(prev => ({ ...prev, [rowKey]: 'loading' }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/pjn/importar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          expediente: row.expediente,
          caratula: row.caratula,
          fuero: currentJurisdictionLabel,
          jurisdiccion: jurisdiction,
          source: 'pjn',
          detail: detail || null,
          link: row.link || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        if (payload?.error === 'CREDITS_EXHAUSTED') {
          setImportStateByKey(prev => ({ ...prev, [rowKey]: 'no_credits' }));
          setAntecedentesCredits(0);
          setShowCreditsModal(true);
          return;
        }
        throw new Error(payload?.error || 'Error al importar.');
      }
      setImportStateByKey(prev => ({ ...prev, [rowKey]: 'done' }));
      setImportedCaseIdByKey(prev => ({ ...prev, [rowKey]: payload.caseId }));
      setAntecedentesCredits(prev => (prev !== null ? Math.max(0, prev - 1) : null));
    } catch (err) {
      setImportStateByKey(prev => ({ ...prev, [rowKey]: 'error' }));
      console.error('[PJNSearchPanel][Importar]', err.message);
    }
  }, [antecedentesCredits, currentJurisdictionLabel, jurisdiction]);

  const handleBuyCredits = useCallback(async (packId) => {
    if (creditsSource === 'org') {
      window.location.href = '/dashboard/estudio/creditos';
      return;
    }
    setBuyingCredits(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/mp/antecedentes/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pack_id: packId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Error al iniciar pago.');
      if (payload.init_point) window.location.href = payload.init_point;
    } catch (err) {
      console.error('[PJNSearchPanel][BuyCredits]', err.message);
    } finally {
      setBuyingCredits(false);
    }
  }, [creditsSource]);

  const currentRule = useMemo(() => getPjnParteTypeRule(jurisdiction), [jurisdiction]);

  useEffect(() => {
    if (searchType !== 'parte') return;
    if (currentRule?.forced_type) {
      setParteTipo(currentRule.forced_type);
      return;
    }
    setParteTipo((prev) => prev || '');
  }, [currentRule, searchType]);

  const rows = results?.results || [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const resetSearch = useCallback(() => {
    setResults(null);
    setSearched(false);
    setError('');
    setPage(1);
    setExpandedRowKey('');
    setDetailLoadingKey('');
    setDetailErrorByKey({});
    setDetailByKey({});
    setDetailPageByKey({});
  }, []);

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();
    setError('');

    if (!jurisdiction) {
      setError('Selecciona una camara o jurisdiccion.');
      return;
    }

    if (searchType === 'expediente') {
      if (!numero.trim() || !anio.trim()) {
        setError('Completa numero y anio para buscar por expediente.');
        return;
      }
      if (!/^\d{4}$/.test(anio.trim())) {
        setError('El anio debe tener 4 digitos.');
        return;
      }
    }

    if (searchType === 'parte') {
      if (!nombre.trim()) {
        setError('Completa el nombre de la parte.');
        return;
      }
    }

    setLoading(true);
    setSearched(true);
    setResults(null);
    setPage(1);
    setExpandedRowKey('');
    setSimulatedProgress(0);

    let progressInterval;
    if (searchType === 'parte') {
      progressInterval = setInterval(() => {
        setSimulatedProgress(old => {
          if (old >= 95) return 95;
          const inc = old < 50 ? 5 : old < 80 ? 2 : 0.5;
          return old + inc;
        });
      }, 800);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const effectiveParteTipo = searchType === 'parte'
        ? resolvePjnParteType({ jurisdictionId: jurisdiction, requestedType: parteTipo })
        : null;

      const res = await fetch('/api/pjn/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          searchType,
          jurisdiction,
          jurisdictionName: currentJurisdictionLabel,
          numero: numero.trim(),
          anio: anio.trim(),
          nombre: nombre.trim(),
          parteTipo: effectiveParteTipo,
          maxPages: searchType === 'parte' ? 40 : 10,
          sessionId: currentSessionId
        })
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error || 'No se pudo completar la consulta.');
      }

      if (payload.sessionId) {
        setCurrentSessionId(payload.sessionId);
      }
      setResults(payload);
    } catch (err) {
      setError(readErrorMessage(err, 'No se pudo completar la consulta.'));
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setSimulatedProgress(100);
      setLoading(false);
    }
  }, [anio, currentJurisdictionLabel, jurisdiction, nombre, numero, parteTipo, searchType]);

  const handleLoadDetail = useCallback(async (row, absoluteIndex) => {
    const rowKey = `${row.expediente || 'row'}-${absoluteIndex}`;

    if (expandedRowKey === rowKey) {
      setExpandedRowKey('');
      return;
    }

    setExpandedRowKey(rowKey);

    if (detailByKey[rowKey]) {
      return;
    }

    const parsed = parseExpediente(row.expediente);
    if (!parsed) {
      setDetailErrorByKey((prev) => ({
        ...prev,
        [rowKey]: 'No se pudo interpretar el numero de expediente para consultar detalle.'
      }));
      return;
    }

    setDetailLoadingKey(rowKey);
    setDetailErrorByKey((prev) => ({ ...prev, [rowKey]: '' }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const res = await fetch('/api/pjn/detalle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          jurisdiccion: jurisdiction,
          numero: parsed.numero,
          anio: parsed.anio,
          sessionId: currentSessionId
        })
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'No se pudo cargar el detalle.');

      if (payload.sessionId) {
        setCurrentSessionId(payload.sessionId);
      }
      setDetailByKey((prev) => ({ ...prev, [rowKey]: payload }));
      setDetailPageByKey((prev) => ({ ...prev, [rowKey]: 1 }));
    } catch (err) {
      setDetailErrorByKey((prev) => ({
        ...prev,
        [rowKey]: readErrorMessage(err, 'No se pudo cargar el detalle del expediente.')
      }));
    } finally {
      setDetailLoadingKey('');
    }
  }, [detailByKey, expandedRowKey, jurisdiction]);

  return (
    <section className="pjn-search-container" aria-labelledby="pjn-search-title">
      <div className="pjn-search-header">
        <div className="pjn-search-title">
          <Building2 size={22} aria-hidden="true" />
          <h3 id="pjn-search-title">Consulta verificable de expedientes</h3>
        </div>
        <p className="pjn-search-subtitle">
          Consulta oficial verificada directamente con el sistema judicial.
        </p>
      </div>

      <form onSubmit={handleSearch} className="pjn-search-form">
        <div className="pjn-tabs" role="tablist" aria-label="Tipo de consulta">
          <button
            type="button"
            role="tab"
            aria-selected={searchType === 'expediente'}
            className={`pjn-tab ${searchType === 'expediente' ? 'active' : ''}`}
            onClick={() => setSearchType('expediente')}
          >
            <Hash size={16} aria-hidden="true" /> Por Expediente
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={searchType === 'parte'}
            className={`pjn-tab ${searchType === 'parte' ? 'active' : ''}`}
            onClick={() => setSearchType('parte')}
          >
            <User size={16} aria-hidden="true" /> Por Parte
          </button>
        </div>

        <div className="pjn-fields">
          <div className="pjn-field pjn-field-full">
            <label htmlFor="pjn_jurisdiction">Camara / Jurisdiccion</label>
            <select
              id="pjn_jurisdiction"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              required
            >
              {JURISDICTIONS.map((item) => (
                <option key={item.value || 'empty'} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          {searchType === 'expediente' ? (
            <>
              <div className="pjn-field">
                <label htmlFor="pjn_numero"><Hash size={14} aria-hidden="true" /> Numero</label>
                <input
                  id="pjn_numero"
                  type="text"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Ej: 12345"
                  inputMode="numeric"
                />
              </div>
              <div className="pjn-field">
                <label htmlFor="pjn_anio"><Calendar size={14} aria-hidden="true" /> Anio</label>
                <input
                  id="pjn_anio"
                  type="text"
                  value={anio}
                  onChange={(e) => setAnio(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="Ej: 2026"
                  inputMode="numeric"
                  maxLength={4}
                />
              </div>
            </>
          ) : (
            <>
              <div className="pjn-field">
                <label htmlFor="pjn_parte_tipo">Tipo de parte (opcional)</label>
                <select
                  id="pjn_parte_tipo"
                  value={currentRule?.forced_type || parteTipo}
                  onChange={(e) => setParteTipo(e.target.value)}
                  disabled={Boolean(currentRule?.forced_type)}
                >
                  {PARTE_TYPES.map((item) => (
                    <option key={item.value || 'all'} value={item.value}>{item.label}</option>
                  ))}
                </select>
                {currentRule?.note && (
                  <small className="pjn-field-hint">{currentRule.note}</small>
                )}
              </div>
              <div className="pjn-field pjn-field-full">
                <label htmlFor="pjn_nombre"><User size={14} aria-hidden="true" /> Nombre de la parte</label>
                <input
                  id="pjn_nombre"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Carrefour"
                />
              </div>
            </>
          )}
        </div>

        {loading && (
          <div className="pjn-loading-hint" aria-live="polite" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              <span>
                {searchType === 'parte'
                  ? 'Ejecutando busqueda profunda en todo el fuero...'
                  : 'Consultando expediente en tiempo real...'}
              </span>
            </div>
            {searchType === 'parte' && (
              <div className="pjn-progress-bar-container" style={{ width: '100%', height: '6px', background: '#eaeaea', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  className="pjn-progress-bar-fill"
                  style={{ width: `${simulatedProgress}%`, height: '100%', background: '#ff8a00', transition: 'width 0.8s ease' }}
                />
              </div>
            )}
            {searchType === 'parte' && simulatedProgress < 95 && (
              <small style={{ color: '#666', marginTop: '0.5rem', display: 'block' }}>
                Esta operacion puede demorar hasta 60 segundos por la cantidad de paginas.
              </small>
            )}
            {searchType === 'parte' && simulatedProgress >= 95 && (
              <small style={{ color: '#ff8a00', marginTop: '0.5rem', display: 'block' }}>
                Casi listo, procesando ultimos resultados...
              </small>
            )}
          </div>
        )}

        <div className="pjn-actions">
          <button type="submit" className="pjn-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Consultando...
              </>
            ) : (
              <>
                <Search size={18} aria-hidden="true" /> Consultar expedientes
              </>
            )}
          </button>
          {searched && (
            <button type="button" className="pjn-reset-btn" onClick={resetSearch}>
              <RefreshCw size={15} aria-hidden="true" /> Nueva busqueda
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="pjn-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {results && rows.length > 0 && (
        <div className="pjn-results" aria-live="polite">
          <div className="pjn-results-header">
            <h4><FileText size={18} aria-hidden="true" /> {rows.length} resultado{rows.length !== 1 ? 's' : ''}</h4>
            <span className="pjn-results-query">
              {searchType === 'expediente' ? `Expediente ${numero}/${anio}` : nombre}
            </span>
          </div>

          <div className="pjn-results-meta">
            <span>
              <Clock3 size={12} aria-hidden="true" /> {results?.duration_ms ? `${Math.round(results.duration_ms / 1000)}s` : '--'}
            </span>
            <span>
              Paginas recorridas: {results?.pagination?.pages_fetched || 1}
              {results?.pagination?.truncated ? ' (corte por limite)' : ''}
            </span>
            {searchType === 'parte' && results?.effective_parte_tipo && (
              <span>Tipo aplicado: {results.effective_parte_tipo}</span>
            )}
          </div>

          <div className="pjn-results-table-wrap">
            <table className="pjn-results-table">
              <thead>
                <tr>
                  <th>Expediente</th>
                  <th>Caratula</th>
                  <th>Dependencia</th>
                  <th>Situacion</th>
                  <th>Ult. Act.</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, idx) => {
                  const absoluteIndex = (page - 1) * PAGE_SIZE + idx;
                  const rowKey = `${row.expediente || 'row'}-${absoluteIndex}`;
                  const expanded = expandedRowKey === rowKey;
                  const detail = detailByKey[rowKey];
                  const detailError = detailErrorByKey[rowKey];
                  const detailLoading = detailLoadingKey === rowKey;
                  const acts = Array.isArray(detail?.actuaciones) ? detail.actuaciones : [];
                  const detailPage = detailPageByKey[rowKey] || 1;
                  const detailTotalPages = Math.max(1, Math.ceil(acts.length / DETAIL_PAGE_SIZE));
                  const detailSliceStart = (detailPage - 1) * DETAIL_PAGE_SIZE;
                  const detailSlice = acts.slice(detailSliceStart, detailSliceStart + DETAIL_PAGE_SIZE);

                  return [
                    <tr key={`${rowKey}-main`}>
                      <td className="pjn-cell-exp">{row.expediente || '-'}</td>
                      <td className="pjn-cell-caratula">{row.caratula || '-'}</td>
                      <td>{row.dependencia || '-'}</td>
                      <td>{row.situacion || '-'}</td>
                      <td>{row.ultimaActuacion || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="pjn-link-btn"
                            onClick={() => handleLoadDetail(row, absoluteIndex)}
                            aria-label={`Ver detalle de ${row.expediente}`}
                            title="Ver detalle interno"
                          >
                            {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                          </button>
                        </div>
                      </td>
                    </tr>,

                    expanded ? (
                      <tr key={`${rowKey}-detail`}>
                        <td colSpan={6} style={{ padding: '0.8rem' }}>
                          {detailLoading && (
                            <div className="pjn-loading-hint">
                              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                              Cargando detalle completo...
                            </div>
                          )}

                          {!detailLoading && detailError && (
                            <div className="pjn-error" role="alert">
                              <AlertCircle size={16} aria-hidden="true" />
                              <span>{detailError}</span>
                            </div>
                          )}

                          {!detailLoading && detail && (
                            <div>
                              {/* Chips resumen + botón importar */}
                              <div className="exp-summary-chips" style={{ marginBottom: '0.75rem' }}>
                                <span className="exp-chip">{acts.length} actuaciones</span>
                                <span className="exp-chip">{Array.isArray(detail.intervinientes) ? detail.intervinientes.length : 0} intervinientes</span>
                                {detail.sessionToken && <span className="exp-chip" style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }}><ShieldCheck size={11} /> Documentos disponibles</span>}
                                {/* Botón Importar */}
                                {(() => {
                                  const importState = importStateByKey[rowKey] || 'idle';
                                  const caseId = importedCaseIdByKey[rowKey];
                                  if (importState === 'done' && caseId) {
                                    return (
                                      <a href={`/dashboard/cases/${caseId}`} className="exp-import-btn exp-import-btn--done">
                                        <CheckCircle2 size={12} /> Ver en Expedientes
                                      </a>
                                    );
                                  }
                                  if (importState === 'no_credits') {
                                    return (
                                      <button type="button" className="exp-import-btn exp-import-btn--no-credits" onClick={() => setShowCreditsModal(true)}>
                                        <AlertCircle size={12} /> Sin créditos — obtener más
                                      </button>
                                    );
                                  }
                                  if (importState === 'error') {
                                    return (
                                      <button type="button" className="exp-import-btn exp-import-btn--error" onClick={() => handleImport(row, rowKey, detail)}>
                                        <AlertCircle size={12} /> Error — reintentar
                                      </button>
                                    );
                                  }
                                  return (
                                    <button
                                      type="button"
                                      className={`exp-import-btn${antecedentesCredits === 0 ? ' exp-import-btn--no-credits' : ''}`}
                                      onClick={() => handleImport(row, rowKey, detail)}
                                      disabled={importState === 'loading'}
                                      title={antecedentesCredits === 0 ? 'Sin créditos — hacé clic para obtener más' : 'Importar a mis Expedientes (consume 1 crédito)'}
                                    >
                                      {importState === 'loading'
                                        ? <><Loader2 size={12} className="animate-spin" /> Importando...</>
                                        : antecedentesCredits === 0
                                          ? <><AlertCircle size={12} /> Sin créditos — obtener</>
                                          : <><FolderPlus size={12} /> Importar al Dashboard</>
                                      }
                                    </button>
                                  );
                                })()}
                              </div>

                              {acts.length > 0 ? (
                                <>
                                  <div className="pjn-results-table-wrap">
                                    <table className="pjn-results-table">
                                      <thead>
                                        <tr>
                                          <th>Fecha</th>
                                          <th>Tipo</th>
                                          <th>Descripcion</th>
                                          <th>Oficina</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detailSlice.map((act, aIdx) => (
                                          <tr key={`${rowKey}-act-${aIdx}`}>
                                            <td>{act.fecha || '-'}</td>
                                            <td>{act.tipo || '-'}</td>
                                            <td>{act.descripcion || '-'}</td>
                                            <td>{act.oficina || '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {detailTotalPages > 1 && (
                                    <div className="pjn-inline-pagination">
                                      <button
                                        type="button"
                                        className="pjn-page-btn"
                                        onClick={() => setDetailPageByKey((prev) => ({
                                          ...prev,
                                          [rowKey]: Math.max(1, detailPage - 1)
                                        }))}
                                        disabled={detailPage <= 1}
                                      >
                                        Anterior
                                      </button>
                                      <span className="pjn-page-label">Pagina {detailPage} de {detailTotalPages}</span>
                                      <button
                                        type="button"
                                        className="pjn-page-btn"
                                        onClick={() => setDetailPageByKey((prev) => ({
                                          ...prev,
                                          [rowKey]: Math.min(detailTotalPages, detailPage + 1)
                                        }))}
                                        disabled={detailPage >= detailTotalPages}
                                      >
                                        Siguiente
                                      </button>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="pjn-empty" style={{ marginTop: 0 }}>
                                  <ChevronDown size={20} aria-hidden="true" />
                                  <p>No hay actuaciones para mostrar.</p>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null
                  ];
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pjn-inline-pagination">
              <button
                type="button"
                className="pjn-page-btn"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                Anterior
              </button>
              <span className="pjn-page-label">Pagina {page} de {totalPages}</span>
              <button
                type="button"
                className="pjn-page-btn"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}

      {searched && !loading && results && rows.length === 0 && !error && (
        <div className="pjn-empty">
          <Search size={36} aria-hidden="true" />
          <p>{results?.noResults || 'No se encontraron expedientes con esos parametros.'}</p>
        </div>
      )}

      {results?.run_at && (
        <p className="pjn-field-hint" style={{ marginTop: '0.6rem' }}>
          Ultima consulta: {formatDateTime(results.run_at)}
        </p>
      )}

      {/* Modal de créditos */}
      {showCreditsModal && (
        <div className="ant-modal-overlay" onClick={() => setShowCreditsModal(false)} role="dialog" aria-modal="true" aria-label="Obtener créditos de importación">
          <div className="ant-modal" onClick={e => e.stopPropagation()}>
            <div className="ant-modal-header">
              <div className="ant-modal-title">
                <Coins size={18} />
                <span>Créditos de importación</span>
              </div>
              <button type="button" className="ant-modal-close" onClick={() => setShowCreditsModal(false)} aria-label="Cerrar">
                <XCircle size={18} />
              </button>
            </div>
            {creditsSource === 'org' ? (
              <div style={{ padding: '1.25rem 0' }}>
                <p className="ant-modal-desc">
                  {isOrgOwner
                    ? 'El pool de créditos del estudio está agotado. Comprá más créditos desde el panel del estudio.'
                    : 'El pool de créditos del estudio está agotado. Contactá al titular para recargar.'}
                </p>
                {isOrgOwner && (
                  <button
                    type="button"
                    className="ant-modal-pack ant-modal-pack--featured"
                    onClick={() => { window.location.href = '/dashboard/estudio/creditos'; }}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    <span className="ant-modal-pack-label">Ir a Créditos del Estudio</span>
                    <span className="ant-modal-pack-sub">Comprá packs para el pool compartido</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="ant-modal-desc">
                  Necesitás créditos para importar expedientes a tu dashboard. Cada importación consume 1 crédito y te da acceso completo a las actuaciones y documentos.
                </p>
                <div className="ant-modal-packs">
                  {[
                    { id: 'pack_5', label: '5 créditos', price: '$25.000', sub: '$5.000 por crédito' },
                    { id: 'pack_15', label: '15 créditos', price: '$60.000', sub: '$4.000 por crédito', featured: true },
                    { id: 'pack_30', label: '30 créditos', price: '$99.000', sub: '$3.300 por crédito' },
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`ant-modal-pack${p.featured ? ' ant-modal-pack--featured' : ''}`}
                      onClick={() => { handleBuyCredits(p.id); setShowCreditsModal(false); }}
                      disabled={buyingCredits}
                    >
                      <span className="ant-modal-pack-label">{p.label}</span>
                      <span className="ant-modal-pack-price">{p.price}</span>
                      <span className="ant-modal-pack-sub">{p.sub}</span>
                      {p.featured && <span className="ant-modal-pack-badge">Más popular</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
