"use client";
import React, { useState } from 'react';
import { Users, UserPlus, X, Mail, Clock, Send, ShieldCheck, Scale, RefreshCw } from 'lucide-react';

const ROLE_LABELS = { owner: 'Titular', supervisor: 'Supervisor', abogado: 'Abogado' };

export default function DemoMiembrosPage() {
    const [toast, setToast] = useState(null);
    const [inviteForm, setInviteForm] = useState({ email: '', role: 'abogado' });
    const [inviting, setInviting] = useState(false);
    const [removing, setRemoving] = useState(null);
    const [changingRole, setChangingRole] = useState(null);

    const initialMembers = [
        { user_id: 'dm', role: 'owner', joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 300).toISOString(), profile: { full_name: 'Dr. Martínez' } },
        { user_id: 'dl', role: 'supervisor', joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 150).toISOString(), profile: { full_name: 'Dra. López' } },
        { user_id: 'dg', role: 'abogado', joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(), profile: { full_name: 'Dr. García' } },
        { user_id: 'df', role: 'abogado', joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(), profile: { full_name: 'Dra. Fernández' } }
    ];

    const initialInvites = [
        { id: '1', email: 'carlos.suarez@estudio.com', role: 'abogado', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString() }
    ];

    const [members, setMembers] = useState(initialMembers);
    const [invites, setInvites] = useState(initialInvites);

    const myUserId = 'dm';
    const memberLimit = 10;
    const atLimit = members.length >= memberLimit;

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleRemove = (targetUserId) => {
        if (!confirm('¿Estás seguro de que deseas remover este miembro del estudio? Sus expedientes asignados volverán a la bandeja general.')) return;
        setRemoving(targetUserId);
        setTimeout(() => {
            setMembers(prev => prev.filter(m => m.user_id !== targetUserId));
            showToast('Miembro removido exitosamente en el modo demo.');
            setRemoving(null);
        }, 600);
    };

    const handleChangeRole = (targetUserId, newRole) => {
        setChangingRole(targetUserId);
        setTimeout(() => {
            setMembers(prev => prev.map(m => m.user_id === targetUserId ? { ...m, role: newRole } : m));
            showToast('Rol de miembro actualizado.');
            setChangingRole(null);
        }, 600);
    };

    const handleInvite = (e) => {
        e.preventDefault();
        if (!inviteForm.email) return;
        setInviting(true);
        setTimeout(() => {
            const newInvite = {
                id: Date.now().toString(),
                email: inviteForm.email,
                role: inviteForm.role,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
            };
            setInvites(prev => [newInvite, ...prev]);
            showToast(`Invitación simulada enviada a ${inviteForm.email}`);
            setInviteForm({ email: '', role: 'abogado' });
            setInviting(false);
        }, 800);
    };

    const handleCancelInvite = (inviteId) => {
        setInvites(prev => prev.filter(i => i.id !== inviteId));
        showToast('Invitación cancelada.');
    };

    const refreshDemo = () => {
        setMembers(initialMembers);
        setInvites(initialInvites);
        showToast('Datos de demo restaurados.', 'success');
    }

    return (
        <div>
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 9999,
                    padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    background: toast.type === 'error' ? '#fee2e2' : '#d1fae5',
                    color: toast.type === 'error' ? '#991b1b' : '#065f46',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    transition: 'all 0.3s ease'
                }}>
                    {toast.msg}
                </div>
            )}

            <div className="estudio-page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="estudio-page-title">Miembros</h1>
                        <p className="estudio-page-sub">{`${members.length} / ${memberLimit} miembros`}</p>
                    </div>
                    <button
                        className="estudio-btn-ghost"
                        onClick={refreshDemo}
                        title="Restaurar datos de prueba"
                    >
                        <RefreshCw size={14} /> Restaurar Demo
                    </button>
                </div>
            </div>

            <div className="estudio-card" style={{ marginBottom: 20 }}>
                <div className="estudio-card-header">
                    <h2 className="estudio-card-title"><UserPlus size={14} style={{ display: 'inline', marginRight: 6 }} />Invitar miembro</h2>
                </div>
                <div className="estudio-card-body">
                    {atLimit ? (
                        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#9a3412' }}>
                            Has alcanzado el límite de {memberLimit} miembros de tu plan de demostración.
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
                                    <th style={{ width: 40 }}></th>
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
                                                    {m.profile.full_name.replace('Dr. ', '').replace('Dra. ', '').slice(0, 2).toUpperCase()}
                                                </div>
                                                <span style={{ fontSize: 14, fontWeight: 500 }}>
                                                    {m.profile.full_name}
                                                    {m.user_id === myUserId && <span style={{ marginLeft: 6, fontSize: 11, color: '#c9a227' }}>(yo)</span>}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            {m.user_id !== myUserId && m.role !== 'owner' ? (
                                                <select
                                                    className="estudio-select"
                                                    value={m.role}
                                                    disabled={changingRole === m.user_id}
                                                    aria-label={`Cambiar rol de ${m.profile.full_name}`}
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
                                            {new Date(m.joined_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </td>
                                        <td>
                                            {m.user_id !== myUserId && m.role !== 'owner' && (
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {invites.length > 0 && (
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
