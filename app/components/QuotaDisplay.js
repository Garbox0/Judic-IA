'use client';

import { useState, useEffect } from 'react';
import { getUsageInfo, getPlanName, isNearingQuotaLimit } from '@/lib/planLimits';
import { AlertCircle, TrendingUp, Zap } from 'lucide-react';
import './QuotaDisplay.css';

/**
 * Componente para mostrar el uso de quotas de un usuario
 * @param {object} profile - Profile de Supabase
 * @param {string} action - 'ai_messages', 'inquiries', 'research_reports'
 * @param {boolean} compact - Mostrar versión compacta
 */
export default function QuotaDisplay({ profile, action, compact = false }) {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (!profile || !action) return;

    const info = getUsageInfo(profile, action);
    setUsage(info);
  }, [profile, action]);

  if (!usage) return null;

  // Etiquetas legibles
  const labels = {
    ai_messages: 'Mensajes IA',
    inquiries: 'Consultas',
    research_reports: 'Reportes de Investigación'
  };

  const label = labels[action] || action;
  const isNearing = isNearingQuotaLimit(profile, action);
  const isExceeded = !usage.canUse;

  // Versión compacta (solo texto)
  if (compact) {
    return (
      <div className={`quota-compact ${isExceeded ? 'exceeded' : isNearing ? 'warning' : ''}`}>
        {usage.isUnlimited ? (
          <span>✨ Ilimitado</span>
        ) : (
          <span>
            {usage.used} / {usage.limit} {label}
          </span>
        )}
      </div>
    );
  }

  // Versión completa (con barra de progreso)
  return (
    <div className="quota-display">
      <div className="quota-header">
        <span className="quota-label">{label}</span>
        {usage.isUnlimited ? (
          <span className="quota-unlimited">
            <Zap size={14} /> Ilimitado
          </span>
        ) : (
          <span className={`quota-count ${isExceeded ? 'exceeded' : isNearing ? 'warning' : ''}`}>
            {usage.used} / {usage.limit}
          </span>
        )}
      </div>

      {!usage.isUnlimited && (
        <>
          <div className="quota-bar">
            <div
              className={`quota-fill ${isExceeded ? 'exceeded' : isNearing ? 'warning' : ''}`}
              style={{ width: `${Math.min(100, usage.percentage)}%` }}
            />
          </div>

          {isExceeded && (
            <div className="quota-alert exceeded">
              <AlertCircle size={14} />
              <span>Límite alcanzado. <a href="/dashboard/settings">Actualizar plan</a></span>
            </div>
          )}

          {isNearing && !isExceeded && (
            <div className="quota-alert warning">
              <AlertCircle size={14} />
              <span>Quedan solo {usage.remaining} {label.toLowerCase()}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Componente para mostrar todas las quotas de un usuario (dashboard)
 */
export function QuotaSummary({ profile }) {
  if (!profile) return null;

  return (
    <div className="quota-summary">
      <div className="quota-summary-header">
        <h3>Tu Plan: {getPlanName(profile.plan_tier)}</h3>
        {profile.plan_tier !== 'professional' && profile.plan_tier !== 'enterprise' && (
          <a href="/dashboard/settings" className="btn-upgrade-small">
            <TrendingUp size={14} /> Actualizar
          </a>
        )}
      </div>

      <div className="quota-grid">
        <QuotaDisplay profile={profile} action="research_reports" />
      </div>
    </div>
  );
}

/**
 * Skeleton loader para QuotaSummary (evita layout shift mientras carga el profile)
 */
export function QuotaSummarySkeleton() {
  return (
    <div className="quota-summary">
      <div className="quota-summary-header">
        <div className="skeleton-text" style={{ width: '180px', height: '1.125rem' }} />
        <div className="skeleton-text" style={{ width: '100px', height: '2rem', borderRadius: '8px' }} />
      </div>
      <div className="quota-grid">
        {[1].map(i => (
          <div key={i} className="quota-display">
            <div className="quota-header">
              <div className="skeleton-text" style={{ width: '100px', height: '0.875rem' }} />
              <div className="skeleton-text" style={{ width: '50px', height: '0.875rem' }} />
            </div>
            <div className="quota-bar">
              <div className="skeleton-fill" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
