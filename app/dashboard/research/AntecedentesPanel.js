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
  Building2,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import './pjn-search.css';

// 28 jurisdicciones del PJN SCW
const ALL_JURISDICTIONS = [
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

// Presets de búsqueda
const PRESETS = [
  {
    id: 'laboral',
    label: 'Laboral',
    icon: '⚖️',
    jurisdictions: ['7'],
    parteTipo: 'DEMANDADO',
    description: 'Causas en la Cámara Nacional del Trabajo'
  },
  {
    id: 'civil_comercial',
    label: 'Civil y Comercial',
    icon: '🏛️',
    jurisdictions: ['1', '10', '3'],
    parteTipo: 'DEMANDADO',
    description: 'Cámaras Civil, Comercial y Civil-Comercial Federal'
  },
  {
    id: 'penal',
    label: 'Penal',
    icon: '🔍',
    jurisdictions: ['8', '9'],
    parteTipo: 'IMPUTADO',
    description: 'Cámaras Criminal y Correccional'
  },
  {
    id: 'general',
    label: 'Todos los fueros',
    icon: '🗂️',
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

function getJurLabel(id) {
  return ALL_JURISDICTIONS.find(j => j.value === id)?.label?.split(' - ')[0] || `Jur. ${id}`;
}

export default function AntecedentesPanel() {
  const [nombre, setNombre] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('laboral');
  const [customJurisdictions, setCustomJurisdictions] = useState([]);
  const [parteTipo, setParteTipo] = useState('DEMANDADO');
  const [useCustom, setUseCustom] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null); // { current, total, label }
  const [results, setResults] = useState([]); // array acumulado de todos los casos
  const [jurisdictionResults, setJurisdictionResults] = useState([]); // [{ id, label, count, error }]
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const abortRef = useRef(false);

  const activePreset = PRESETS.find(p => p.id === selectedPreset) || PRESETS[0];
  const jurisdictionsToSearch = useCustom
    ? customJurisdictions
    : activePreset.jurisdictions;

  const handlePresetChange = (presetId) => {
    const preset = PRESETS.find(p => p.id === presetId);
    setSelectedPreset(presetId);
    if (preset) setParteTipo(preset.parteTipo);
    setUseCustom(false);
  };

  const toggleCustomJurisdiction = (value) => {
    setCustomJurisdictions(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();

    const nameTrimmed = nombre.trim();
    if (!nameTrimmed) {
      setError('Ingresá el nombre o razón social a buscar.');
      return;
    }
    if (jurisdictionsToSearch.length === 0) {
      setError('Seleccioná al menos una jurisdicción.');
      return;
    }

    setLoading(true);
    setSearched(true);
    setError('');
    setResults([]);
    setJurisdictionResults([]);
    setProgress({ current: 0, total: jurisdictionsToSearch.length, label: '' });
    abortRef.current = false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const accResults = [];
      const accJurResults = [];

      for (let i = 0; i < jurisdictionsToSearch.length; i++) {
        if (abortRef.current) break;

        const jurId = jurisdictionsToSearch[i];
        const jurObj = ALL_JURISDICTIONS.find(j => j.value === jurId);
        const jurLabel = jurObj?.label || `Jurisdicción ${jurId}`;
        const jurShort = jurLabel.split(' - ')[0];

        setProgress({ current: i + 1, total: jurisdictionsToSearch.length, label: jurShort });

        try {
          const res = await fetch('/api/pjn/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
            },
            body: JSON.stringify({
              searchType: 'parte',
              jurisdiction: jurId,
              jurisdictionName: jurLabel,
              nombre: nameTrimmed,
              parteTipo: parteTipo || null,
              maxPages: 20
            })
          });

          const payload = await res.json();

          if (!res.ok) {
            accJurResults.push({ id: jurId, label: jurShort, count: 0, error: payload?.error || 'Error al consultar' });
          } else {
            const cases = (payload.results || []).map(r => ({
              ...r,
              _jurisdiccion_id: jurId,
              _jurisdiccion_label: jurShort
            }));
            accResults.push(...cases);
            accJurResults.push({ id: jurId, label: jurShort, count: cases.length, error: null });
          }
        } catch (fetchErr) {
          accJurResults.push({ id: jurId, label: jurShort, count: 0, error: 'Error de conexión' });
        }

        // Update UI incrementally
        setResults([...accResults]);
        setJurisdictionResults([...accJurResults]);
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [nombre, jurisdictionsToSearch, parteTipo]);

  const handleStop = () => {
    abortRef.current = true;
  };

  const totalFound = results.length;
  const jurWithResults = jurisdictionResults.filter(j => j.count > 0);
  const jurWithErrors = jurisdictionResults.filter(j => j.error);

  return (
    <div className="pjn-search-container">
      {/* Header */}
      <div className="pjn-search-header">
        <div className="pjn-search-title">
          <ShieldCheck size={20} />
          <h3>Antecedentes Judiciales</h3>
        </div>
        <p className="pjn-search-subtitle">
          Verificá si una persona o empresa tiene causas activas en el fuero federal.
          Los resultados provienen directamente del Sistema de Consulta Web (SCW) del PJN.
        </p>
        <span className="pjn-auto-badge">
          <ShieldCheck size={13} /> Datos verificados · Fuente oficial PJN
        </span>
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
            placeholder="Ej: MERCADO LIBRE SRL, JUAN PEREZ"
            disabled={loading}
            autoComplete="off"
          />
        </div>

        {/* Presets */}
        <div className="pjn-field-group">
          <label className="pjn-label">Tipo de antecedentes</label>
          <div className="ant-presets">
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                className={`ant-preset-btn ${selectedPreset === preset.id && !useCustom ? 'active' : ''}`}
                onClick={() => handlePresetChange(preset.id)}
                disabled={loading}
                title={preset.description}
              >
                <span className="ant-preset-icon">{preset.icon}</span>
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className={`ant-preset-btn ${useCustom ? 'active' : ''}`}
              onClick={() => setUseCustom(true)}
              disabled={loading}
            >
              ✏️ Personalizar
            </button>
          </div>
          {!useCustom && (
            <p className="ant-preset-desc">{activePreset.description}</p>
          )}
        </div>

        {/* Custom jurisdiction selector */}
        {useCustom && (
          <div className="pjn-field-group">
            <label className="pjn-label">Jurisdicciones a consultar</label>
            <div className="ant-jurisdiction-grid">
              {ALL_JURISDICTIONS.map(jur => (
                <label key={jur.value} className="ant-jur-checkbox">
                  <input
                    type="checkbox"
                    checked={customJurisdictions.includes(jur.value)}
                    onChange={() => toggleCustomJurisdiction(jur.value)}
                    disabled={loading}
                  />
                  <span>{jur.label.split(' - ')[0]}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Parte tipo */}
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

        {/* Actions */}
        <div className="pjn-actions">
          <button
            type="submit"
            className="pjn-btn-primary"
            disabled={loading || !nombre.trim() || jurisdictionsToSearch.length === 0}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
            {loading ? 'Consultando PJN...' : 'Buscar antecedentes'}
          </button>
          {loading && (
            <button type="button" className="pjn-btn-secondary" onClick={handleStop}>
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
              {jur.error ? <XCircle size={12} /> : jur.count > 0 ? <CheckCircle2 size={12} /> : <Clock size={12} />}
              {jur.label} {jur.error ? '⚠' : `(${jur.count})`}
            </span>
          ))}
        </div>
      )}

      {/* Results */}
      {searched && !loading && results.length === 0 && jurisdictionResults.length > 0 && jurWithErrors.length === 0 && (
        <div className="pjn-no-results">
          <FileText size={36} />
          <p>Sin causas encontradas para <strong>&quot;{nombre}&quot;</strong></p>
          <p className="pjn-no-results-sub">
            No se registran antecedentes en las jurisdicciones consultadas con el rol seleccionado.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="pjn-results-section">
          <div className="pjn-results-header">
            <h4 className="pjn-results-count">
              <FileText size={16} />
              {totalFound} causa{totalFound !== 1 ? 's' : ''} encontrada{totalFound !== 1 ? 's' : ''}
              {jurisdictionResults.length > 1 && (
                <span className="pjn-results-sub">
                  en {jurWithResults.length} jurisdicción{jurWithResults.length !== 1 ? 'es' : ''}
                </span>
              )}
            </h4>
          </div>

          <div className="pjn-results-table-wrap">
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
                  <tr key={`${row.expediente}-${row._jurisdiccion_id}-${i}`}>
                    <td className="pjn-cell-mono">{row.expediente || '-'}</td>
                    <td className="pjn-cell-caratula">{row.caratula || '-'}</td>
                    <td>
                      <span className="ant-fuero-badge">{row._jurisdiccion_label}</span>
                    </td>
                    <td className="pjn-cell-sm">{row.dependencia || '-'}</td>
                    <td className="pjn-cell-sm">{row.situacion || '-'}</td>
                    <td className="pjn-cell-sm">{row.ultimaActuacion || '-'}</td>
                    <td>
                      {row.link ? (
                        <a
                          href={row.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pjn-link-btn"
                          title="Ver en SCW"
                        >
                          <ExternalLink size={14} />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {jurWithErrors.length > 0 && (
            <p className="ant-errors-note">
              <AlertCircle size={13} />
              No se pudo consultar: {jurWithErrors.map(j => j.label).join(', ')}.
              Podés volver a intentarlo individualmente desde &quot;Consulta Verificable&quot;.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
