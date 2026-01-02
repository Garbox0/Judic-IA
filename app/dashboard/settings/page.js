"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);

    // Form States
    const [formData, setFormData] = useState({
        full_name: '',
        especialidades: '', // We'll handle array <-> string conversion if needed, or just keep as string for now if schema is text[]
        matricula: '',
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

                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (data) {
                    setFormData({
                        full_name: data.full_name || '',
                        especialidades: Array.isArray(data.especialidades) ? data.especialidades.join(', ') : (data.especialidades || ''),
                        matricula: data.matricula || '',
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

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            // Convert 'especialidades' string back to array if needed, or simplify logic
            const updates = {
                full_name: formData.full_name,
                biography: formData.biography,
                matricula: formData.matricula,
                jurisdiccion: formData.jurisdiccion,
                // Simple comma separation for tags
                especialidades: formData.especialidades.split(',').map(s => s.trim()).filter(Boolean),
                updated_at: new Date(),
            };

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;
            alert("✅ Perfil actualizado correctamente");
        } catch (error) {
            console.error(error);
            alert("❌ Error al actualizar: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSecurity = async () => {
        setSaving(true);
        try {
            // Update phone only for now as an example of security field
            const updates = {
                phone: formData.phone,
                updated_at: new Date(),
            };

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;
            alert("✅ Datos de seguridad actualizados");
        } catch (error) {
            alert("❌ Error: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 text-white">Cargando configuración...</div>;

    const renderProfile = () => (
        <div className="section-fade-in">
            <div className="profile-header">
                <div className="photo-upload-area">
                    <div className="photo-placeholder">
                        {formData.avatar_url ? (
                            <img src={formData.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '20px', objectFit: 'cover' }} />
                        ) : (
                            <span className="camera-icon">📷</span>
                        )}
                    </div>
                    <button className="btn-upload" onClick={() => alert("Próximamente: Subida de archivos")}>Subir Foto 4x4</button>
                    <p className="photo-hint">Recomendado: 400x400px, fondo claro.</p>
                </div>
                <div className="profile-fields">
                    <div className="form-group">
                        <label>Nombre Completo</label>
                        <input
                            name="full_name"
                            type="text"
                            className="input-premium"
                            value={formData.full_name}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="form-group">
                        <label>Título / Especialidad (Separadas por comas)</label>
                        <input
                            name="especialidades"
                            type="text"
                            className="input-premium"
                            value={formData.especialidades}
                            onChange={handleChange}
                            placeholder="Ej: Penal, Familia, Sucesiones"
                        />
                    </div>
                    <div className="form-group">
                        <label>Matrícula Profesional</label>
                        <input
                            name="matricula"
                            type="text"
                            className="input-premium"
                            value={formData.matricula}
                            onChange={handleChange}
                            placeholder="T° F°"
                        />
                    </div>
                    <div className="form-group">
                        <label>Jurisdicción / Colegio</label>
                        <input
                            name="jurisdiccion"
                            type="text"
                            className="input-premium"
                            value={formData.jurisdiccion}
                            onChange={handleChange}
                            placeholder="Ej: CPACF"
                        />
                    </div>
                </div>
            </div>
            <div className="form-group full-width">
                <label>Biografía Breve (para perfil público)</label>
                <textarea
                    name="biography"
                    className="input-premium textarea"
                    rows="4"
                    placeholder="Escriba una breve descripción de su trayectoria para mostrar en el Smart Link..."
                    value={formData.biography}
                    onChange={handleChange}
                ></textarea>
            </div>
            <div className="action-row">
                <button className="btn-save" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>
        </div>
    );

    const renderSecurity = () => (
        <div className="section-fade-in">
            <div className="security-alert">
                <span className="icon">🔒</span>
                <p>Tu cuenta utiliza autenticación de dos factores (2FA) desactivada. Recomendamos activarla.</p>
                <button className="btn-text">Activar</button>
            </div>
            <div className="grid-2">
                <div className="form-group">
                    <label>Correo Electrónico Actual</label>
                    <input type="email" className="input-premium" value={user?.email || ''} disabled />
                    <span className="input-hint">Contacta a soporte para cambiar tu email.</span>
                </div>
                <div className="form-group">
                    <label>Teléfono de Recuperación</label>
                    <input
                        name="phone"
                        type="tel"
                        className="input-premium"
                        placeholder="+54 9 11..."
                        value={formData.phone}
                        onChange={handleChange}
                    />
                </div>
            </div>
            <div className="divider"></div>
            <h3>Cambiar Contraseña</h3>
            <div className="grid-2">
                <div className="form-group">
                    <label>Contraseña Actual</label>
                    <input type="password" className="input-premium" disabled placeholder="Gestionado por Supabase Auth" />
                </div>
                <div className="form-group">
                    <label>Nueva Contraseña</label>
                    <input type="password" className="input-premium" disabled placeholder="Gestionado por Supabase Auth" />
                </div>
            </div>
            <div className="action-row">
                <button className="btn-save" onClick={handleSaveSecurity} disabled={saving}>
                    {saving ? 'Guardando...' : 'Actualizar Seguridad'}
                </button>
            </div>
        </div>
    );

    const renderBilling = () => (
        <div className="section-fade-in">
            <div className="plan-card gold-border">
                <div className="plan-info">
                    <span className="plan-badge">PLAN ACTUAL</span>
                    <h2>Judic-IA Profesional</h2>
                    <p className="price">$15.000 <span className="period">/ mes</span></p>
                </div>
                <div className="plan-status">
                    <div className="status-pill active">Activo</div>
                    <p>Próxima facturación: 15 Ene 2026</p>
                </div>
            </div>

            <h3 className="section-title">Métodos de Pago</h3>
            <div className="payment-methods">
                <div className="payment-card mp-card">
                    <div className="mp-logo">
                        <span className="mp-icon">🤝</span> Mercado Pago
                    </div>
                    <p>Vincula tu cuenta para débitos automáticos seguros.</p>
                    <button className="btn-mp">Vincular Cuenta</button>
                </div>
                <div className="payment-card add-card">
                    <div className="card-icon">💳</div>
                    <p>Agregar Tarjeta de Crédito/Débito</p>
                    <button className="btn-outline">Agregar +</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="settings-container">
            <nav className="settings-nav">
                <div className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Configuración</span>
                </div>
            </nav>

            <div className="settings-layout">
                {/* SIDEBAR TABS */}
                <div className="settings-tabs glass-panel">
                    <button
                        className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        <span className="tab-icon">👤</span> Perfil Profesional
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                        onClick={() => setActiveTab('security')}
                    >
                        <span className="tab-icon">🛡️</span> Seguridad
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
                        onClick={() => setActiveTab('billing')}
                    >
                        <span className="tab-icon">💳</span> Facturación
                    </button>
                </div>

                {/* CONTENT AREA */}
                <div className="settings-content glass-panel">
                    <h2 className="tab-title">
                        {activeTab === 'profile' && 'Perfil Profesional'}
                        {activeTab === 'security' && 'Seguridad de la Cuenta'}
                        {activeTab === 'billing' && 'Facturación y Suscripción'}
                    </h2>
                    {activeTab === 'profile' && renderProfile()}
                    {activeTab === 'security' && renderSecurity()}
                    {activeTab === 'billing' && renderBilling()}
                </div>
            </div>

            <style jsx>{`
                .settings-container {
                    padding: 2rem 3rem;
                    max-width: 1400px;
                    margin: 0 auto;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    font-family: 'Outfit', sans-serif;
                }
                .settings-nav { margin-bottom: 2rem; flex-shrink: 0; }
                .breadcrumb { display: flex; align-items: center; gap: 1rem; font-size: 0.95rem; color: #94a3b8; }
                .breadcrumb-item { color: #94a3b8; text-decoration: none; transition: all 0.2s; font-weight: 500; }
                .breadcrumb-item:hover { color: var(--primary); }
                .breadcrumb-separator { opacity: 0.4; font-size: 0.8em; }
                .breadcrumb-current { color: #f1f5f9; font-weight: 600; }

                .settings-layout {
                    display: flex;
                    gap: 3rem;
                    align-items: flex-start;
                }

                /* TABS SIDEBAR */
                .settings-tabs {
                    width: 280px;
                    flex-shrink: 0;
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    border-radius: 20px;
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                }
                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem 1.5rem;
                    border: none;
                    background: transparent;
                    color: #94a3b8;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    border-radius: 12px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    text-align: left;
                    font-family: inherit;
                    position: relative;
                    overflow: hidden;
                }
                .tab-btn:hover {
                    background: rgba(255, 255, 255, 0.03);
                    color: #f8fafc;
                }
                .tab-btn.active {
                    background: rgba(197, 160, 33, 0.15);
                    color: white;
                    font-weight: 600;
                    border: 1px solid rgba(197, 160, 33, 0.1);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                .tab-icon { font-size: 1.25rem; opacity: 0.8; }
                .tab-btn.active .tab-icon { opacity: 1; transform: scale(1.1); transition: transform 0.3s; }

                /* CONTENT AREA */
                .settings-content {
                    flex: 1;
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 24px;
                    padding: 3.5rem;
                    min-height: 600px;
                    position: relative;
                    backdrop-filter: blur(12px);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .tab-title {
                    font-size: 2.2rem;
                    font-weight: 700;
                    margin-bottom: 3rem;
                    color: white;
                    letter-spacing: -0.02em;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    display: inline-block;
                }

                .section-fade-in {
                    animation: fadeIn 0.4s ease-out forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* PROFILE STYLES */
                .profile-header {
                    display: flex;
                    gap: 3.5rem;
                    margin-bottom: 3.5rem;
                    align-items: flex-start;
                }
                .photo-upload-area {
                    flex-shrink: 0;
                    text-align: center;
                    width: 180px;
                }
                .photo-placeholder {
                    width: 160px;
                    height: 160px;
                    background: rgba(30, 41, 59, 0.5);
                    border: 2px dashed rgba(148, 163, 184, 0.3);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2.5rem;
                    margin: 0 auto 1.2rem;
                    transition: all 0.3s;
                    color: rgba(255,255,255,0.2);
                    cursor: pointer;
                }
                .photo-placeholder:hover {
                    border-color: var(--primary);
                    background: rgba(197, 160, 33, 0.05);
                    color: var(--primary);
                    box-shadow: 0 0 20px rgba(197, 160, 33, 0.1);
                }
                .btn-upload {
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    padding: 0.6rem 1.2rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    margin-bottom: 0.8rem;
                    transition: all 0.3s;
                    width: 100%;
                }
                .btn-upload:hover { 
                    background: rgba(255, 255, 255, 0.15); 
                    border-color: white;
                }
                .photo-hint {
                    font-size: 0.8rem;
                    color: #64748b;
                    line-height: 1.4;
                }
                .profile-fields {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 1.8rem;
                }

                /* FORMS - CRITICAL FIX FOR DARK THEME */
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.8rem;
                }
                .full-width { width: 100%; margin-bottom: 2rem; }
                .grid-2 {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 2.5rem;
                    margin-bottom: 2.5rem;
                }
                label {
                    color: #cbd5e1;
                    font-size: 0.9rem;
                    font-weight: 600;
                    margin-left: 0.2rem;
                    letter-spacing: 0.02em;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .label-with-icon {
                    color: #94a3b8;
                }
                .lock-icon { font-size: 0.9rem; opacity: 0.7; }

                .input-premium {
                    background-color: rgba(15, 23, 42, 0.6) !important;
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    padding: 1.1rem 1.2rem;
                    border-radius: 12px;
                    color: white !important;
                    font-size: 1rem;
                    font-family: 'Outfit', sans-serif;
                    transition: all 0.3s ease;
                    width: 100%;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
                }
                .input-premium::placeholder {
                    color: rgba(255, 255, 255, 0.3);
                }
                .input-premium:focus {
                    outline: none;
                    border-color: var(--primary) !important;
                    background-color: rgba(15, 23, 42, 0.8) !important;
                    box-shadow: 0 0 0 3px rgba(197, 160, 33, 0.15);
                }
                .input-premium:disabled, .input-premium[readonly] {
                    opacity: 0.7;
                    cursor: not-allowed;
                    background-color: rgba(0, 0, 0, 0.3) !important;
                    border-color: rgba(255, 255, 255, 0.05) !important;
                    color: #94a3b8 !important;
                }
                .tooltip {
                    font-size: 0.75rem;
                    color: var(--primary);
                    margin-top: 0.4rem;
                    display: block;
                    opacity: 0.8;
                }

                /* ACTIONS */
                .action-row {
                    display: flex;
                    justify-content: flex-end;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    padding-top: 2.5rem;
                    margin-top: 1rem;
                }
                .btn-save {
                    background: linear-gradient(135deg, var(--primary) 0%, #b4941f 100%);
                    color: #0f172a;
                    border: none;
                    padding: 1rem 2.5rem;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 1.05rem;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 10px 20px -5px rgba(197, 160, 33, 0.4);
                }
                .btn-save:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 15px 30px -5px rgba(197, 160, 33, 0.5);
                    filter: brightness(1.1);
                }
                .btn-save:disabled { opactiy: 0.7; cursor: wait; }

                /* SECURITY */
                .security-alert {
                    background: rgba(234, 179, 8, 0.08);
                    border: 1px solid rgba(234, 179, 8, 0.2);
                    padding: 1.2rem 1.8rem;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    gap: 1.2rem;
                    margin-bottom: 3rem;
                }
                .security-alert .icon { font-size: 1.5rem; }
                .security-alert p { color: #fcd34d; font-weight: 500; margin: 0; font-size: 0.95rem; }
                .btn-text {
                    background: none;
                    border: none;
                    color: #fcd34d;
                    font-weight: 700;
                    text-decoration: underline;
                    cursor: pointer;
                    margin-left: auto;
                    font-size: 0.9rem;
                }
                .divider {
                    height: 1px;
                    background: rgba(255, 255, 255, 0.1);
                    margin: 3.5rem 0;
                }
                h3 { 
                    font-size: 1.3rem; 
                    color: white; 
                    margin-bottom: 2rem; 
                    font-weight: 600;
                }

                /* BILLING */
                .plan-card {
                    background: linear-gradient(145deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%);
                    border: 1px solid rgba(197, 160, 33, 0.3);
                    padding: 2.5rem;
                    border-radius: 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 4rem;
                    position: relative;
                    overflow: hidden;
                }
                .plan-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; width: 4px; height: 100%;
                    background: var(--primary);
                    box-shadow: 0 0 15px var(--primary);
                }
                .plan-badge {
                    background: rgba(197, 160, 33, 0.15);
                    color: #fbbf24;
                    padding: 0.4rem 1rem;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    letter-spacing: 0.05em;
                    border: 1px solid rgba(197, 160, 33, 0.2);
                    display: inline-block;
                    margin-bottom: 0.8rem;
                }
                .plan-info h2 { font-size: 2rem; margin: 0.5rem 0; color: white; letter-spacing: -0.01em; }
                .price { font-size: 1.8rem; color: white; font-weight: 300; display: flex; align-items: baseline; gap: 0.5rem; }
                .price .period { font-size: 1rem; color: #94a3b8; font-weight: 400; }
                
                .plan-status { text-align: right; }
                .status-pill.active {
                    background: rgba(16, 185, 129, 0.1);
                    color: #34d399;
                    padding: 0.5rem 1.2rem;
                    border-radius: 50px;
                    display: inline-block;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    font-weight: 600;
                    font-size: 0.9rem;
                    margin-bottom: 0.8rem;
                    box-shadow: 0 0 15px rgba(16, 185, 129, 0.1);
                }
                .plan-status p { color: #94a3b8; font-size: 0.9rem; }

                .section-title { font-size: 1.5rem; color: white; margin-bottom: 2rem; border-left: 3px solid var(--primary); padding-left: 1rem; }
                .payment-methods {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 2rem;
                }
                .payment-card {
                    padding: 2.5rem;
                    border-radius: 20px;
                    background: rgba(30, 41, 59, 0.2);
                    border: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    align-items: flex-start;
                    transition: all 0.3s;
                    min-height: 250px;
                }
                .mp-card { 
                    border-color: rgba(0, 158, 227, 0.3); 
                    background: linear-gradient(145deg, rgba(0, 158, 227, 0.05) 0%, rgba(0,0,0,0) 100%);
                }
                .mp-logo {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    font-weight: 800;
                    font-size: 1.4rem;
                    color: #009ee3;
                    margin-top: 1rem;
                    margin-bottom: 1rem;
                }
                .mp-icon { font-size: 1.8rem; }
                
                .btn-mp {
                    width: 100%;
                    padding: 1rem;
                    background: #009ee3;
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 1rem;
                    cursor: pointer;
                    margin-top: auto;
                    transition: all 0.3s;
                    box-shadow: 0 4px 15px rgba(0, 158, 227, 0.3);
                }
                .btn-mp:hover { 
                    background: #0081b8; 
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0, 158, 227, 0.4);
                }

                .card-icon { font-size: 2.5rem; color: #64748b; margin-top: 1rem; margin-bottom: 1rem; }
                .btn-outline {
                    width: 100%;
                    padding: 1rem;
                    background: transparent;
                    color: white;
                    border: 1px dashed rgba(255, 255, 255, 0.2);
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-top: auto;
                    transition: all 0.3s;
                }
                .btn-outline:hover { 
                    border-color: white; 
                    border-style: solid;
                    background: rgba(255,255,255,0.05); 
                }

                @media (max-width: 1024px) {
                    .settings-layout { flex-direction: column; }
                    .settings-tabs { width: 100%; flex-direction: row; overflow-x: auto; padding-bottom: 0.5rem; }
                    .tab-btn { flex: 1; min-width: 180px; justify-content: center; }
                    .profile-header { flex-direction: column; align-items: center; text-align: center; }
                    .photo-upload-area { margin: 0 auto; }
                    .profile-fields { width: 100%; }
                    .grid-2 { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
}
