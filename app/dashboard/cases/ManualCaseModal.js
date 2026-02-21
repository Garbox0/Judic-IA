"use client";
import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
    X,
    Upload,
    Mail,
    Phone,
    Briefcase,
    FileText,
    CheckCircle2,
    Loader2,
    Plus,
    Users,
    UserMinus,
    AlertCircle
} from 'lucide-react';
import './manual-case-modal.css';

export default function ManualCaseModal({ isOpen, onClose, onRefresh }) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [files, setFiles] = useState([]);
    const fileInputRef = useRef(null);

    // Dynamic State for Claimants and Respondents
    const [claimants, setClaimants] = useState([{ name: '', dni: '', email: '', phone: '', idType: 'DNI' }]);
    const [respondents, setRespondents] = useState([{ name: '', dni: '', idType: 'DNI' }]);
    const [caseTitle, setCaseTitle] = useState('');
    const [matter, setMatter] = useState('Civil y Comercial');

    if (!isOpen) return null;

    // --- Helpers ---
    const formatIdent = (value, type) => {
        const digits = value.replace(/\D/g, '');

        if (type === 'DNI') {
            return digits.slice(0, 9);
        }

        // CUIT/CUIL: ##-########-#
        if (digits.length <= 2) return digits;
        if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
        return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10, 11)}`;
    };

    // Validación CUIT/CUIL - Módulo 11
    const validateCuit = (value) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) return null; // Incomplete
        const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
        let sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(digits[i]) * weights[i];
        }
        const remainder = 11 - (sum % 11);
        const checkDigit = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder;
        return parseInt(digits[10]) === checkDigit;
    };

    const getCuitError = (value, type) => {
        if (type === 'DNI') return null;
        const digits = value.replace(/\D/g, '');
        if (digits.length === 0) return null;
        if (digits.length < 11) return 'Incompleto';
        const valid = validateCuit(value);
        if (valid === false) return `${type} inválido`;
        return null;
    };

    // --- Dynamic Row Handlers ---
    const addClaimant = () => setClaimants([...claimants, { name: '', dni: '', email: '', phone: '', idType: 'DNI' }]);
    const removeClaimant = (index) => {
        if (claimants.length > 1) setClaimants(claimants.filter((_, i) => i !== index));
    };
    const updateClaimant = (index, field, value) => {
        const next = [...claimants];
        if (field === 'dni') {
            next[index][field] = formatIdent(value, next[index].idType);
        } else if (field === 'idType') {
            next[index][field] = value;
            next[index].dni = ''; // Clear ID when type changes to avoid formatting mess
        } else {
            next[index][field] = value;
        }
        setClaimants(next);
    };

    const addRespondent = () => setRespondents([...respondents, { name: '', dni: '', idType: 'DNI' }]);
    const removeRespondent = (index) => {
        if (respondents.length > 1) setRespondents(respondents.filter((_, i) => i !== index));
    };
    const updateRespondent = (index, field, value) => {
        const next = [...respondents];
        if (field === 'dni') {
            next[index][field] = formatIdent(value, next[index].idType);
        } else if (field === 'idType') {
            next[index][field] = value;
            next[index].dni = '';
        } else {
            next[index][field] = value;
        }
        setRespondents(next);
    };

    // --- File Handlers ---
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files || []);
        setFiles(prev => [...prev, ...selectedFiles]);
    };

    const removeFile = (index) => setFiles(prev => prev.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No autenticado");

            const mainClaimant = claimants[0];
            const inquiryId = crypto.randomUUID();

            // Construct Summary for context in Judic-IA format
            const formattedClaimants = claimants.map(c => `- ${c.name} (${c.idType}: ${c.dni || 'N/A'}) | ${c.email || ''} | ${c.phone || ''}`).join('\n');
            const formattedRespondents = respondents.filter(r => r.name).map(r => `- ${r.name} (${r.idType}: ${r.dni || 'N/A'})`).join('\n');

            const fullSummary = `
**EXPEDIENTE CREADO MANUALMENTE**
Fecha: ${new Date().toLocaleString()}

**DENUNCIANTES / ACTORES:**
${formattedClaimants}

**DENUNCIADOS / DEMANDADOS:**
${formattedRespondents || 'Sin datos de denunciados.'}

**MATERIA:** ${matter}
            `.trim();

            // 0. Get Lawyer Org
            const { data: profile } = await supabase
                .from('profiles')
                .select('org_id')
                .eq('id', user.id)
                .maybeSingle();

            const orgId = profile?.org_id || null;

            // 1. Create Inquiry (Manual)
            const { error: inquiryError } = await supabase.from('inquiries').insert({
                id: inquiryId,
                contact_name: mainClaimant.name, // Use primary claimant as main contact
                contact_email: mainClaimant.email?.trim() || null,
                contact_phone: mainClaimant.phone?.trim() || null,
                dni: mainClaimant.dni?.trim() || null,
                id_type: mainClaimant.idType || 'DNI',
                case_type: matter,
                assigned_lawyer_id: user.id,
                org_id: orgId,
                status: 'archived',
                source: 'manual',
                ai_summary: fullSummary
            });

            if (inquiryError) throw inquiryError;

            // 2. Create Case
            const { error: caseError } = await supabase.from('cases').insert({
                org_id: orgId,
                inquiry_id: inquiryId,
                title: caseTitle,
                matter: matter,
                status: 'open',
                assigned_to: user.id
            });

            if (caseError) throw caseError;

            // 3. Upload Files
            if (files.length > 0) {
                for (const file of files) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${inquiryId}/${Math.random().toString(36).substring(7)}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('inquiry-attachments')
                        .upload(fileName, file);

                    if (!uploadError) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('inquiry-attachments')
                            .getPublicUrl(fileName);

                        await supabase.from('attachments').insert({
                            inquiry_id: inquiryId,
                            file_name: file.name,
                            file_url: publicUrl,
                            file_type: file.type,
                            file_size: file.size
                        });
                    }
                }
            }

            setSuccess(true);
            setTimeout(() => {
                onRefresh();
                handleClose();
            }, 2000);

        } catch (error) {
            console.error("Error creating case:", error);
            // Non-generic error handling could go here
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSuccess(false);
        setFiles([]);
        setClaimants([{ name: '', dni: '', email: '', phone: '', idType: 'DNI' }]);
        setRespondents([{ name: '', dni: '', idType: 'DNI' }]);
        setCaseTitle('');
        setMatter('Civil y Comercial');
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="manual-case-modal glass-panel fade-in" role="dialog" aria-modal="true" aria-labelledby="manual-case-modal-title">
                <button className="btn-close-modal" onClick={handleClose} aria-label="Cerrar modal"><X size={20} aria-hidden="true" /></button>

                {success ? (
                    <div className="success-state">
                        <div className="success-icon-wrapper">
                            <CheckCircle2 size={80} className="text-green-500" />
                        </div>
                        <h2>Expediente Creado</h2>
                        <p>La carpeta legal y documentación se han generado con éxito.</p>
                        <Loader2 className="animate-spin loader-success-custom" size={24} />
                    </div>
                ) : (
                    <>
                        <div className="modal-header">
                            <div className="header-icon-ring">
                                <Plus size={32} className="header-icon" />
                            </div>
                            <div className="header-text">
                                <h2 id="manual-case-modal-title">Nuevo Expediente Manual</h2>
                                <p>Carga los datos de las partes y archivos del caso.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="manual-form">
                            <div className="scroll-area">
                                {/* DENUNCIANTES (CLAIMANTS) */}
                                <div className="form-section">
                                    <div className="section-header">
                                        <h3><Users size={16} /> Denunciante / Actor</h3>
                                        <button type="button" className="btn-add-mini" onClick={addClaimant}>
                                            <Plus size={14} /> Añadir otro
                                        </button>
                                    </div>

                                    {claimants.map((c, i) => (
                                        <div key={i} className="dynamic-row-box">
                                            {claimants.length > 1 && (
                                                <button type="button" className="btn-remove-row" onClick={() => removeClaimant(i)} aria-label={`Quitar parte actora ${i + 1}`}><UserMinus size={14} aria-hidden="true" /></button>
                                            )}
                                            <div className="input-row">
                                                <div className="input-group">
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre completo"
                                                        value={c.name}
                                                        onChange={e => updateClaimant(i, 'name', e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <div className="input-group id-field-group">
                                                    <div className="id-type-selector">
                                                        {['DNI', 'CUIT', 'CUIL'].map(type => (
                                                            <button
                                                                key={type}
                                                                type="button"
                                                                className={c.idType === type ? 'active' : ''}
                                                                aria-pressed={c.idType === type}
                                                                onClick={() => updateClaimant(i, 'idType', type)}
                                                            >
                                                                {type}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder={c.idType === 'DNI' ? 'Nro. de DNI' : `Nro. de ${c.idType} (XX-XXXXXXXX-X)`}
                                                        value={c.dni}
                                                        onChange={e => updateClaimant(i, 'dni', e.target.value)}
                                                        required={i === 0}
                                                        className={getCuitError(c.dni, c.idType) ? 'input-error' : ''}
                                                    />
                                                    {getCuitError(c.dni, c.idType) && (
                                                        <span className="id-validation-error">
                                                            <AlertCircle size={12} /> {getCuitError(c.dni, c.idType)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="input-row">
                                                <div className="input-group">
                                                    <Mail size={14} className="icon-inner" />
                                                    <input
                                                        type="email"
                                                        placeholder="Email (Opcional)"
                                                        className="with-icon"
                                                        value={c.email}
                                                        onChange={e => updateClaimant(i, 'email', e.target.value)}
                                                    />
                                                </div>
                                                <div className="input-group">
                                                    <Phone size={14} className="icon-inner" />
                                                    <input
                                                        type="text"
                                                        placeholder="Teléfono"
                                                        className="with-icon"
                                                        value={c.phone}
                                                        onChange={e => updateClaimant(i, 'phone', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* DENUNCIADOS (RESPONDENTS) */}
                                <div className="form-section">
                                    <div className="section-header">
                                        <h3><Users size={16} /> Denunciado / Demandado (Opcional)</h3>
                                        <button type="button" className="btn-add-mini" onClick={addRespondent}>
                                            <Plus size={14} /> Añadir
                                        </button>
                                    </div>

                                    {respondents.map((r, i) => (
                                        <div key={i} className="dynamic-row-box secondary">
                                            {respondents.length > 1 && (
                                                <button type="button" className="btn-remove-row" onClick={() => removeRespondent(i)} aria-label={`Quitar parte demandada ${i + 1}`}><UserMinus size={14} aria-hidden="true" /></button>
                                            )}
                                            <div className="input-row">
                                                <div className="input-group">
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre o Razón Social"
                                                        value={r.name}
                                                        onChange={e => updateRespondent(i, 'name', e.target.value)}
                                                    />
                                                </div>
                                                <div className="input-group id-field-group">
                                                    <div className="id-type-selector">
                                                        {['DNI', 'CUIT', 'CUIL'].map(type => (
                                                            <button
                                                                key={type}
                                                                type="button"
                                                                className={r.idType === type ? 'active' : ''}
                                                                aria-pressed={r.idType === type}
                                                                onClick={() => updateRespondent(i, 'idType', type)}
                                                            >
                                                                {type}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder={r.idType === 'DNI' ? 'Nro. de DNI' : `Nro. de ${r.idType} (XX-XXXXXXXX-X)`}
                                                        value={r.dni}
                                                        onChange={e => updateRespondent(i, 'dni', e.target.value)}
                                                        className={getCuitError(r.dni, r.idType) ? 'input-error' : ''}
                                                    />
                                                    {getCuitError(r.dni, r.idType) && (
                                                        <span className="id-validation-error">
                                                            <AlertCircle size={12} /> {getCuitError(r.dni, r.idType)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* CASE DETAILS */}
                                <div className="form-section">
                                    <h3><Briefcase size={16} /> Detalles del Expediente</h3>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            placeholder="Título del Expediente (ej. Lòpez c/ Seguros S.A.)"
                                            value={caseTitle}
                                            onChange={e => setCaseTitle(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="input-group">
                                        <select
                                            value={matter}
                                            className="select-premium"
                                            onChange={e => setMatter(e.target.value)}
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

                                {/* FILES */}
                                <div className="form-section">
                                    <h3><FileText size={16} /> Documentación Existente</h3>
                                    <div
                                        className="drop-zone"
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Adjuntar documentos: click o Enter para seleccionar archivos"
                                        onClick={() => fileInputRef.current.click()}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current.click(); } }}
                                    >
                                        <div className="drop-icon-cloud">
                                            <Upload size={32} />
                                        </div>
                                        <p>Click para adjuntar PDF, Imágenes o Escritos</p>
                                        <span>Selección múltiple soportada</span>
                                        <input
                                            type="file"
                                            multiple
                                            hidden
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                        />
                                    </div>

                                    {files.length > 0 && (
                                        <div className="selected-files">
                                            {files.map((f, i) => (
                                                <div key={i} className="file-chip-premium">
                                                    <div className="f-icon"><FileText size={14} /></div>
                                                    <span className="f-name">{f.name}</span>
                                                    <button type="button" className="btn-del-file" onClick={() => removeFile(i)} aria-label={`Quitar archivo ${f.name}`}><X size={12} aria-hidden="true" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer-lux">
                                <button type="button" className="btn-cancel-lux" onClick={handleClose}>Cancelar</button>
                                <button type="submit" className="btn-submit-lux" disabled={loading}>
                                    {loading ? <><Loader2 className="animate-spin" size={20} /> Generando...</> : 'Crear Expediente'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
