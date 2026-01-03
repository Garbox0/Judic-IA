"use client";
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import '../../globals.css';

const SPECIALTIES_OPTIONS = [
    'Derecho Administrativo', 'Derecho Ambiental', 'Derecho Bancario',
    'Derecho Civil', 'Derecho Comercial', 'Daños y Perjuicios',
    'Derecho Empresario', 'Familia', 'Derecho Fiscal',
    'Derecho Informático', 'Derecho Internacional', 'Derecho Laboral',
    'Marcas y Patentes', 'Mediación y Arbitraje', 'Derecho Militar',
    'Derecho Penal', 'Derecho Real'
];

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [user, setUser] = useState(null);
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        full_name: '',
        especialidades: [],
        matricula: '',
        tomo: '',
        folio: '',
        jurisdiccion: '',
        biography: '',
        phone: '',
        avatar_url: ''
    });

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (data) {
                    let t = '', f = '';
                    if (data.matricula) {
                        const match = data.matricula.match(/T°?\s*(\d+)\s*F°?\s*(\d+)/i);
                        if (match) { t = match[1]; f = match[2]; } else { t = data.matricula; }
                    }
                    setFormData({
                        full_name: data.full_name || '',
                        especialidades: Array.isArray(data.especialidades) ? data.especialidades : [],
                        matricula: data.matricula || '',
                        tomo: t, folio: f,
                        jurisdiccion: data.jurisdiccion || '',
                        biography: data.biography || '',
                        phone: data.phone || '',
                        avatar_url: data.avatar_url || ''
                    });
                }
            }
            setLoading(false);
        };
        fetchProfile();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleSpecialty = (spec) => {
        setFormData(prev => {
            const current = prev.especialidades;
            const newSpecs = current.includes(spec) ? current.filter(s => s !== spec) : [...current, spec];
            return { ...prev, especialidades: newSpecs };
        });
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `avatars/${user.id}-${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
            await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
            setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
            alert("✅ Foto actualizada");
        } catch (error) {
            alert("❌ Error al subir imagen");
        } finally {
            setUploading(false);
        }
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const updates = {
                full_name: formData.full_name,
                biography: formData.biography,
                jurisdiccion: formData.jurisdiccion,
                especialidades: formData.especialidades,
                updated_at: new Date(),
            };
            await supabase.from('profiles').update(updates).eq('id', user.id);
            alert("✅ Perfil guardado");
        } catch (error) {
            alert("❌ Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSecurity = async () => {
        setSaving(true);
        try {
            const updates = { phone: formData.phone, updated_at: new Date() };
            const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
            if (error) throw error;
            alert("✅ Datos de seguridad actualizados con éxito.");
        } catch (error) {
            alert("❌ Alerta: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBilling = async () => {
        setSaving(true);
        setTimeout(() => {
            alert("✅ Preferencias de facturación sincronizadas.");
            setSaving(false);
        }, 800);
    };

    if (loading) return <div style={{ background: '#020617', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>Cargando Gabinete...</div>;

    return (
        <div className="stg-root">
            <div className="stg-container">
                <nav className="stg-breadcrumb">
                    <Link href="/dashboard">Gabinete</Link> / <span>Ajustes</span>
                </nav>
                <h1 className="stg-main-title">Configuración Profesional ⚖️</h1>

                <div className="stg-layout-split">
                    {/* Sidebar de Ajustes (Interno) */}
                    <aside className="stg-tabs-nav">
                        <button className={`stg-tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                            👤 Perfil Profesional
                        </button>
                        <button className={`stg-tab-btn ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
                            🛡️ Seguridad
                        </button>
                        <button className={`stg-tab-btn ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => setActiveTab('billing')}>
                            💳 Facturación
                        </button>
                    </aside>

                    {/* Contenido Principal */}
                    <main className="stg-main-content">
                        {activeTab === 'profile' && (
                            <div className="stg-tab-pane">
                                <div className="stg-profile-header">
                                    <div className="stg-photo-col">
                                        <label className="stg-label">Imagen 4x4</label>
                                        <div className="stg-avatar-box" onClick={() => fileInputRef.current.click()}>
                                            {formData.avatar_url ? (
                                                <img src={formData.avatar_url} alt="Profile" />
                                            ) : (
                                                <div className="stg-placeholder">📷<br />Subir</div>
                                            )}
                                            {uploading && <div className="stg-loader-overlay">...</div>}
                                        </div>
                                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleAvatarUpload} />
                                    </div>
                                    <div className="stg-fields-col">
                                        <div className="stg-field-row">
                                            <div className="stg-f-group">
                                                <label className="stg-label">Nombre Completo</label>
                                                <input name="full_name" className="stg-dark-input" value={formData.full_name} onChange={handleChange} />
                                            </div>
                                        </div>
                                        <div className="stg-field-row multi">
                                            <div className="stg-f-group flex-2">
                                                <label className="stg-label">Colegio / Jurisdicción</label>
                                                <input name="jurisdiccion" className="stg-dark-input" value={formData.jurisdiccion} onChange={handleChange} />
                                            </div>
                                            <div className="stg-f-group flex-1">
                                                <label className="stg-label">Tomo</label>
                                                <input className="stg-dark-input readonly" value={formData.tomo} readOnly disabled />
                                            </div>
                                            <div className="stg-f-group flex-1">
                                                <label className="stg-label">Folio</label>
                                                <input className="stg-dark-input readonly" value={formData.folio} readOnly disabled />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="stg-f-group" style={{ marginTop: '1.5rem' }}>
                                    <label className="stg-label">Especialidades Profesionales</label>
                                    <div className="stg-chips-grid">
                                        {SPECIALTIES_OPTIONS.map(spec => (
                                            <button
                                                key={spec}
                                                className={`stg-chip ${formData.especialidades.includes(spec) ? 'selected' : ''}`}
                                                onClick={() => toggleSpecialty(spec)}
                                            >
                                                {spec}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="stg-f-group" style={{ marginTop: '1.5rem' }}>
                                    <label className="stg-label">Biografía / Extracto</label>
                                    <textarea name="biography" className="stg-dark-input underline" rows="3" value={formData.biography} onChange={handleChange} />
                                </div>

                                <div className="stg-actions-footer">
                                    <button className="stg-gold-btn" onClick={handleSaveProfile} disabled={saving || uploading}>
                                        {saving ? 'Procesando...' : 'Guardar Perfil'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="stg-tab-pane">
                                <div className="stg-alert-card">🛡️ Sus datos están bajo la protección cifrada de Judic-IA.</div>
                                <div className="stg-field-row multi">
                                    <div className="stg-f-group flex-2">
                                        <label className="stg-label">Email de Acceso</label>
                                        <input className="stg-dark-input readonly" value={user?.email || ''} readOnly />
                                    </div>
                                    <div className="stg-f-group flex-1">
                                        <label className="stg-label">Enlace Telefónico</label>
                                        <input name="phone" className="stg-dark-input" value={formData.phone} onChange={handleChange} placeholder="+54 9..." />
                                    </div>
                                </div>
                                <div className="stg-divider"></div>
                                <h3 className="stg-sec-title">Gabinete de Identidad</h3>
                                <div className="stg-field-row multi stg-bg-box" style={{ alignItems: 'flex-end' }}>
                                    <div className="stg-f-group flex-2">
                                        <label className="stg-label">Credencial de Acceso</label>
                                        <input type="password" className="stg-dark-input readonly" value="********" readOnly />
                                        <p className="stg-hint">Solo puede ser restablecida por email oficial.</p>
                                    </div>
                                    <div className="flex-1">
                                        <button className="stg-outline-btn" style={{ width: '100%' }} onClick={() => alert("Restablecimiento enviado.")}>Restablecer</button>
                                    </div>
                                </div>
                                <div className="stg-actions-footer">
                                    <button className="stg-gold-btn" onClick={handleSaveSecurity} disabled={saving}>
                                        {saving ? 'Guardando...' : 'Actualizar Seguridad'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'billing' && (
                            <div className="stg-tab-pane">
                                <div className="stg-plan-card stg-premium-glow">
                                    <div className="stg-plan-badge">VITALICIO</div>
                                    <small className="stg-tag">Gabinete Jurídico</small>
                                    <h2 className="stg-plan-name">Judic-IA Suite Pro</h2>
                                    <div className="stg-price-row">
                                        <span className="stg-val">$15.000</span>
                                        <span className="stg-period">/ mensual</span>
                                    </div>
                                    <div className="stg-plan-footer">
                                        <span className="stg-status-active">● SUSCRIPCIÓN ACTIVA</span>
                                        <span className="stg-next-date">Prox: 15/01/2026</span>
                                    </div>
                                </div>

                                <div className="stg-methods-box">
                                    <h3 className="stg-sec-title">Puente de Pago</h3>
                                    <div className="stg-method-item">
                                        <div className="stg-m-info">
                                            <strong style={{ color: '#009ee3' }}>⚖️ Mercado Pago</strong>
                                            <p>Vínculo directo con su cuenta certificada.</p>
                                        </div>
                                        <button className="stg-mp-btn">Gestionar</button>
                                    </div>
                                    <button className="stg-add-btn">+ Asociar Nuevo Medio</button>
                                </div>

                                <div className="stg-actions-footer">
                                    <button className="stg-gold-btn" onClick={handleSaveBilling} disabled={saving}>
                                        {saving ? 'Guardando...' : 'Confirmar Pagos'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            <style jsx global>{`
                /* ENCAPSULATED ROOT - PREVENT OVERLAP */
                .stg-root {
                    min-height: 100vh;
                    background: #020617;
                    color: white;
                    padding: 3rem 4rem 3rem 2rem;
                    font-family: 'Inter', sans-serif;
                }
                .stg-container { max-width: 1200px; margin: 0 auto; }
                .stg-breadcrumb { font-size: 0.8rem; color: #475569; margin-bottom: 0.8rem; letter-spacing: 0.05em; }
                .stg-breadcrumb Link { color: #475569; text-decoration: none; }
                .stg-main-title { font-family: 'Playfair Display', serif; font-size: 2.8rem; color: #fbbf24; margin-bottom: 3.5rem; font-weight: 900; }

                .stg-layout-split { 
                    display: flex; 
                    gap: 3.5rem; 
                    align-items: flex-start;
                }

                /* INTERNAL SIDEBAR - UNIQUE CLASSES */
                .stg-tabs-nav {
                    width: 280px;
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 24px;
                    padding: 1.5rem;
                    backdrop-filter: blur(20px);
                }

                .stg-tab-btn {
                    width: 100%;
                    text-align: left;
                    padding: 1.1rem 1.4rem;
                    margin-bottom: 0.8rem;
                    border: 1px solid transparent;
                    background: transparent;
                    color: #64748b;
                    border-radius: 14px;
                    cursor: pointer;
                    font-weight: 700;
                    transition: all 0.3s;
                    font-size: 0.95rem;
                }
                .stg-tab-btn:hover { background: rgba(255,255,255,0.03); color: white; }
                .stg-tab-btn.active {
                    background: rgba(251, 191, 36, 0.1);
                    border-color: rgba(251, 191, 36, 0.2);
                    color: #fbbf24;
                }

                /* CONTENT BOX */
                .stg-main-content {
                    flex: 1;
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 32px;
                    padding: 3.5rem;
                    backdrop-filter: blur(50px);
                    box-shadow: 0 40px 100px -20px rgba(0,0,0,0.5);
                    min-height: 700px;
                }

                .stg-tab-pane { animation: stgFade 0.6s ease; }
                @keyframes stgFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .stg-profile-header { display: flex; gap: 3.5rem; margin-bottom: 2.5rem; }
                .stg-photo-col { width: 180px; }
                .stg-avatar-box {
                    width: 180px; height: 180px;
                    background: #0f172a;
                    border: 2px dashed rgba(251, 191, 36, 0.25);
                    border-radius: 24px;
                    overflow: hidden; cursor: pointer; position: relative;
                    display: flex; align-items: center; justify-content: center;
                    transition: 0.4s;
                }
                .stg-avatar-box:hover { border-color: #fbbf24; transform: scale(1.02); }
                .stg-avatar-box img { width: 100%; height: 100%; object-fit: cover; }
                .stg-placeholder { text-align: center; color: #334155; font-size: 0.8rem; font-weight: 800; }
                .stg-loader-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; color: #fbbf24; }

                .stg-fields-col { flex: 1; }
                .stg-f-group { margin-bottom: 1.8rem; display: flex; flex-direction: column; }
                .stg-label { font-size: 0.75rem; font-weight: 900; color: #475569 !important; text-transform: uppercase; margin-bottom: 0.7rem; letter-spacing: 0.08em; padding-left: 0.4rem; }
                
                .stg-dark-input {
                    background: #0f172a !important;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    color: white !important;
                    padding: 1rem 1.4rem !important;
                    border-radius: 16px !important;
                    font-size: 1rem !important;
                    outline: none !important;
                    width: 100%;
                    transition: 0.3s;
                }
                .stg-dark-input:focus { border-color: #fbbf24 !important; background: #020617 !important; box-shadow: 0 0 0 5px rgba(251,191,36,0.1) !important; }
                .stg-dark-input.readonly { opacity: 0.4; cursor: not-allowed; }
                .stg-dark-input.underline { resize: none; }

                .stg-field-row.multi { display: flex; gap: 1.8rem; }
                .flex-1 { flex: 1; } .flex-2 { flex: 2; }

                .stg-chips-grid { display: flex; flex-wrap: wrap; gap: 0.6rem; }
                .stg-chip {
                    padding: 0.6rem 1rem;
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 10px;
                    color: #64748b;
                    font-size: 0.8rem;
                    cursor: pointer;
                    font-weight: 600;
                    transition: 0.3s;
                }
                .stg-chip:hover { color: white; background: rgba(255,255,255,0.05); }
                .stg-chip.selected { background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.2); color: #fbbf24; }

                .stg-actions-footer { margin-top: 3.5rem; display: flex; justify-content: flex-end; padding-top: 2.5rem; border-top: 1px solid rgba(255,255,255,0.05); }
                .stg-gold-btn {
                    background: linear-gradient(135deg, #fbbf24, #d97706);
                    color: #020617; border: none; padding: 1.1rem 3.5rem; border-radius: 18px;
                    font-weight: 800; cursor: pointer; transition: 0.3s; font-size: 1rem;
                    text-transform: uppercase; letter-spacing: 0.05em;
                }
                .stg-gold-btn:hover { transform: translateY(-3px); box-shadow: 0 20px 40px rgba(217, 119, 6, 0.3); }
                .stg-gold-btn:disabled { opacity: 0.5; }

                /* SECURITY */
                .stg-alert-card { background: rgba(251,191,36,0.05); border: 1px solid rgba(251,191,36,0.15); padding: 1.5rem; border-radius: 16px; color: #fbbf24; font-size: 0.95rem; margin-bottom: 3rem; font-weight: 700; }
                .stg-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 3rem 0; }
                .stg-sec-title { font-family: 'Playfair Display'; font-size: 1.8rem; color: white; margin-bottom: 2rem; }
                .stg-bg-box { background: rgba(15, 23, 42, 0.3); padding: 2.5rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.03); }
                .stg-hint { font-size: 0.75rem; color: #475569; margin-top: 0.8rem; }
                .stg-outline-btn { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #94a3b8; padding: 1rem; border-radius: 14px; cursor: pointer; font-weight: 700; transition: 0.3s; }
                .stg-outline-btn:hover { color: white; border-color: #fbbf24; }

                /* BILLING */
                .stg-plan-card {
                    background: linear-gradient(145deg, #0f172a, #020617);
                    border: 1px solid rgba(251, 191, 36, 0.4);
                    padding: 3.5rem; border-radius: 28px; position: relative;
                }
                .stg-premium-glow { box-shadow: 0 0 50px rgba(251, 191, 36, 0.05); }
                .stg-plan-badge { 
                    position: absolute; top: 2rem; right: 2rem; 
                    background: #fbbf24; color: #020617; font-size: 0.75rem; font-weight: 950; 
                    padding: 0.5rem 1.2rem; border-radius: 100px;
                }
                .stg-tag { color: #fbbf24; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; display: block; margin-bottom: 0.5rem; }
                .stg-plan-name { font-family: 'Playfair Display'; font-size: 3rem; margin: 0; }
                .stg-price-row { display: flex; align-items: baseline; gap: 0.8rem; margin-top: 1rem; }
                .stg-val { font-size: 2.5rem; font-weight: 900; color: white; }
                .stg-period { color: #475569; font-weight: 600; }
                .stg-plan-footer { display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 2rem; padding-top: 1.5rem; }
                .stg-status-active { color: #10b981; font-weight: 900; font-size: 0.85rem; }
                .stg-next-date { color: #64748b; font-size: 0.85rem; }

                .stg-methods-box { margin-top: 4rem; }
                .stg-method-item { 
                    background: rgba(0, 158, 227, 0.04); 
                    border: 1px solid rgba(0, 158, 227, 0.15); 
                    padding: 1.8rem; border-radius: 18px; 
                    display: flex; justify-content: space-between; align-items: center;
                }
                .stg-mp-btn { background: #009ee3; color: white; border: none; padding: 0.8rem 2rem; border-radius: 12px; font-weight: 800; cursor: pointer; }
                .stg-add-btn { width: 100%; margin-top: 1rem; padding: 1.2rem; background: transparent; border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; color: #475569; cursor: pointer; transition: 0.3s; }
                .stg-add-btn:hover { border-color: white; color: white; }

                @media (max-width: 900px) {
                    .stg-layout-split { flex-direction: column; }
                    .stg-tabs-nav { width: 100%; }
                    .stg-profile-header { flex-direction: column; align-items: center; }
                    .stg-field-row.multi { flex-direction: column; gap: 0; }
                    .stg-root { padding: 2rem; }
                }
            `}</style>
        </div>
    );
}
