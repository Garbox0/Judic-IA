import React from 'react';
import { ShieldAlert, Clock, AlertCircle, Settings, Mail } from 'lucide-react';
import Link from 'next/link';
import './verification-pending-block.css';

const VerificationPendingBlock = ({ status = 'pending' }) => {
    const getContent = () => {
        switch (status) {
            case 'rejected':
                return {
                    icon: <AlertCircle size={18} className="v-text-red" />,
                    title: "Matrícula No Verificada",
                    message: "No pudimos validar tu matrícula. Revisá tus datos en Ajustes.",
                    variant: 'red',
                    action: (
                        <Link href="/dashboard/settings" className="v-banner-link v-link-red">
                            <Settings size={14} /> Corregir
                        </Link>
                    )
                };
            case 'none':
            case null:
                return {
                    icon: <ShieldAlert size={18} className="v-text-amber" />,
                    title: "Perfil Incompleto",
                    message: "Completá tu información profesional para activar clientes.",
                    variant: 'amber',
                    action: (
                        <Link href="/dashboard/settings" className="v-banner-link v-link-amber">
                            <Settings size={14} /> Completar
                        </Link>
                    )
                };
            case 'pending':
            default:
                return {
                    icon: <Clock size={18} className="v-text-blue" />,
                    title: "Verificación en Proceso",
                    message: "Tu matrícula está siendo revisada. Te notificaremos por email.",
                    variant: 'blue',
                    action: (
                        <span className="v-banner-badge">
                            <Mail size={14} /> Te avisamos por email
                        </span>
                    )
                };
        }
    };

    const content = getContent();

    return (
        <div className={`v-banner v-banner-${content.variant}`}>
            <div className="v-banner-icon">{content.icon}</div>
            <div className="v-banner-text">
                <strong>{content.title}</strong>
                <span className="v-banner-msg">{content.message}</span>
            </div>
            <div className="v-banner-action">{content.action}</div>
        </div>
    );
};

export default VerificationPendingBlock;
