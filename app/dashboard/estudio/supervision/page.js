"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import { BarChart2, Filter, RefreshCw, ShieldCheck, Bot, AlertCircle, UserCheck, Inbox, Archive } from 'lucide-react';

const STATUS_LABELS = { open: 'Abierto', in_progress: 'En curso', resolved: 'Resuelto', archived: 'Archivado' };
const STATUS_COLORS = { open: '#94a3b8', in_progress: '#34d399', resolved: '#60a5fa', archived: '#f87171' };
const MATTER_LABELS = {
  civil: 'Civil', laboral: 'Laboral', penal: 'Penal', comercial: 'Comercial',
  familia: 'Familia', contencioso: 'Contencioso', administrativo: 'Administrativo',
};

export default function SupervisionPage() {
  const router = useRouter();
  const [cases,        setCases]        = useState([]);
  const [members,      setMembers]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [orgId,        setOrgId]        = useState(null);
  const [role,         setRole]         = useState(null);
  const [filterMember, setFilterMember] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMatter, setFilterMatter] = useState('');
  const [assigning,    setAssigning]    = useState(null); // caseId being assigned
  const [archiving,    setArchiving]    = useState(null); // caseId being archived
  const [toast,        setToast]        = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async (oId, fMember, fStatus, fMatter) => {
    setLoading(true);
    let q = supabase
      .from('cases')
      .select('id, title, matter, source, status, created_at, assigned_to, case_number, assigned_profile:assigned_to(full_name)')
      .eq('org_id', oId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(200);

    if (fMember === 'null') q = q.is('assigned_to', null);
    else if (fMember) q = q.eq('assigned_to', fMember);
    if (fStatus) q = q.eq('status', fStatus);
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

      const { data: member } = await supabase
        .from('org_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('org_id', prof.org_id)
        .single();

      const r = member?.role;
      setRole(r);

      if (r !== 'owner' && r !== 'supervisor') {
        router.push('/dashboard/estudio');
        return;
      }

      setOrgId(prof.org_id);

      const { data: mems } = await supabase
        .from('org_members')
        .select('user_id, profile:user_id(full_name)')
        .eq('org_id', prof.org_id);

      setMembers(mems || []);
      load(prof.org_id, '', '', '');
    };
    init();
  }, [router, load]);

  const handleFilter = () => {
    if (orgId) load(orgId, filterMember, filterStatus, filterMatter);
  };

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const handleAssign = async (caseId, targetUserId) => {
    // targetUserId = null → devolver a bandeja; string → asignar a ese miembro
    setAssigning(caseId);
    try {
      const token = await getToken();
      const res = await fetch('/api/estudio/asignar-caso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ case_id: caseId, target_user_id: targetUserId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');

      const assignedProfile = targetUserId
        ? members.find(m => m.user_id === targetUserId)?.profile || null
        : null;

      setCases(prev => prev.map(c =>
        c.id === caseId
          ? { ...c, assigned_to: targetUserId || null, assigned_profile: assignedProfile }
          : c
      ));
      showToast(targetUserId ? 'Expediente asignado correctamente' : 'Expediente devuelto a la bandeja');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAssigning(null);
    }
  };

  const handleArchive = async (caseId, title) => {
    if (!confirm(`¿Archivar "${title || 'este expediente'}"? Se moverá al buzón de archivados del estudio.`)) return;
    setArchiving(caseId);
    try {
      const token = await getToken();
      const res = await fetch('/api/estudio/archivar-caso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ case_id: caseId, restore: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setCases(prev => prev.filter(c => c.id !== caseId));
      showToast('Expediente archivado');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setArchiving(null);
    }
  };

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
        <h1 className="estudio-page-title">Supervisión</h1>
        <p className="estudio-page-sub">Todos los expedientes del estudio</p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888', fontSize: 13 }}>
          <Filter size={14} /> Filtrar:
        </div>
        <select className="estudio-select" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
          <option value="">Todos los abogados</option>
          <option value="null">Sin asignar</option>
          {members.map(m => (
            <option key={m.user_id} value={m.user_id}>
              {m.profile?.full_name || m.user_id.slice(0, 8)}
            </option>
          ))}
        </select>
        <select className="estudio-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="estudio-select" value={filterMatter} onChange={e => setFilterMatter(e.target.value)}>
          <option value="">Todas las materias</option>
          {Object.entries(MATTER_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button className="estudio-btn-primary" style={{ padding: '7px 16px', fontSize: 13 }} onClick={handleFilter}>
          Aplicar
        </button>
        <button
          className="estudio-btn-ghost"
          onClick={() => orgId && load(orgId, filterMember, filterStatus, filterMatter)}
          title="Actualizar"
          style={{ marginLeft: 'auto' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="estudio-card">
        <div className="estudio-card-header">
          <h2 className="estudio-card-title">
            <BarChart2 size={14} style={{ display: 'inline', marginRight: 6 }} />
            {loading ? 'Cargando…' : `${cases.length} expediente${cases.length !== 1 ? 's' : ''}`}
          </h2>
        </div>
        <div className="estudio-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="estudio-spinner" />
            </div>
          ) : cases.length === 0 ? (
            <div className="estudio-empty" style={{ padding: '48px 24px' }}>
              <AlertCircle size={40} className="estudio-empty-icon" />
              <p className="estudio-empty-title">Sin resultados</p>
              <p className="estudio-empty-sub">No hay expedientes que coincidan con los filtros</p>
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
                  <th scope="col">Asignado a</th>
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
                        ? <span title="PJN" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399' }}><ShieldCheck size={13} /> PJN</span>
                        : <span title="IA" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#60a5fa' }}><Bot size={13} /> IA</span>
                      }
                    </td>
                    <td>
                      <span style={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500 }}>
                        {c.title || '(sin título)'}
                      </span>
                    </td>
                    <td>
                      {c.matter
                        ? <span className="estudio-badge estudio-badge--neutral">{MATTER_LABELS[c.matter] || c.matter}</span>
                        : <span style={{ color: '#aaa', fontSize: 13 }}>—</span>
                      }
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS[c.status] || '#888' }}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {c.assigned_profile?.full_name
                        ? c.assigned_profile.full_name
                        : <span style={{ color: '#aaa' }}>Sin asignar</span>
                      }
                    </td>
                    <td style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    <td>
                      {assigning === c.id || archiving === c.id ? (
                        <div className="estudio-spinner" style={{ width: 16, height: 16 }} />
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {/* Select para asignar a un miembro */}
                          <select
                            className="estudio-select"
                            defaultValue=""
                            aria-label={`Asignar expediente "${c.title || 'sin título'}" a un abogado`}
                            style={{ padding: '4px 8px', fontSize: 12, minWidth: 130 }}
                            onChange={e => {
                              if (e.target.value) {
                                handleAssign(c.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                          >
                            <option value="" disabled>Asignar a…</option>
                            {members.map(m => (
                              <option
                                key={m.user_id}
                                value={m.user_id}
                                disabled={m.user_id === c.assigned_to}
                              >
                                {m.profile?.full_name || m.user_id.slice(0, 8)}
                                {m.user_id === c.assigned_to ? ' ✓' : ''}
                              </option>
                            ))}
                          </select>
                          {/* Devolver a bandeja (solo si está asignado) */}
                          {c.assigned_to && (
                            <button
                              className="estudio-btn-ghost"
                              title="Devolver a bandeja"
                              aria-label="Devolver expediente a la bandeja sin asignar"
                              onClick={() => handleAssign(c.id, null)}
                              style={{ padding: '4px 8px', fontSize: 12 }}
                            >
                              <Inbox size={13} />
                            </button>
                          )}
                          {/* Archivar — cualquier miembro puede */}
                          <button
                            className="estudio-btn-ghost"
                            title="Archivar expediente"
                            aria-label={`Archivar expediente "${c.title || 'sin título'}"`}
                            onClick={() => handleArchive(c.id, c.title)}
                            style={{ padding: '4px 8px', fontSize: 12, color: '#f87171' }}
                          >
                            <Archive size={13} />
                          </button>
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
