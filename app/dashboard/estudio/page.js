"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { Inbox, FolderOpen, Users, TrendingUp, ChevronRight, ShieldCheck, Bot } from 'lucide-react';

export default function EstudioOverviewPage() {
  const [stats, setStats] = useState({ miembros: 0, bandeja: 0, enCurso: 0, total: 0 });
  const [recentBandeja, setRecentBandeja] = useState([]);
  const [recentMembers, setRecentMembers] = useState([]);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('org_id, full_name')
        .eq('id', user.id)
        .single();

      if (!prof?.org_id) return;
      const orgId = prof.org_id;

      const { data: org } = await supabase
        .from('organizations')
        .select('razon_social, name')
        .eq('id', orgId)
        .single();

      setOrgName(org?.razon_social || org?.name || 'Mi Estudio');

      const [membersRes, bandejaRes, enCursoRes, totalRes] = await Promise.all([
        supabase.from('org_members').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('cases').select('*', { count: 'exact', head: true }).eq('org_id', orgId).is('assigned_to', null).neq('status', 'archived'),
        supabase.from('cases').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'in_progress'),
        supabase.from('cases').select('*', { count: 'exact', head: true }).eq('org_id', orgId).neq('status', 'archived'),
      ]);

      setStats({
        miembros: membersRes.count || 0,
        bandeja:  bandejaRes.count  || 0,
        enCurso:  enCursoRes.count  || 0,
        total:    totalRes.count    || 0,
      });

      // 5 más recientes en bandeja
      const { data: bandeja } = await supabase
        .from('cases')
        .select('id, title, matter, source, created_at, case_number')
        .eq('org_id', orgId)
        .is('assigned_to', null)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentBandeja(bandeja || []);

      // 5 miembros más recientes
      const { data: members } = await supabase
        .from('org_members')
        .select('user_id, role, joined_at, profile:user_id(full_name)')
        .eq('org_id', orgId)
        .order('joined_at', { ascending: false })
        .limit(5);

      setRecentMembers(members || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="estudio-loading"><div className="estudio-spinner" /></div>;

  const ROLE_LABELS = { owner: 'Titular', supervisor: 'Supervisor', abogado: 'Abogado', lawyer: 'Abogado' };

  return (
    <div>
      <div className="estudio-page-header">
        <h1 className="estudio-page-title">Resumen del Estudio</h1>
        <p className="estudio-page-sub">{orgName}</p>
      </div>

      {/* Stats */}
      <div className="estudio-stats">
        <div className="estudio-stat-card">
          <span className="estudio-stat-label">Miembros</span>
          <span className="estudio-stat-value gold">{stats.miembros}</span>
        </div>
        <div className="estudio-stat-card">
          <span className="estudio-stat-label">En Bandeja</span>
          <span className="estudio-stat-value blue">{stats.bandeja}</span>
        </div>
        <div className="estudio-stat-card">
          <span className="estudio-stat-label">En Curso</span>
          <span className="estudio-stat-value emerald">{stats.enCurso}</span>
        </div>
        <div className="estudio-stat-card">
          <span className="estudio-stat-label">Total</span>
          <span className="estudio-stat-value">{stats.total}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Bandeja reciente */}
        <div className="estudio-card">
          <div className="estudio-card-header">
            <h2 className="estudio-card-title"><Inbox size={14} style={{ display: 'inline', marginRight: 6 }} />Bandeja General</h2>
            <Link href="/dashboard/estudio/bandeja" style={{ fontSize: 12, color: '#c9a227', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Ver todo <ChevronRight size={13} />
            </Link>
          </div>
          <div className="estudio-card-body">
            {recentBandeja.length === 0 ? (
              <div className="estudio-empty">
                <Inbox size={32} className="estudio-empty-icon" />
                <p className="estudio-empty-title">Bandeja vacía</p>
              </div>
            ) : recentBandeja.map(c => (
              <div key={c.id} className="estudio-table-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  {c.source === 'pjn_import'
                    ? <ShieldCheck size={14} style={{ color: '#34d399', flexShrink: 0 }} />
                    : <Bot size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
                  }
                  <div style={{ minWidth: 0 }}>
                    {c.case_number && (
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#c9a227', display: 'block' }}>{c.case_number}</span>
                    )}
                    <span className="estudio-row-title">{c.title}</span>
                  </div>
                </div>
                <span className="estudio-row-meta">{c.matter || '-'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Miembros recientes */}
        <div className="estudio-card">
          <div className="estudio-card-header">
            <h2 className="estudio-card-title"><Users size={14} style={{ display: 'inline', marginRight: 6 }} />Miembros</h2>
            <Link href="/dashboard/estudio/miembros" style={{ fontSize: 12, color: '#c9a227', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Ver todo <ChevronRight size={13} />
            </Link>
          </div>
          <div className="estudio-card-body">
            {recentMembers.length === 0 ? (
              <div className="estudio-empty">
                <Users size={32} className="estudio-empty-icon" />
                <p className="estudio-empty-title">Sin miembros aún</p>
              </div>
            ) : recentMembers.map(m => (
              <div key={m.user_id} className="estudio-table-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(201,162,39,0.1)', border: '1px solid rgba(201,162,39,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#c9a227', flexShrink: 0 }}>
                    {(m.profile?.full_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="estudio-row-title">{m.profile?.full_name || 'Sin nombre'}</span>
                </div>
                <span className={`estudio-badge estudio-badge--${m.role}`}>{ROLE_LABELS[m.role] || m.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
