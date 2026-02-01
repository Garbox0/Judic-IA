"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
    X,
    CheckCircle2,
    Loader2,
    User,
    Mail,
    Phone,
    Briefcase,
    CreditCard
} from 'lucide-react';
import '../manual-case-modal.css'; // Reuse the same styles

export default function EditCaseModal({ isOpen, onClose, caseData, onRefresh }) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const [form, setForm] = useState({
        title: '',
        matter: '',
        contact_name: '',
        dni: '',
        idType: 'DNI',
        email: '',
        phone: ''
    });

    useEffect(() => {
        if (caseData) {
            // Check if DNI/CUIT/CUIL in DB needs parsing for type
            const rawDni = caseData.inquiry?.dni || ''; // [NOTE] If we added a dni column to inquiries. 
            // WAIT: Currently we store it in the summary or we need to add a column.
            // The user's image shows they wrote "20-39156370-9" in the ID field.
            // Let's assume we want to store it more formally or parse from summary if we can.
            // Actually, for simplicity and to match the user's request of "no romper", 
            // let's just use what's in the linked inquiry if we have it, or let them set it.

            setForm({
                title: caseData.title || '',
                matter: caseData.matter || '',
                contact_name: caseData.inquiry?.contact_name || '',
                dni: caseData.inquiry?.dni || '',
                idType: caseData.inquiry?.id_type || 'DNI',
                email: caseData.inquiry?.contact_email || '',
                phone: caseData.inquiry?.contact_phone || ''
            });
        }
    }, [caseData, isOpen]);

    if (!isOpen) return null;

    const formatIdent = (value, type) => {
        const digits = value.replace(/\D/g, '');
        if (type === 'DNI') return digits.slice(0, 9);
        if (digits.length <= 2) return digits;
        if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
        return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10, 11)}`;
    };

    const handleChange = (field, value) => {
        if (field === 'dni') {
            setForm(prev => ({ ...prev, [field]: formatIdent(value, prev.idType) }));
        } else if (field === 'idType') {
            setForm(prev => ({ ...prev, [field]: value, dni: '' }));
        } else {
            setForm(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Update Case
            const { error: caseError } = await supabase
                .from('cases')
                .update({
                    title: form.title,
                    matter: form.matter,
                    updated_at: new Date().toISOString()
                })
                .eq('id', caseData.id);

            if (caseError) throw caseError;

            // 2. Update Inquiry
            if (caseData.inquiry_id) {
                const { error: inqError } = await supabase
                    .from('inquiries')
                    .update({
                        contact_name: form.contact_name,
                        contact_email: form.email?.trim() || null,
                        contact_phone: form.phone?.trim() || null,
                        dni: form.dni?.trim() || null,
                        id_type: form.idType || 'DNI',
                        case_type: form.matter
                    })
                    .eq('id', caseData.inquiry_id);

                if (inqError) throw inqError;
            }

            setSuccess(true);
            setTimeout(() => {
                onRefresh();
                setSuccess(false);
                onClose();
            }, 1500);

        } catch (error) {
            console.error("Error updating case:", error);
            alert("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="manual-case-modal edit-mode glass-panel fade-in">
                <button className="btn-close-modal" onClick={onClose}><X size={20} /></button>

                {success ? (
                    <div className="success-state">
                        <CheckCircle2 size={60} className="text-green-500 mb-4" />
                        <h2>Cambios Guardados</h2>
                        <p>La información ha sido actualizada correctamente.</p>
                    </div>
                ) : (
                    <>
                        <div className="modal-header">
                            <h2>Editar Expediente</h2>
                            <p>Modifica la información del caso y contacto principal.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="manual-form">
                            <div className="scroll-area">
                                <div className="form-section">
                                    <h3><Briefcase size={16} /> Información del Caso</h3>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            placeholder="Título del Expediente"
                                            value={form.title}
                                            onChange={e => handleChange('title', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="input-group">
                                        <select
                                            value={form.matter}
                                            className="select-premium"
                                            onChange={e => handleChange('matter', e.target.value)}
                                        >
                                            <option>Civil y Comercial</option>
                                            <option>Laboral</option>
                                            <option>Familia</option>
                                            <option>Penal</option>
                                            <option>Sucesiones</option>
                                            <option>Administrativo</option>
                                            <option>Previsional</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h3><User size={16} /> Contacto Principal</h3>
                                    <div className="input-row">
                                        <div className="input-group">
                                            <input
                                                type="text"
                                                placeholder="Nombre completo"
                                                value={form.contact_name}
                                                onChange={e => handleChange('contact_name', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="input-group">
                                            <div className="id-type-selector">
                                                {['DNI', 'CUIT', 'CUIL'].map(type => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        className={form.idType === type ? 'active' : ''}
                                                        onClick={() => handleChange('idType', type)}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                            <input
                                                type="text"
                                                placeholder={form.idType}
                                                className="with-icon"
                                                value={form.dni}
                                                onChange={e => handleChange('dni', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="input-row">
                                        <div className="input-group">
                                            <Mail size={14} className="icon-inner" />
                                            <input
                                                type="email"
                                                placeholder="Email"
                                                className="with-icon"
                                                value={form.email}
                                                onChange={e => handleChange('email', e.target.value)}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <Phone size={14} className="icon-inner" />
                                            <input
                                                type="text"
                                                placeholder="Teléfono"
                                                className="with-icon"
                                                value={form.phone}
                                                onChange={e => handleChange('phone', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer-lux">
                                <button type="button" className="btn-cancel-lux" onClick={onClose}>Cancelar</button>
                                <button type="submit" className="btn-submit-lux" disabled={loading}>
                                    {loading ? <><Loader2 className="animate-spin" size={20} /> Guardando...</> : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
