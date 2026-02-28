"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Inbox, ShieldCheck, Bot, CheckCircle, Clock, Filter, RefreshCw, UserCheck } from 'lucide-react';

const MATTER_LABELS = {
  civil: 'Civil', laboral: 'Laboral', penal: 'Penal', comercial: 'Comercial',
  familia: 'Familia', contencioso: 'Contencioso', administrativo: 'Administrativo',
};

export default function BandejaPage() {
  const [cases,        setCases]        = useState([]);
  const [members,      setMembers]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [orgId,        setOrgId]        = useState(null);
  const [myRole,       setMyRole]       = useState(null);
  const [filterMatter, setFilterMatter] = useState('');
  const [taking,       setTaking]       = useState(null);
  const [assigning,    setAssigning]    = useState(null);
  const [toast,        setToast]        = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async (oId) => {
    setLoading(true);
    let q = supabase
      .from('cases')
      .select('id, title, matter, source, created_at, status, case_number')
      .eq('org_id', oId)
      .is('assigned_to', null)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filterMatter) q = q.eq('matter', filterMatter);

    const { data } = await q;
    setCases(data || []);
    setLoading(false);
  }, [filterMatter]);

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

      const r = member?.role;
      setMyRole(r);

      // Si es owner o supervisor, cargar lista de miembros para asignar
      if (r === 'owner' || r === 'supervisor') {
        const { data: mems } = await supabase
          .from('org_members')
          .select('user_id, profile:user_id(full_name)')
          .eq('org_id', prof.org_id);
        setMembers(mems || []);
      }

      load(prof.org_id);
    };
    init();
  }, [load]);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // Tomar para uno mismo
  const handleTomar = async (caseId) => {
    setTaking(caseId);
    try {
      const token = await getToken();
      const res = await fetch('/api/estudio/tomar-caso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ case_id: caseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      showToast('Expediente tomado correctamente');
      setCases(prev => prev.filter(c => c.id !== caseId));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTaking(null);
    }
  };

  // Asignar a otro miembro (owner o supervisor)
  const handleAssign = async (caseId, targetUserId) => {
    setAssigning(caseId);
    try {
      const token = await getToken();
      const res = await fetch('/api/estudio/asignar-caso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ case_id: caseId, target_user_id: targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      const name = members.find(m => m.user_id === targetUserId)?.profile?.full_name || 'el abogado';
      showToast(`Expediente asignado a ${name}`);
      setCases(prev => prev.filter(c => c.id !== caseId));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAssigning(null);
    }
  };

  const canAssign = myRole === 'owner' || myRole === 'supervisor';

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
          background: toast.type === 'error' ? '#fee2e2' : '#d1fae5',
          color: toast.type === 'error' ? '#991b1b' : '#065f46',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          {toast.msg}
        </div>
      )}

      <div className="estudio-page-header">
        <h1 className="estudio-page-title">Bandeja General</h1>
        <p className="estudio-page-sub">Expedientes sin asignar del estudio</p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888', fontSize: 13 }}>
          <Filter size={14} /> Filtrar:
        </div>
        <select
          className="estudio-select"
          value={filterMatter}
          onChange={e => setFilterMatter(e.target.value)}
        >
          <option value="">Todas las materias</option>
          {Object.entries(MATTER_LABELS).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>
        <button
          className="estudio-btn-ghost"
          onClick={() => orgId && load(orgId)}
          title="Actualizar"
          style={{ marginLeft: 'auto' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tabla */}
      <div className="estudio-card">
        <div className="estudio-card-header">
          <h2 className="estudio-card-title">
            <Inbox size={14} style={{ display: 'inline', marginRight: 6 }} />
            {loading ? 'Cargando…' : `${cases.length} expediente${cases.length !== 1 ? 's' : ''} disponible${cases.length !== 1 ? 's' : ''}`}
          </h2>
        </div>
        <div className="estudio-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="estudio-spinner" />
            </div>
          ) : cases.length === 0 ? (
            <div className="estudio-empty" style={{ padding: '48px 24px' }}>
              <Inbox size={40} className="estudio-empty-icon" />
              <p className="estudio-empty-title">Bandeja vacía</p>
              <p className="estudio-empty-sub">No hay expedientes sin asignar en este momento</p>
            </div>
          ) : (
            <table className="estudio-table">
              <thead>
                <tr>
                  <th scope="col">N° Interno</th>
                  <th scope="col">Origen</th>
                  <th scope="col">Carátula / Título</th>
                  <th scope="col">Materia</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Ingreso</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', color: c.case_number ? 'inherit' : '#aaa' }}>
                      {c.case_number || '—'}
                    </td>
                    <td>
                      {c.source === 'pjn_import'
                        ? <span title="Importado del PJN" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399' }}><ShieldCheck size={14} /> PJN</span>
                        : <span title="Consulta IA" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#60a5fa' }}><Bot size={14} /> IA</span>
                      }
                    </td>
                    <td>
                      <span className="estudio-row-title" style={{ maxWidth: 220, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.title || '(sin título)'}
                      </span>
                    </td>
                    <td>
                      {c.matter ? (
                        <span className="estudio-badge estudio-badge--neutral">{MATTER_LABELS[c.matter] || c.matter}</span>
                      ) : <span style={{ color: '#aaa', fontSize: 13 }}>—</span>}
                    </td>
                    <td>
                      {c.status === 'in_progress'
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399', fontSize: 12 }}><Clock size={12} /> En curso</span>
                        : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8', fontSize: 12 }}><Clock size={12} /> Abierto</span>
                      }
                    </td>
                    <td style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    <td>
                      {taking === c.id || assigning === c.id ? (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <div className="estudio-spinner" style={{ width: 16, height: 16 }} />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {/* Botón "Tomar" — para todos los roles */}
                          <button
                            className="estudio-btn-primary"
                            style={{ padding: '6px 14px', fontSize: 13 }}
                            onClick={() => handleTomar(c.id)}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <CheckCircle size={13} /> Tomar
                            </span>
                          </button>
                          {/* Select "Asignar a…" — solo para owner y supervisor */}
                          {canAssign && members.length > 0 && (
                            <select
                              className="estudio-select"
                              defaultValue=""
                              aria-label="Asignar expediente a un abogado del equipo"
                              style={{ padding: '5px 8px', fontSize: 12, minWidth: 120 }}
                              onChange={e => {
                                if (e.target.value) {
                                  handleAssign(c.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                            >
                              <option value="" disabled>Asignar a…</option>
                              {members.map(m => (
                                <option key={m.user_id} value={m.user_id}>
                                  {m.profile?.full_name || m.user_id.slice(0, 8)}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
