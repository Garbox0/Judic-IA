"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Users, UserPlus, X, Mail, Clock, Send, ShieldCheck, Scale } from 'lucide-react';

const ROLE_LABELS = { owner: 'Titular', supervisor: 'Supervisor', abogado: 'Abogado' };

export default function MiembrosPage() {
  const [members,     setMembers]     = useState([]);
  const [invites,     setInvites]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [orgId,       setOrgId]       = useState(null);
  const [userId,      setUserId]      = useState(null);
  const [myRole,      setMyRole]      = useState(null);
  const [org,         setOrg]         = useState(null);
  const [removing,    setRemoving]    = useState(null);
  const [changingRole, setChangingRole] = useState(null); // userId being updated
  const [toast,       setToast]       = useState(null);
  const [inviteForm,  setInviteForm]  = useState({ email: '', role: 'abogado' });
  const [inviting,    setInviting]    = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = async (oId) => {
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from('org_members')
        .select('user_id, role, joined_at, profile:user_id(full_name)')
        .eq('org_id', oId)
        .order('joined_at', { ascending: true }),
      supabase
        .from('org_invitations')
        .select('id, email, role, created_at, expires_at, status')
        .eq('org_id', oId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);
    setMembers(membersRes.data || []);
    setInvites(invitesRes.data || []);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: prof } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!prof?.org_id) return;

      const { data: member } = await supabase
        .from('org_members')
        .select('role, org:org_id(id, plan_tier, member_limit, razon_social, name)')
        .eq('user_id', user.id)
        .eq('org_id', prof.org_id)
        .single();

      setMyRole(member?.role);
      setOrg(member?.org);
      setOrgId(prof.org_id);

      await loadAll(prof.org_id);
      setLoading(false);
    };
    init();
  }, []);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const handleRemove = async (targetUserId) => {
    if (!confirm('¿Estás seguro de que deseas remover este miembro del estudio? Sus expedientes asignados volverán a la bandeja general.')) return;
    setRemoving(targetUserId);
    try {
      const token = await getToken();
      const res = await fetch('/api/estudio/miembro', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      showToast('Miembro removido. Sus expedientes volvieron a la bandeja.');
      setMembers(prev => prev.filter(m => m.user_id !== targetUserId));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRemoving(null);
    }
  };

  const handleChangeRole = async (targetUserId, newRole) => {
    setChangingRole(targetUserId);
    try {
      const token = await getToken();
      const res = await fetch('/api/estudio/miembro', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ target_user_id: targetUserId, new_role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      showToast('Rol actualizado correctamente');
      setMembers(prev => prev.map(m => m.user_id === targetUserId ? { ...m, role: newRole } : m));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setChangingRole(null);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.email) return;
    setInviting(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/estudio/invitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: inviteForm.email, role: inviteForm.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al invitar');
      showToast(`Invitación enviada a ${inviteForm.email}`);
      setInviteForm({ email: '', role: 'abogado' });
      await loadAll(orgId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId) => {
    try {
      const token = await getToken();
      const res = await fetch('/api/estudio/invitacion', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ invitation_id: inviteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cancelar');
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      showToast('Invitación cancelada');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const isOwner = myRole === 'owner';
  const memberLimit = org?.member_limit;
  const atLimit = memberLimit !== null && members.length >= memberLimit;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div className="estudio-spinner" />
    </div>
  );

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
        <h1 className="estudio-page-title">Miembros</h1>
        <p className="estudio-page-sub">
          {memberLimit
            ? `${members.length} / ${memberLimit} miembros`
            : `${members.length} miembro${members.length !== 1 ? 's' : ''}`
          }
        </p>
      </div>

      {/* Formulario de invitación (owner only) */}
      {isOwner && (
        <div className="estudio-card" style={{ marginBottom: 20 }}>
          <div className="estudio-card-header">
            <h2 className="estudio-card-title"><UserPlus size={14} style={{ display: 'inline', marginRight: 6 }} />Invitar miembro</h2>
          </div>
          <div className="estudio-card-body">
            {atLimit ? (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#9a3412' }}>
                Has alcanzado el límite de {memberLimit} miembros de tu plan. Actualizá tu plan para agregar más.
              </div>
            ) : (
              <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: 180 }}>
                  <label className="estudio-label">Email del nuevo miembro</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      className="estudio-input"
                      placeholder="abogado@estudio.com"
                      value={inviteForm.email}
                      onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                      style={{ paddingLeft: 32 }}
                      required
                    />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label className="estudio-label">Rol</label>
                  <select
                    className="estudio-select"
                    value={inviteForm.role}
                    onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                    style={{ width: '100%' }}
                  >
                    <option value="abogado">Abogado</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="estudio-btn-primary"
                  disabled={inviting}
                  style={{ padding: '10px 20px' }}
                >
                  {inviting ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="estudio-spinner" style={{ width: 14, height: 14 }} /> Enviando…
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Send size={14} /> Invitar
                    </span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Lista de miembros */}
      <div className="estudio-card" style={{ marginBottom: 20 }}>
        <div className="estudio-card-header">
          <h2 className="estudio-card-title"><Users size={14} style={{ display: 'inline', marginRight: 6 }} />Miembros activos</h2>
        </div>
        <div className="estudio-card-body" style={{ padding: 0 }}>
          {members.length === 0 ? (
            <div className="estudio-empty" style={{ padding: '40px 24px' }}>
              <Users size={36} className="estudio-empty-icon" />
              <p className="estudio-empty-title">Sin miembros</p>
            </div>
          ) : (
            <table className="estudio-table">
              <thead>
                <tr>
                  <th>Miembro</th>
                  <th>Rol</th>
                  <th>Fecha de ingreso</th>
                  {isOwner && <th style={{ width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.user_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: 'rgba(201,162,39,0.1)', border: '1px solid rgba(201,162,39,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, color: '#c9a227', flexShrink: 0
                        }}>
                          {(m.profile?.full_name || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>
                          {m.profile?.full_name || 'Sin nombre'}
                          {m.user_id === userId && <span style={{ marginLeft: 6, fontSize: 11, color: '#c9a227' }}>(yo)</span>}
                        </span>
                      </div>
                    </td>
                    <td>
                      {/* Owner: select para cambiar rol (excepto para sí mismo y para el owner) */}
                      {isOwner && m.user_id !== userId && m.role !== 'owner' ? (
                        <select
                          className="estudio-select"
                          value={m.role}
                          disabled={changingRole === m.user_id}
                          aria-label={`Cambiar rol de ${m.profile?.full_name || 'miembro'}`}
                          onChange={e => handleChangeRole(m.user_id, e.target.value)}
                          style={{ padding: '4px 10px', fontSize: 13, minWidth: 130 }}
                        >
                          <option value="abogado">Abogado</option>
                          <option value="supervisor">Supervisor</option>
                        </select>
                      ) : (
                        <span className={`estudio-badge estudio-badge--${m.role}`}>
                          {m.role === 'owner' && <ShieldCheck size={11} style={{ display: 'inline', marginRight: 4 }} />}
                          {m.role === 'supervisor' && <Scale size={11} style={{ display: 'inline', marginRight: 4 }} />}
                          {ROLE_LABELS[m.role] || m.role}
                        </span>
                      )}
                    </td>
                    <td style={{ color: '#888', fontSize: 13 }}>
                      {m.joined_at
                        ? new Date(m.joined_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'
                      }
                    </td>
                    {isOwner && (
                      <td>
                        {m.user_id !== userId && m.role !== 'owner' && (
                          <button
                            className="estudio-btn-danger-ghost"
                            onClick={() => handleRemove(m.user_id)}
                            disabled={removing === m.user_id}
                            title="Remover miembro"
                          >
                            {removing === m.user_id
                              ? <div className="estudio-spinner" style={{ width: 14, height: 14 }} />
                              : <X size={15} />
                            }
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Invitaciones pendientes */}
      {isOwner && invites.length > 0 && (
        <div className="estudio-card">
          <div className="estudio-card-header">
            <h2 className="estudio-card-title"><Clock size={14} style={{ display: 'inline', marginRight: 6 }} />Invitaciones pendientes</h2>
          </div>
          <div className="estudio-card-body" style={{ padding: 0 }}>
            <table className="estudio-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Enviada</th>
                  <th>Vence</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invites.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontSize: 13 }}>{inv.email}</td>
                    <td>
                      <span className={`estudio-badge estudio-badge--${inv.role}`}>
                        {ROLE_LABELS[inv.role] || inv.role}
                      </span>
                    </td>
                    <td style={{ color: '#888', fontSize: 12 }}>
                      {new Date(inv.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td style={{ color: new Date(inv.expires_at) < new Date() ? '#f87171' : '#888', fontSize: 12 }}>
                      {new Date(inv.expires_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td>
                      <button
                        className="estudio-btn-danger-ghost"
                        onClick={() => handleCancelInvite(inv.id)}
                        title="Cancelar invitación"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
