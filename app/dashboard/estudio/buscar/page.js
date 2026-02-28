"use client";
import { useState, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Search, ShieldCheck, Bot, Inbox, UserCheck, Archive, AlertCircle } from 'lucide-react';

const MATTER_LABELS = {
  civil: 'Civil', laboral: 'Laboral', penal: 'Penal', comercial: 'Comercial',
  familia: 'Familia', contencioso: 'Contencioso', administrativo: 'Administrativo',
  previsional: 'Previsional',
};
const STATUS_COLORS = { open: '#94a3b8', in_progress: '#34d399', resolved: '#60a5fa', archived: '#f87171' };
const STATUS_LABELS = { open: 'Abierto', in_progress: 'En curso', resolved: 'Resuelto', archived: 'Archivado' };

const CASE_SELECT = 'id, title, matter, status, source, created_at, assigned_to, case_number, pjn_data, assigned_profile:assigned_to(full_name)';

export default function BuscarPage() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState(null); // null = sin búsqueda aún
  const [loading, setLoading] = useState(false);
  const [orgId,   setOrgId]   = useState(null);
  const debounceRef = useRef(null);

  // Carga orgId la primera vez que se necesita
  const getOrgId = async () => {
    if (orgId) return orgId;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    if (prof?.org_id) setOrgId(prof.org_id);
    return prof?.org_id || null;
  };

  const doSearch = async (q) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) { setResults(null); return; }

    setLoading(true);
    const oId = await getOrgId();
    if (!oId) { setLoading(false); return; }

    // Buscar por título E por número de expediente PJN (en paralelo)
    const [byTitle, byExpediente] = await Promise.all([
      supabase
        .from('cases')
        .select(CASE_SELECT)
        .eq('org_id', oId)
        .ilike('title', `%${trimmed}%`)
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('cases')
        .select(CASE_SELECT)
        .eq('org_id', oId)
        .filter('pjn_data->>expediente', 'ilike', `%${trimmed}%`)
        .order('created_at', { ascending: false })
        .limit(25),
    ]);

    // Merge y deduplicar por id
    const seen = new Set();
    const merged = [...(byTitle.data || []), ...(byExpediente.data || [])].filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    setResults(merged);
    setLoading(false);
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 380);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    doSearch(query);
  };

  const getStatusBadge = (c) => {
    if (c.status === 'archived') return { label: 'Archivado', color: STATUS_COLORS.archived, icon: <Archive size={12} /> };
    if (!c.assigned_to) return { label: 'En Bandeja', color: '#f59e0b', icon: <Inbox size={12} /> };
    return {
      label: c.assigned_profile?.full_name || 'Asignado',
      color: STATUS_COLORS[c.status] || '#94a3b8',
      icon: <UserCheck size={12} />,
    };
  };

  return (
    <div>
      <div className="estudio-page-header">
        <h1 className="estudio-page-title">Buscar expedientes</h1>
        <p className="estudio-page-sub">Por carátula, partes o número de expediente</p>
      </div>

      {/* Buscador */}
      <form onSubmit={handleSubmit} role="search" aria-label="Buscar expedientes del estudio">
        <div style={{ position: 'relative', marginBottom: 24, maxWidth: 560 }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }}
            aria-hidden="true"
          />
          <input
            type="search"
            className="estudio-input"
            placeholder="Ej: García c/ Empresa, 12345/2020…"
            value={query}
            onChange={handleInput}
            aria-label="Buscar por carátula o número de expediente"
            autoFocus
            style={{ paddingLeft: 40, paddingRight: 16, fontSize: 15 }}
          />
        </div>
      </form>

      {/* Estados */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }} role="status" aria-live="polite" aria-label="Buscando...">
          <div className="estudio-spinner" />
        </div>
      )}

      {!loading && results === null && (
        <div className="estudio-empty" style={{ padding: '56px 24px' }}>
          <Search size={40} className="estudio-empty-icon" aria-hidden="true" />
          <p className="estudio-empty-title">Ingresá al menos 2 caracteres para buscar</p>
          <p className="estudio-empty-sub">Podés buscar por carátula, nombre de parte o número de expediente</p>
        </div>
      )}

      {!loading && results !== null && results.length === 0 && (
        <div className="estudio-empty" style={{ padding: '56px 24px' }} role="status" aria-live="polite">
          <AlertCircle size={40} className="estudio-empty-icon" aria-hidden="true" />
          <p className="estudio-empty-title">Sin resultados</p>
          <p className="estudio-empty-sub">No se encontraron expedientes para "{query}"</p>
        </div>
      )}

      {!loading && results && results.length > 0 && (
        <div className="estudio-card" role="region" aria-label={`${results.length} resultados de búsqueda`}>
          <div className="estudio-card-header">
            <h2 className="estudio-card-title">
              <Search size={14} style={{ display: 'inline', marginRight: 6 }} aria-hidden="true" />
              {results.length} resultado{results.length !== 1 ? 's' : ''}
            </h2>
          </div>
          <div className="estudio-card-body" style={{ padding: 0 }}>
            <table className="estudio-table">
              <thead>
                <tr>
                  <th scope="col">N° Interno</th>
                  <th scope="col">Origen</th>
                  <th scope="col">Carátula / Título</th>
                  <th scope="col">N° PJN</th>
                  <th scope="col">Materia</th>
                  <th scope="col">Estado / Asignación</th>
                  <th scope="col">Ingreso</th>
                </tr>
              </thead>
              <tbody>
                {results.map(c => {
                  const badge = getStatusBadge(c);
                  const nroExpediente = c.pjn_data?.expediente || '—';
                  return (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', color: c.case_number ? 'inherit' : '#aaa' }}>
                        {c.case_number || '—'}
                      </td>
                      <td>
                        {c.source === 'pjn_import'
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399' }} title="Importado del PJN"><ShieldCheck size={13} aria-hidden="true" /> PJN</span>
                          : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#60a5fa' }} title="Consulta IA"><Bot size={13} aria-hidden="true" /> IA</span>
                        }
                      </td>
                      <td>
                        <span style={{ maxWidth: 260, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500 }}>
                          {c.title || '(sin título)'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, fontFamily: 'monospace', color: nroExpediente === '—' ? '#aaa' : 'inherit' }}>
                        {nroExpediente}
                      </td>
                      <td>
                        {c.matter
                          ? <span className="estudio-badge estudio-badge--neutral">{MATTER_LABELS[c.matter] || c.matter}</span>
                          : <span style={{ color: '#aaa', fontSize: 13 }}>—</span>
                        }
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: badge.color }}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
