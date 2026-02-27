"use client";

import { useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search,
  Loader2,
  FileText,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Landmark,
  MapPin,
  Scale,
  Briefcase,
  AlertOctagon,
  LayoutGrid,
  Building2,
  Map,
  Globe,
  Gavel
} from 'lucide-react';
import './pjn-search.css';

// ──────────────────────────────────────────────────────────────────────────
// PJN — 28 jurisdicciones del SCW Federal
// ──────────────────────────────────────────────────────────────────────────
const PJN_JURISDICTIONS = [
  { value: '0',  label: 'CSJ - Corte Suprema de Justicia de la Nación' },
  { value: '1',  label: 'CIV - Cámara Nacional Civil' },
  { value: '2',  label: 'CAF - Cámara Contencioso Administrativo Federal' },
  { value: '3',  label: 'CCF - Cámara Civil y Comercial Federal' },
  { value: '4',  label: 'CNE - Cámara Nacional Electoral' },
  { value: '5',  label: 'CSS - Cámara Federal de Seguridad Social' },
  { value: '6',  label: 'CPE - Cámara Nacional Penal Económico' },
  { value: '7',  label: 'CNT - Cámara Nacional del Trabajo' },
  { value: '8',  label: 'CFP - Cámara Criminal y Correccional Federal' },
  { value: '9',  label: 'CCC - Cámara Nacional Criminal y Correccional' },
  { value: '10', label: 'COM - Cámara Nacional Comercial' },
  { value: '11', label: 'CPF - Cámara Federal de Casación Penal' },
  { value: '12', label: 'CPN - Cámara Nacional Casación Penal' },
  { value: '13', label: 'FBB - Federal Bahía Blanca' },
  { value: '14', label: 'FCR - Federal Comodoro Rivadavia' },
  { value: '15', label: 'FCB - Federal Córdoba' },
  { value: '16', label: 'FCT - Federal Corrientes' },
  { value: '17', label: 'FGR - Federal General Roca' },
  { value: '18', label: 'FLP - Federal La Plata' },
  { value: '19', label: 'FMP - Federal Mar del Plata' },
  { value: '20', label: 'FMZ - Federal Mendoza' },
  { value: '21', label: 'FPO - Federal Posadas' },
  { value: '22', label: 'FPA - Federal Paraná' },
  { value: '23', label: 'FRE - Federal Resistencia' },
  { value: '24', label: 'FSA - Federal Salta' },
  { value: '25', label: 'FRO - Federal Rosario' },
  { value: '26', label: 'FSM - Federal San Martín' },
  { value: '27', label: 'FTU - Federal Tucumán' },
];

const PJN_PRESETS = [
  {
    id: 'laboral',
    label: 'Laboral',
    Icon: Scale,
    jurisdictions: ['7'],
    parteTipo: 'DEMANDADO',
    description: 'Cámara Nacional del Trabajo (CNT)'
  },
  {
    id: 'civil_comercial',
    label: 'Civil y Comercial',
    Icon: Briefcase,
    jurisdictions: ['1', '10', '3'],
    parteTipo: 'DEMANDADO',
    description: 'Cámaras Civil, Comercial y Civil-Comercial Federal'
  },
  {
    id: 'penal',
    label: 'Penal',
    Icon: AlertOctagon,
    jurisdictions: ['8', '9'],
    parteTipo: 'IMPUTADO',
    description: 'Cámaras Criminal y Correccional Federal y Nacional'
  },
  {
    id: 'general',
    label: 'Todos los fueros',
    Icon: LayoutGrid,
    jurisdictions: ['7', '1', '10', '9', '8', '2'],
    parteTipo: '',
    description: 'Laboral, Civil, Comercial, Penal y Contencioso Administrativo'
  }
];

const PARTE_TIPOS_OPTIONS = [
  { value: '', label: 'Todos los roles' },
  { value: 'DEMANDADO', label: 'Demandado' },
  { value: 'ACTOR', label: 'Actor' },
  { value: 'IMPUTADO', label: 'Imputado' },
  { value: 'DENUNCIADO', label: 'Denunciado' },
  { value: 'EJECUTADO/S', label: 'Ejecutado' },
];

// ──────────────────────────────────────────────────────────────────────────
// SCBA MEV — departamentos judiciales de Provincia de Buenos Aires
// ──────────────────────────────────────────────────────────────────────────
const SCBA_JURISDICTIONS = [
  { id: 'SCJ', label: 'Suprema Corte SCBA' },
  { id: 'LP',  label: 'La Plata' },
  { id: 'LZ',  label: 'Lomas de Zamora' },
  { id: 'SI',  label: 'San Isidro' },
  { id: 'SM',  label: 'San Martín' },
  { id: 'LM',  label: 'La Matanza' },
  { id: 'QU',  label: 'Quilmes' },
  { id: 'MO',  label: 'Morón' },
  { id: 'AL',  label: 'Avellaneda-Lanús' },
  { id: 'MR',  label: 'Moreno-Gral. Rodríguez' },
  { id: 'MP',  label: 'Mar del Plata' },
  { id: 'BB',  label: 'Bahía Blanca' },
  { id: 'ME',  label: 'Mercedes' },
  { id: 'AZ',  label: 'Azul' },
  { id: 'DO',  label: 'Dolores' },
  { id: 'JU',  label: 'Junín' },
  { id: 'NE',  label: 'Necochea' },
  { id: 'OL',  label: 'Olavarría' },
  { id: 'PE',  label: 'Pergamino' },
  { id: 'SN',  label: 'San Nicolás' },
  { id: 'TA',  label: 'Tandil' },
  { id: 'TL',  label: 'Trenque Lauquen' },
  { id: 'ZC',  label: 'Zárate/Campana' },
  { id: 'TCP', label: 'Tribunal de Casación Penal' },
];

const SCBA_PRESETS = [
  {
    id: 'scba_amba',
    label: 'AMBA',
    Icon: Building2,
    jurisdictions: ['LP', 'LZ', 'SI', 'SM', 'LM', 'QU', 'MO', 'AL'],
    description: 'Departamentos del área metropolitana de Buenos Aires'
  },
  {
    id: 'scba_suprema',
    label: 'Suprema Corte',
    Icon: Gavel,
    jurisdictions: ['SCJ'],
    description: 'Causas ante la Suprema Corte de Justicia PBA'
  },
  {
    id: 'scba_interior',
    label: 'Interior PBA',
    Icon: Map,
    jurisdictions: ['MP', 'BB', 'ME', 'AZ', 'DO', 'JU', 'NE', 'OL', 'PE', 'SN', 'TA', 'TL', 'ZC'],
    description: 'Departamentos del interior de la Provincia'
  },
  {
    id: 'scba_completo',
    label: 'Todos PBA',
    Icon: Globe,
    jurisdictions: ['SCJ', 'LP', 'LZ', 'SI', 'SM', 'LM', 'QU', 'MO', 'AL', 'MR', 'MP', 'BB'],
    description: 'Suprema Corte + principales departamentos'
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────────────────────
export default function AntecedentesPanel() {
  const [source, setSource] = useState('pjn');

  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState([]);
  const [jurisdictionResults, setJurisdictionResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const [pjnPreset, setPjnPreset] = useState('laboral');
  const [pjnCustomJurs, setPjnCustomJurs] = useState([]);
  const [pjnUseCustom, setPjnUseCustom] = useState(false);
  const [parteTipo, setParteTipo] = useState('DEMANDADO');

  const [scbaPreset, setScbaPreset] = useState('scba_amba');
  const [scbaCustomJurs, setScbaCustomJurs] = useState([]);
  const [scbaUseCustom, setScbaUseCustom] = useState(false);

  const abortRef = useRef(false);

  const activePjnPreset   = PJN_PRESETS.find(p => p.id === pjnPreset) || PJN_PRESETS[0];
  const pjnJursToSearch   = pjnUseCustom ? pjnCustomJurs : activePjnPreset.jurisdictions;
  const activeScbaPreset  = SCBA_PRESETS.find(p => p.id === scbaPreset) || SCBA_PRESETS[0];
  const scbaJursToSearch  = scbaUseCustom ? scbaCustomJurs : activeScbaPreset.jurisdictions;
  const jurisdictionsToSearch = source === 'pjn' ? pjnJursToSearch : scbaJursToSearch;

  const handleSourceChange = (newSource) => {
    setSource(newSource);
    setResults([]);
    setJurisdictionResults([]);
    setSearched(false);
    setError('');
    setProgress(null);
  };

  const handlePjnPreset = (id) => {
    const p = PJN_PRESETS.find(x => x.id === id);
    setPjnPreset(id);
    if (p) setParteTipo(p.parteTipo);
    setPjnUseCustom(false);
  };

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();
    const nameTrimmed = nombre.trim();
    if (!nameTrimmed) { setError('Ingresá el nombre o razón social a buscar.'); return; }
    if (jurisdictionsToSearch.length === 0) { setError('Seleccioná al menos una jurisdicción.'); return; }

    setLoading(true);
    setSearched(true);
    setError('');
    setResults([]);
    setJurisdictionResults([]);
    setProgress({ current: 0, total: jurisdictionsToSearch.length, label: '' });
    abortRef.current = false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const accResults = [];
      const accJurResults = [];

      for (let i = 0; i < jurisdictionsToSearch.length; i++) {
        if (abortRef.current) break;

        if (source === 'pjn') {
          const jurId    = jurisdictionsToSearch[i];
          const jurObj   = PJN_JURISDICTIONS.find(j => j.value === jurId);
          const jurLabel = jurObj?.label || `Jur. ${jurId}`;
          const jurShort = jurLabel.split(' - ')[0];
          setProgress({ current: i + 1, total: jurisdictionsToSearch.length, label: jurShort });
          try {
            const res = await fetch('/api/pjn/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify({ searchType: 'parte', jurisdiction: jurId, jurisdictionName: jurLabel, nombre: nameTrimmed, parteTipo: parteTipo || null, maxPages: 20 })
            });
            const payload = await res.json();
            if (!res.ok) {
              accJurResults.push({ id: jurId, label: jurShort, count: 0, error: payload?.error || 'Error' });
            } else {
              const cases = (payload.results || []).map(r => ({ ...r, _source: 'PJN', _jur_label: jurShort }));
              accResults.push(...cases);
              accJurResults.push({ id: jurId, label: jurShort, count: cases.length, error: null });
            }
          } catch { accJurResults.push({ id: jurId, label: jurShort, count: 0, error: 'Error de conexión' }); }
        } else {
          const jurId    = jurisdictionsToSearch[i];
          const jurObj   = SCBA_JURISDICTIONS.find(j => j.id === jurId);
          const jurLabel = jurObj?.label || jurId;
          setProgress({ current: i + 1, total: jurisdictionsToSearch.length, label: jurLabel });
          try {
            const res = await fetch('/api/scba/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify({ nombre: nameTrimmed, jurisdiccionId: jurId })
            });
            const payload = await res.json();
            if (!res.ok) {
              accJurResults.push({ id: jurId, label: jurLabel, count: 0, error: payload?.error || 'Error' });
            } else {
              const cases = (payload.results || []).map(r => ({ ...r, _source: 'SCBA', _jur_label: jurLabel }));
              accResults.push(...cases);
              accJurResults.push({ id: jurId, label: jurLabel, count: cases.length, error: null });
            }
          } catch { accJurResults.push({ id: jurId, label: jurLabel, count: 0, error: 'Error de conexión' }); }
        }

        setResults([...accResults]);
        setJurisdictionResults([...accJurResults]);
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [nombre, jurisdictionsToSearch, parteTipo, source]);

  const totalFound      = results.length;
  const jurWithResults  = jurisdictionResults.filter(j => j.count > 0);
  const jurWithErrors   = jurisdictionResults.filter(j => j.error);

  return (
    <div className="pjn-search-container">

      {/* Header */}
      <div className="pjn-search-header">
        <div className="pjn-search-title">
          <ShieldCheck size={22} aria-hidden="true" />
          <h3>Antecedentes Judiciales</h3>
        </div>
        <p className="pjn-search-subtitle">
          Verificá si una persona o empresa tiene causas activas o archivadas en el sistema judicial oficial.
        </p>
      </div>

      {/* Source toggle — usa el mismo pjn-tabs del sistema */}
      <div className="pjn-tabs" role="tablist" aria-label="Fuente de datos" style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          role="tab"
          aria-selected={source === 'pjn'}
          className={`pjn-tab ant-source-tab ${source === 'pjn' ? 'active' : ''}`}
          onClick={() => handleSourceChange('pjn')}
          disabled={loading}
        >
          <Landmark size={15} aria-hidden="true" />
          <span className="ant-tab-content">
            Fuero Federal
            <span className="ant-tab-sub">PJN · 28 jurisdicciones</span>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={source === 'scba'}
          className={`pjn-tab ant-source-tab ${source === 'scba' ? 'active' : ''}`}
          onClick={() => handleSourceChange('scba')}
          disabled={loading}
        >
          <MapPin size={15} aria-hidden="true" />
          <span className="ant-tab-content">
            Provincia Bs. As.
            <span className="ant-tab-sub">SCBA MEV · 24 departamentos</span>
          </span>
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSearch} className="pjn-form">

        {/* Nombre */}
        <div className="pjn-field-group">
          <label className="pjn-label" htmlFor="ant-nombre">
            <User size={14} /> Nombre o razón social
          </label>
          <input
            id="ant-nombre"
            type="text"
            className="pjn-input"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: MERCADO LIBRE SRL · GARCIA JUAN PABLO"
            disabled={loading}
            autoComplete="off"
          />
        </div>

        {/* PJN form */}
        {source === 'pjn' && (
          <>
            <div className="pjn-field-group">
              <label className="pjn-label">Fuero a consultar</label>
              <div className="pjn-tabs" role="group" aria-label="Tipo de antecedentes">
                {PJN_PRESETS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`pjn-tab ${pjnPreset === id && !pjnUseCustom ? 'active' : ''}`}
                    onClick={() => handlePjnPreset(id)}
                    disabled={loading}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`pjn-tab ${pjnUseCustom ? 'active' : ''}`}
                  onClick={() => setPjnUseCustom(true)}
                  disabled={loading}
                >
                  <Search size={14} aria-hidden="true" />
                  Personalizar
                </button>
              </div>
              {!pjnUseCustom && (
                <p className="ant-preset-desc">{activePjnPreset.description}</p>
              )}
            </div>

            {pjnUseCustom && (
              <div className="pjn-field-group">
                <label className="pjn-label">Jurisdicciones</label>
                <div className="ant-jurisdiction-grid">
                  {PJN_JURISDICTIONS.map(jur => (
                    <label key={jur.value} className="ant-jur-checkbox">
                      <input
                        type="checkbox"
                        checked={pjnCustomJurs.includes(jur.value)}
                        onChange={() => setPjnCustomJurs(prev =>
                          prev.includes(jur.value) ? prev.filter(x => x !== jur.value) : [...prev, jur.value]
                        )}
                        disabled={loading}
                      />
                      <span>{jur.label.split(' - ')[0]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="pjn-field-group">
              <label className="pjn-label" htmlFor="ant-parte-tipo">Rol en la causa</label>
              <select
                id="ant-parte-tipo"
                className="pjn-select"
                value={parteTipo}
                onChange={e => setParteTipo(e.target.value)}
                disabled={loading}
              >
                {PARTE_TIPOS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* SCBA form */}
        {source === 'scba' && (
          <>
            <div className="pjn-field-group">
              <label className="pjn-label">Departamento judicial</label>
              <div className="pjn-tabs" role="group" aria-label="Zona PBA">
                {SCBA_PRESETS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`pjn-tab ${scbaPreset === id && !scbaUseCustom ? 'active' : ''}`}
                    onClick={() => { setScbaPreset(id); setScbaUseCustom(false); }}
                    disabled={loading}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`pjn-tab ${scbaUseCustom ? 'active' : ''}`}
                  onClick={() => setScbaUseCustom(true)}
                  disabled={loading}
                >
                  <Search size={14} aria-hidden="true" />
                  Personalizar
                </button>
              </div>
              {!scbaUseCustom && (
                <p className="ant-preset-desc">{activeScbaPreset.description}</p>
              )}
            </div>

            {scbaUseCustom && (
              <div className="pjn-field-group">
                <label className="pjn-label">Departamentos</label>
                <div className="ant-jurisdiction-grid">
                  {SCBA_JURISDICTIONS.map(jur => (
                    <label key={jur.id} className="ant-jur-checkbox">
                      <input
                        type="checkbox"
                        checked={scbaCustomJurs.includes(jur.id)}
                        onChange={() => setScbaCustomJurs(prev =>
                          prev.includes(jur.id) ? prev.filter(x => x !== jur.id) : [...prev, jur.id]
                        )}
                        disabled={loading}
                      />
                      <span>{jur.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="pjn-auto-badge" style={{ marginTop: '0.25rem' }}>
              <ShieldCheck size={13} aria-hidden="true" />
              Datos directos de MEV · Suprema Corte de Justicia PBA
            </div>
          </>
        )}

        {/* Actions */}
        <div className="pjn-actions">
          <button
            type="submit"
            className="pjn-btn-primary"
            disabled={loading || !nombre.trim() || jurisdictionsToSearch.length === 0}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
            {loading
              ? `Consultando ${source === 'pjn' ? 'PJN' : 'SCBA MEV'}...`
              : 'Buscar antecedentes'
            }
          </button>
          {loading && (
            <button type="button" className="pjn-btn-secondary" onClick={() => { abortRef.current = true; }}>
              Detener
            </button>
          )}
        </div>

        {error && (
          <div className="pjn-error-msg" role="alert">
            <AlertCircle size={15} /> {error}
          </div>
        )}
      </form>

      {/* Progress */}
      {loading && progress && (
        <div className="ant-progress-block" role="status" aria-live="polite">
          <Loader2 size={16} className="spin" />
          <div className="ant-progress-text">
            <span>Consultando <strong>{progress.label}</strong></span>
            <span className="ant-progress-count">{progress.current} / {progress.total}</span>
          </div>
          <div className="ant-progress-bar">
            <div
              className="ant-progress-fill"
              style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Jurisdiction summary */}
      {searched && jurisdictionResults.length > 0 && (
        <div className="ant-jur-summary">
          {jurisdictionResults.map(jur => (
            <span
              key={jur.id}
              className={`ant-jur-tag ${jur.error ? 'error' : jur.count > 0 ? 'has-results' : 'empty'}`}
              title={jur.error || `${jur.count} causas encontradas`}
            >
              {jur.error
                ? <XCircle size={11} />
                : jur.count > 0
                  ? <CheckCircle2 size={11} />
                  : <Clock size={11} />}
              {jur.label} ({jur.error ? '!' : jur.count})
            </span>
          ))}
        </div>
      )}

      {/* No results */}
      {searched && !loading && results.length === 0 && jurisdictionResults.length > 0 && jurWithErrors.length === 0 && (
        <div className="pjn-no-results">
          <FileText size={36} />
          <p>Sin causas encontradas para <strong>&quot;{nombre}&quot;</strong></p>
          <p className="pjn-no-results-sub">
            No se registran antecedentes en las jurisdicciones consultadas.
          </p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="pjn-results-section">
          <div className="pjn-results-header">
            <h4 className="pjn-results-count">
              <FileText size={16} />
              {totalFound} causa{totalFound !== 1 ? 's' : ''} encontrada{totalFound !== 1 ? 's' : ''}
              {jurWithResults.length > 1 && (
                <span className="pjn-results-sub">
                  en {jurWithResults.length} {source === 'pjn' ? 'jurisdicciones' : 'departamentos'}
                </span>
              )}
            </h4>
          </div>

          <div className="pjn-results-table-wrap">
            {source === 'pjn' ? (
              <table className="pjn-results-table">
                <thead>
                  <tr>
                    <th>Expediente</th>
                    <th>Carátula</th>
                    <th>Fuero</th>
                    <th>Dependencia</th>
                    <th>Situación</th>
                    <th>Última actuación</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={`pjn-${row.expediente}-${i}`}>
                      <td className="pjn-cell-mono">{row.expediente || '-'}</td>
                      <td className="pjn-cell-caratula">{row.caratula || '-'}</td>
                      <td><span className="ant-fuero-badge">{row._jur_label}</span></td>
                      <td className="pjn-cell-sm">{row.dependencia || '-'}</td>
                      <td className="pjn-cell-sm">{row.situacion || '-'}</td>
                      <td className="pjn-cell-sm">{row.ultimaActuacion || '-'}</td>
                      <td>
                        {row.link && (
                          <a href={row.link} target="_blank" rel="noopener noreferrer"
                            className="pjn-link-btn" title="Ver en PJN SCW">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="pjn-results-table">
                <thead>
                  <tr>
                    <th>Nro. Causa</th>
                    <th>Carátula</th>
                    <th>Departamento</th>
                    <th>Organismo</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={`scba-${row.nroCausa}-${i}`}>
                      <td className="pjn-cell-mono">{row.nroCausa || row.nroExpediente || '-'}</td>
                      <td className="pjn-cell-caratula">{row.caratula || '-'}</td>
                      <td><span className="ant-fuero-badge">{row._jur_label}</span></td>
                      <td className="pjn-cell-sm">{row.organismo || '-'}</td>
                      <td className="pjn-cell-sm">{row.estado || '-'}</td>
                      <td className="pjn-cell-sm">{row.fecha || '-'}</td>
                      <td>
                        {row.link && (
                          <a href={row.link} target="_blank" rel="noopener noreferrer"
                            className="pjn-link-btn" title="Ver en MEV SCBA">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {jurWithErrors.length > 0 && (
            <p className="ant-errors-note">
              <AlertCircle size={13} />
              No se pudo consultar: {jurWithErrors.map(j => j.label).join(', ')}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
