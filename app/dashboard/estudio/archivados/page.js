"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Archive, ShieldCheck, Bot, RotateCcw, Filter, RefreshCw, AlertCircle } from 'lucide-react';

const MATTER_LABELS = {
  civil: 'Civil', laboral: 'Laboral', penal: 'Penal', comercial: 'Comercial',
  familia: 'Familia', contencioso: 'Contencioso', administrativo: 'Administrativo',
  previsional: 'Previsional',
};

export default function ArchivadosPage() {
  const [cases,        setCases]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [orgId,        setOrgId]        = useState(null);
  const [myRole,       setMyRole]       = useState(null);
  const [filterMatter, setFilterMatter] = useState('');
  const [restoring,    setRestoring]    = useState(null);
  const [archiving,    setArchiving]    = useState(null);
  const [toast,        setToast]        = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async (oId, fMatter) => {
    setLoading(true);
    let q = supabase
      .from('cases')
      .select('id, title, matter, source, created_at, case_number, pjn_data')
      .eq('org_id', oId)
      .eq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(150);

    if (fMatter) q = q.eq('matter', fMatter);

    const { data } = await q;
    setCases(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!prof?.org_id) return;
      setOrgId(prof.org_id);

      const { data: member } = await supabase
        .from('org_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('org_id', prof.org_id)
        .single();

      setMyRole(member?.role);
      load(prof.org_id, '');
    };
    init();
  }, [load]);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const handleRestore = async (caseId) => {
    setRestoring(caseId);
    try {
      const token = await getToken();
      const res = await fetch('/api/estudio/archivar-caso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ case_id: caseId, restore: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      showToast('Expediente restaurado a la bandeja');
      setCases(prev => prev.filter(c => c.id !== caseId));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRestoring(null);
    }
  };

  const canRestore = myRole === 'owner' || myRole === 'supervisor';

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
          background: toast.type === 'error' ? '#fee2e2' : '#d1fae5',
          color: toast.type === 'error' ? '#991b1b' : '#065f46',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }} role="alert" aria-live="assertive">
          {toast.msg}
        </div>
      )}

      <div className="estudio-page-header">
        <h1 className="estudio-page-title">Archivados</h1>
        <p className="estudio-page-sub">Buzón central de expedientes archivados del estudio</p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888', fontSize: 13 }}>
          <Filter size={14} aria-hidden="true" /> Filtrar:
        </div>
        <select
          className="estudio-select"
          value={filterMatter}
          aria-label="Filtrar por materia"
          onChange={e => setFilterMatter(e.target.value)}
        >
          <option value="">Todas las materias</option>
          {Object.entries(MATTER_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button
          className="estudio-btn-primary"
          style={{ padding: '7px 16px', fontSize: 13 }}
          onClick={() => orgId && load(orgId, filterMatter)}
        >
          Aplicar
        </button>
        <button
          className="estudio-btn-ghost"
          onClick={() => orgId && load(orgId, filterMatter)}
          title="Actualizar"
          aria-label="Actualizar lista de archivados"
          style={{ marginLeft: 'auto' }}
        >
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="estudio-card">
        <div className="estudio-card-header">
          <h2 className="estudio-card-title">
            <Archive size={14} style={{ display: 'inline', marginRight: 6 }} aria-hidden="true" />
            {loading ? 'Cargando…' : `${cases.length} expediente${cases.length !== 1 ? 's' : ''} archivado${cases.length !== 1 ? 's' : ''}`}
          </h2>
        </div>
        <div className="estudio-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }} role="status" aria-label="Cargando archivados">
              <div className="estudio-spinner" />
            </div>
          ) : cases.length === 0 ? (
            <div className="estudio-empty" style={{ padding: '48px 24px' }}>
              <Archive size={40} className="estudio-empty-icon" aria-hidden="true" />
              <p className="estudio-empty-title">Sin archivados</p>
              <p className="estudio-empty-sub">No hay expedientes archivados en este momento</p>
            </div>
          ) : (
            <table className="estudio-table">
              <thead>
                <tr>
                  <th scope="col">N° Interno</th>
                  <th scope="col">Origen</th>
                  <th scope="col">Carátula / Título</th>
                  <th scope="col">N° PJN</th>
                  <th scope="col">Materia</th>
                  <th scope="col">Archivado</th>
                  {canRestore && <th scope="col"><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>
              <tbody>
                {cases.map(c => {
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
                      <td style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                      {canRestore && (
                        <td>
                          <button
                            className="estudio-btn-ghost"
                            onClick={() => handleRestore(c.id)}
                            disabled={restoring === c.id}
                            title="Restaurar a bandeja"
                            aria-label={`Restaurar expediente "${c.title || 'sin título'}" a la bandeja`}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px' }}
                          >
                            {restoring === c.id
                              ? <div className="estudio-spinner" style={{ width: 14, height: 14 }} />
                              : <><RotateCcw size={13} aria-hidden="true" /> Restaurar</>
                            }
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {canRestore && cases.length > 0 && (
        <p style={{ fontSize: 12, color: '#888', marginTop: 12, textAlign: 'center' }}>
          Restaurar devuelve el expediente a la Bandeja General sin asignación.
        </p>
      )}
    </div>
  );
}
