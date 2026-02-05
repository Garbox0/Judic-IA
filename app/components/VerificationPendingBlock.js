import React from 'react';
import { ShieldAlert, Clock, AlertCircle, Settings, Mail } from 'lucide-react';
import Link from 'next/link';
import './verification-pending-block.css';

const VerificationPendingBlock = ({ status = 'pending' }) => {
    const getContent = () => {
        switch (status) {
            case 'rejected':
                return {
                    icon: <AlertCircle size={48} className="v-text-red" />,
                    title: "Matrícula No Verificada",
                    message: "No pudimos validar tu matrícula profesional con los datos proporcionados. Esto puede deberse a un error en el Tomo, Folio o Colegio seleccionado.",
                    action: (
                        <Link href="/dashboard/settings" className="v-block-btn btn-red">
                            <Settings size={18} /> Corregir Datos en Ajustes
                        </Link>
                    )
                };
            case 'none':
            case null:
                return {
                    icon: <ShieldAlert size={48} className="v-text-amber" />,
                    title: "Acceso Restringido",
                    message: "Para activar la gestión de clientes y el enlace de consulta inteligente, primero debés completar tu información profesional.",
                    action: (
                        <Link href="/dashboard/settings" className="v-block-btn btn-amber">
                            <Settings size={18} /> Completar Perfil Profesional
                        </Link>
                    )
                };
            case 'pending':
            default:
                return {
                    icon: <Clock size={48} className="v-text-blue" />,
                    title: "Verificación en Proceso",
                    message: "Tu matrícula profesional está siendo revisada por nuestro equipo técnico. Te notificaremos por email una vez que el acceso sea habilitado.",
                    action: (
                        <div className="v-block-status">
                            <Mail size={18} /> Recibirás una notificación en tu email
                        </div>
                    )
                };
        }
    };

    const content = getContent();

    return (
        <div className="v-block-overlay">
            <div className="v-block-card glass-panel">
                <div className="v-block-icon-wrapper">
                    {content.icon}
                </div>
                <h2 className="v-block-title">{content.title}</h2>
                <p className="v-block-message">{content.message}</p>
                <div className="v-block-action">
                    {content.action}
                </div>
            </div>
        </div>
    );
};

export default VerificationPendingBlock;
