"use client";
import React, { useState } from 'react';
import { CreditCard, CheckCircle2, AlertTriangle, XCircle, CalendarClock } from 'lucide-react';

const PLAN_LABELS = { enterprise_s: 'Enterprise S', enterprise_m: 'Enterprise M', enterprise_l: 'Enterprise L', enterprise_xl: 'Enterprise XL' };
const PLAN_PRICES = { enterprise_s: '$89.000', enterprise_m: '$149.000', enterprise_l: '$249.000', enterprise_xl: '$449.000' };
const PLAN_MEMBERS = { enterprise_s: 'Hasta 5 miembros', enterprise_m: 'Hasta 10 miembros', enterprise_l: 'Hasta 20 miembros', enterprise_xl: 'Miembros ilimitados' };

const STATUS_CONFIG = {
    active: { icon: CheckCircle2, color: '#22c55e', label: 'Activa' },
    cancelled: { icon: XCircle, color: '#f87171', label: 'Cancelada' },
    past_due: { icon: AlertTriangle, color: '#fbbf24', label: 'Pago pendiente' },
    inactive: { icon: CreditCard, color: '#94a3b8', label: 'Inactiva' },
};

export default function DemoSuscripcionPage() {
    const [cancelling, setCancelling] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [success, setSuccess] = useState(null);

    const orgName = 'Estudio Martínez & Asociados';
    const planTier = 'enterprise_m';
    const planLabel = PLAN_LABELS[planTier];
    const planPrice = PLAN_PRICES[planTier];
    const planMembers = PLAN_MEMBERS[planTier];
    const subStatus = 'active';
    const statusCfg = STATUS_CONFIG[subStatus];
    const StatusIcon = statusCfg.icon;

    const expiryStr = new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

    const handleCancel = () => {
        setCancelling(true);
        setTimeout(() => {
            setSuccess('Suscripción cancelada exitosamente en modo demo.');
            setShowCancelConfirm(false);
            setCancelling(false);
        }, 1000);
    };

    return (
        <div className="estudio-page">
            <div className="estudio-page-header">
                <h2 className="estudio-page-title">Suscripción</h2>
                <p className="estudio-page-subtitle">Gestión del plan Enterprise de {orgName}</p>
            </div>

            {success && (
                <div className="estudio-alert estudio-alert-success" role="alert" style={{ marginBottom: 20 }}>
                    <CheckCircle2 size={16} /> {success}
                </div>
            )}

            {/* Estado actual */}
            <div className="estudio-sub-status-card">
                <div className="estudio-sub-status-row">
                    <div className="estudio-sub-status-icon" style={{ color: statusCfg.color }}>
                        <StatusIcon size={22} />
                    </div>
                    <div className="estudio-sub-status-info">
                        <span className="estudio-sub-status-label">Estado</span>
                        <span className="estudio-sub-status-value" style={{ color: statusCfg.color }}>
                            {statusCfg.label}
                        </span>
                    </div>
                </div>

                <div className="estudio-sub-status-row">
                    <div className="estudio-sub-status-info">
                        <span className="estudio-sub-status-label">Plan {orgName}</span>
                        <span className="estudio-sub-status-value" style={{ color: 'var(--text-primary)', fontSize: '1.2rem' }}>
                            {planLabel}
                        </span>
                        <span className="estudio-sub-details" style={{ marginTop: 4 }}>
                            {planPrice}/mes • {planMembers}
                        </span>
                    </div>
                </div>
            </div>

            {expiryStr && (
                <div className="estudio-sub-box">
                    <CalendarClock size={16} />
                    <div>
                        <strong>Próxima renovación: </strong>
                        <span style={{ color: 'var(--text-secondary)' }}>
                            {expiryStr}
                        </span>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                            El cobro se realizará de forma automática a menos que canceles antes de la fecha.
                        </div>
                    </div>
                </div>
            )}

            {/* Acciones */}
            <h3 className="estudio-section-title">Administrar plan</h3>
            <div className="estudio-sub-actions">
                <a href="mailto:soporte@judic-ia.com" className="estudio-btn-ghost">
                    Cambiar plan o actualizar tarjeta
                </a>
                <button
                    className="estudio-btn-danger"
                    onClick={() => setShowCancelConfirm(true)}
                >
                    Cancelar suscripción
                </button>
            </div>

            {/* Confirmación de Cancelación */}
            {showCancelConfirm && (
                <div className="estudio-modal-overlay">
                    <div className="estudio-modal">
                        <h3 style={{ marginTop: 0, fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                            ¿Estás seguro de cancelar?
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                            Esta acción detendrá los cobros futuros. Tu equipo mantendrá acceso al panel hasta la fecha de expiración ({expiryStr}). Posteriormente, el equipo pasará a estado inactivo.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                className="estudio-btn-ghost"
                                onClick={() => setShowCancelConfirm(false)}
                                disabled={cancelling}
                            >
                                Mantener suscripción
                            </button>
                            <button
                                className="estudio-btn-danger"
                                onClick={handleCancel}
                                disabled={cancelling}
                            >
                                {cancelling ? 'Cancelando...' : 'Sí, cancelar suscripción'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
