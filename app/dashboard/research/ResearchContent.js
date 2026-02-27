"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { generateResearchPDF } from '../../lib/pdfGenerator';
import Link from 'next/link';
import Image from 'next/image';
import { demoResearchHistory, demoFullResearchResult } from '../../lib/demoData'; // [NEW] Mock Data
import dynamic from 'next/dynamic';
const PJNSearchPanel = dynamic(() => import('./PJNSearchPanel'), { ssr: false });
const AlertsPanel = dynamic(() => import('./AlertsPanel'), { ssr: false });
import SafeChatWidget from '../../components/SafeChatWidget';
import TrialExpiredBlock from '../../components/TrialExpiredBlock';
import { isTrialExpired } from '../../lib/subscription';
import { analyzeQueryQuality } from '../../../lib/queryEnhancer';

import {
    Briefcase,
    Gavel,
    Home,
    Building2,
    Search,
    Zap,
    RefreshCw,
    ExternalLink,
    Eye,
    FileText,
    ClipboardCopy,
    Loader2,
    Sparkles,
    AlertCircle,
    TrendingUp,
    Mic,
    MicOff
} from 'lucide-react';
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';
import { getPlanLimit } from '@/lib/planLimits';
import './research.css';

// Module-level cache for logo base64 (persists across re-mounts)
let _logoCache = null;

export default function ResearchPage({ isDemo: isDemoProp = false }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('nacional'); // 'nacional' or 'provincial'
    const [province, setProvince] = useState('Buenos Aires');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshingCases, setRefreshingCases] = useState({}); // { [index]: true/false }
    const [capturingCases, setCapturingCases] = useState({}); // New state for capture loading
    const [copySuccess, setCopySuccess] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);
    const [placeholder, setPlaceholder] = useState("Ej: Despido sin causa con antigüedad de 10 años en CABA...");
    const [userProfile, setUserProfile] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [logoBase64, setLogoBase64] = useState(null);
    const [history, setHistory] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile: false = hidden
    const [timeLeft, setTimeLeft] = useState(0);
    const [searchStatus, setSearchStatus] = useState('');
    const [refreshQuota, setRefreshQuota] = useState(5);
    const [quotaModalOpen, setQuotaModalOpen] = useState(false); // [NEW] Quota Modal State
    const [buyingPack, setBuyingPack] = useState(null); // 'pack_10' | 'pack_25' | 'pack_50'
    const [creditsToast, setCreditsToast] = useState(null); // 'ok' | 'error' | 'pending'
    const [quotaExhausted, setQuotaExhausted] = useState(false); // true = llegó a 0, false = compra proactiva
    const [trialExpired, setTrialExpired] = useState(false); // [NEW] Trial Expiration Check

    // Voice input
    const [isListening, setIsListening] = useState(false);
    const [hasSpeechSupport, setHasSpeechSupport] = useState(false);
    const [micError, setMicError] = useState('');
    const recognitionRef = useRef(null);

    // Empresa tab
    const [activeTab, setActiveTab] = useState('jurisprudencia');
    const [empresaName, setEmpresaName] = useState('');
    const [empresaCuit, setEmpresaCuit] = useState('');
    const [empresaJurisdiction, setEmpresaJurisdiction] = useState('federal');
    const [empresaLoading, setEmpresaLoading] = useState(false);
    const [empresaResults, setEmpresaResults] = useState(null); // { cases: [], message? }
    const [empresaError, setEmpresaError] = useState(null);
    const [jurisprudenciaMode, setJurisprudenciaMode] = useState('ia');
    const [manualQuery, setManualQuery] = useState('');
    const [manualProvince, setManualProvince] = useState('Buenos Aires');
    const [manualInstancia, setManualInstancia] = useState('todas');
    const [manualJurisdiction, setManualJurisdiction] = useState('provincial');
    const [manualFuero, setManualFuero] = useState('todas');
    const [manualTribunal, setManualTribunal] = useState('');
    const [manualDateFrom, setManualDateFrom] = useState('');
    const [manualDateTo, setManualDateTo] = useState('');
    const [manualKeywords, setManualKeywords] = useState('');
    const [manualLoading, setManualLoading] = useState(false);
    const [manualResults, setManualResults] = useState([]);
    const [manualError, setManualError] = useState('');
    const [manualSearched, setManualSearched] = useState(false);
    const [manualMeta, setManualMeta] = useState(null);
    const [manualCatalog, setManualCatalog] = useState(null); // { camaras: [], departamentos: [] }
    const [manualCatalogLoaded, setManualCatalogLoaded] = useState(false);
    const [indexFacets, setIndexFacets] = useState(null);  // { fueros, tribunales, total }
    const [facetsLoaded, setFacetsLoaded] = useState(false);
    const [tribunalSearch, setTribunalSearch] = useState('');

    // Query enhancement states
    const [assistedMode, setAssistedMode] = useState(true); // Default to assisted for better UX
    const [enhancementModal, setEnhancementModal] = useState(null); // { original, enhanced, quality }
    const [analyzingQuery, setAnalyzingQuery] = useState(false);
    const [reformulationModal, setReformulationModal] = useState(null); // { alternatives }
    const [queryQuality, setQueryQuality] = useState(null); // Current query quality analysis

    const canBuyExtraResearchCredits = useMemo(() => {
        if (!userProfile) return false;
        if (userProfile.plan_tier === 'enterprise') return true;
        if (userProfile.plan_tier !== 'professional') return false;

        const now = new Date();
        if (userProfile.subscription_status === 'active') {
            if (!userProfile.subscription_expiry) return false;
            return new Date(userProfile.subscription_expiry) > now;
        }

        if (userProfile.subscription_status === 'past_due') {
            if (!userProfile.grace_period_ends_at) return false;
            return new Date(userProfile.grace_period_ends_at) > now;
        }

        return false;
    }, [userProfile]);

    // Click tracking: fire-and-forget feedback for re-ranking
    const trackClick = (caseUrl, action) => {
        if (!caseUrl || isDemoProp) return;
        fetch('/api/research/track-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                case_url: caseUrl,
                action,
                query_context: query?.substring(0, 500)
            })
        }).catch(() => { }); // Fire-and-forget
    };


    // Load tribunal catalog once when manual mode is first activated
    useEffect(() => {
        if (jurisprudenciaMode !== 'manual' || manualCatalogLoaded) return;
        setManualCatalogLoaded(true);
        fetch('/api/research/catalog')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.camaras?.length) setManualCatalog(data); })
            .catch(() => { /* silent fail: tribunal field stays as datalist */ });
    }, [jurisprudenciaMode, manualCatalogLoaded]);

    // Load facets (fuero counts + tribunal list) from local index
    useEffect(() => {
        if (jurisprudenciaMode !== 'manual' || facetsLoaded) return;
        setFacetsLoaded(true);
        fetch('/api/research/facets')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.fueros) setIndexFacets(data); })
            .catch(() => { /* silent fail */ });
    }, [jurisprudenciaMode, facetsLoaded]);

    useEffect(() => {
        setHasSpeechSupport(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    }, []);

    async function startVoiceInput() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        // Pedir permiso de micrófono explícitamente para que el browser muestre el diálogo nativo
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
        } catch {
            setMicError('Permiso de micrófono denegado. Habilitalo desde la configuración del navegador.');
            setTimeout(() => setMicError(''), 6000);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-AR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            setQuery(prev => prev ? prev + ' ' + transcript : transcript);
        };
        recognition.onerror = (e) => {
            setIsListening(false);
            const msgs = {
                'not-allowed': 'Permiso denegado. Habilitá el micrófono en la configuración del navegador.',
                'network': 'Tu navegador no puede acceder al servicio de voz. Probá con Chrome o Edge.',
                'no-speech': '',
            };
            const msg = msgs[e.error] ?? 'No se pudo acceder al micrófono.';
            if (msg) {
                setMicError(msg);
                setTimeout(() => setMicError(''), 6000);
            }
        };
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    }

    useEffect(() => {
        let timer;
        if (loading && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [loading, timeLeft]);

    // Detectar redirect de MercadoPago tras compra de credits
    useEffect(() => {
        const creditsParam = searchParams?.get('credits');
        if (!creditsParam) return;

        setCreditsToast(creditsParam);
        // Limpiar param de la URL sin recargar
        router.replace('/dashboard/research', { scroll: false });

        // Si el pago fue aprobado, refrescar perfil para mostrar nuevos credits
        if (creditsParam === 'ok') {
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (!user) return;
                supabase.from('profiles').select('*').eq('id', user.id).single()
                    .then(({ data: profile }) => {
                        if (profile) setUserProfile(profile);
                    });
            });
        }

        // Auto-dismiss toast después de 5s
        const t = setTimeout(() => setCreditsToast(null), 5000);
        return () => clearTimeout(t);
    }, [searchParams]);

    useEffect(() => {
        const fetchUserAndHistory = async () => {
            if (isDemoProp) {
                // DEMO MODE SETUP
                setHistory(demoResearchHistory);
                // Mock user profile for PDF generation
                setUserProfile({ full_name: "Usuario Demo", matricula: "Tº 100 Fº 1" });
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUser(user);
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setUserProfile(profile);

                // Check trial expiration (frontend UX; backend enforces this)
                if (profile && isTrialExpired(profile)) {
                    setTrialExpired(true);
                }

                // Fetch History
                const { data: reports } = await supabase
                    .from('research_reports')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (reports) setHistory(reports);
            }
        };
        fetchUserAndHistory();

        // Convert logo to base64 for PDF (cached at module level)
        if (_logoCache) {
            setLogoBase64(_logoCache);
        } else {
            fetch('/judic-ia-mark.png')
                .then(res => res.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        _logoCache = reader.result;
                        setLogoBase64(reader.result);
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(err => console.error("Error loading logo:", err));
        }
    }, []);

    const handleDownloadPDF = () => {
        generateResearchPDF(results, userProfile, currentUser, {
            scope,
            province,
            query,
            logoBase64
        });
    };

    const handleRefreshCase = async (index) => {
        if (!query || refreshingCases[index]) return;

        // Refresh governance: front-end blocks
        const isDemo = isDemoProp || !currentUser || userProfile?.subscription_status === 'demo';
        if (isDemo) {
            alert("Funcion disponible solo para usuarios Profesionales.");
            return;
        }

        if (refreshQuota <= 0) {
            setQuotaExhausted(true);
            setQuotaModalOpen(true);
            return;
        }

        setRefreshingCases(prev => ({ ...prev, [index]: true }));
        trackClick(results.cases[index]?.url, 'refresh');

        try {
            // Collect all current URLs to exclude
            const excludeUrls = results.cases.map(c => c.url).filter(Boolean);

            const res = await fetch('/api/research/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    excludeUrls,
                    mode: isDemo ? 'demo' : 'pro',
                    userId: currentUser?.id
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to refresh");
            }

            const newCase = await res.json();

            setResults(prev => {
                const newCases = [...prev.cases];
                newCases[index] = newCase;
                return { ...prev, cases: newCases };
            });

            // Consume Quota
            setRefreshQuota(prev => prev - 1);

        } catch (error) {
            console.error("Refresh error:", error);
            alert(`No se pudo actualizar el fallo: ${error.message}`);
        } finally {
            setRefreshingCases(prev => ({ ...prev, [index]: false }));
        }
    };

    // Handle PDF capture via Puppeteer
    const handleCapture = async (index, url, title) => {
        if (capturingCases[index]) return;

        setCapturingCases(prev => ({ ...prev, [index]: true }));
        trackClick(url, 'view_pdf');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;

            const res = await fetch('/api/research/capture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
                },
                body: JSON.stringify({ url, title })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Fallo en captura');
            }

            const data = await res.json();
            // Open in internal PDF viewer
            const viewerUrl = `/dashboard/legislation/viewer/case?url=${encodeURIComponent(data.url)}&title=${encodeURIComponent(title)}&from=research`;
            window.open(viewerUrl, '_blank');

        } catch (error) {
            console.error("Capture failed:", error);
            alert("No se pudo generar el PDF limpio: " + error.message);
            // Fallback: try old proxy if capture fails? or just let user know.
            // window.open(`/api/proxy-pdf?url=${encodeURIComponent(url)}`, '_blank');
        } finally {
            setCapturingCases(prev => ({ ...prev, [index]: false }));
        }
    };

    const renderContent = (content) => {
        if (!content) return null;
        let text = "";
        if (typeof content === 'string') text = content;
        else if (Array.isArray(content)) text = content.join('\n');
        else if (typeof content === 'object') text = Object.entries(content).map(([k, v]) => `### ${k}\n${v}`).join('\n\n');
        else text = String(content);

        // Pre-process: Logic to detect if it's a list (e.g. "1. xxx 2. xxx") and break lines
        // If we find "1. ", "2. " pattern in the text, we try to split it into a real list.
        const hasNumberedList = /\s\d+\.\s/.test(text) || /^\d+\.\s/.test(text);

        if (hasNumberedList) {
            // Split by number pattern but keep the delimiter to reconstruct or map
            const parts = text.split(/(\d+\.\s+)/).filter(Boolean);

            // If the split actually resulted in meaningful parts, render as list
            if (parts.length > 1) {
                return (
                    <ul className="numbered-list">
                        {parts.reduce((acc, part, i) => {
                            // Check if this part is the number marker ("1. ")
                            if (/^\d+\.\s+$/.test(part)) {
                                acc.push({ marker: part.trim(), content: parts[i + 1] || "" });
                            }
                            return acc;
                        }, []).map((item, i) => (
                            <li key={i} className="numbered-list-item">
                                <span className="numbered-list-marker">{item.marker}</span>
                                <span className="numbered-list-content">{item.content}</span>
                            </li>
                        ))}
                    </ul>
                );
            }
        }

        return text.split('\n').map((line, index) => {
            // Handle Headers
            if (line.match(/^#{1,6}\s/)) {
                const match = line.match(/^#{1,6}\s/);
                const level = match[0].trim().length;
                const cleanLine = line.replace(/^#{1,6}\s/, '');
                const levelClass = level <= 2 ? 'research-h3' : (level === 3 ? 'research-h4' : 'research-h5');

                if (level <= 2) return <h3 key={index} className={levelClass}>{cleanLine}</h3>;
                if (level === 3) return <h4 key={index} className={levelClass}>{cleanLine}</h4>;
                return <h5 key={index} className={levelClass}>{cleanLine}</h5>;
            }

            // Bold text
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return (
                <p key={index} className="research-p">
                    {parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={i} className="research-strong">{part.slice(2, -2)}</strong>;
                        }
                        return part;
                    })}
                </p>
            );
        });
    };

    // Empresa search handler
    const handleEmpresaSearch = async (e) => {
        e.preventDefault();
        if (!empresaName && !empresaCuit) return;
        setEmpresaLoading(true);
        setEmpresaResults(null);
        setEmpresaError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch('/api/research/company', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({
                    name: empresaName || undefined,
                    cuit: empresaCuit || undefined,
                    jurisdiction: empresaJurisdiction
                })
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.error === 'QUOTA_EXCEEDED') {
                    setQuotaExhausted(true);
                    setQuotaModalOpen(true);
                    return;
                }
                setEmpresaError(data.error || 'Error al buscar. Intentá de nuevo.');
                return;
            }

            setEmpresaResults(data);

            // Reload profile to update quota display
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (profile) setUserProfile(profile);
            }
        } catch (err) {
            setEmpresaError('Error de conexión. Verificá tu internet.');
        } finally {
            setEmpresaLoading(false);
        }
    };

    // Pre-flight check: analyze query quality before searching
    const resetManualFilters = () => {
        setManualQuery('');
        setManualProvince('Buenos Aires');
        setManualInstancia('todas');
        setManualJurisdiction('provincial');
        setManualFuero('todas');
        setManualTribunal('');
        setManualDateFrom('');
        setManualDateTo('');
        setManualKeywords('');
        setManualError('');
        setManualResults([]);
        setManualSearched(false);
        setManualMeta(null);
    };

    const handleManualSearch = async (e) => {
        if (e) e.preventDefault();

        const trimmedQuery = manualQuery.trim();
        const trimmedKeywords = manualKeywords.trim();
        const effectiveQuery = trimmedQuery || trimmedKeywords;

        if (effectiveQuery.length < 3) {
            setManualError('Escribi al menos 3 caracteres en Texto libre o Palabras clave.');
            setManualResults([]);
            setManualMeta(null);
            setManualSearched(false);
            return;
        }

        if (manualDateFrom && manualDateTo && manualDateFrom > manualDateTo) {
            setManualError('Fecha desde no puede ser mayor a fecha hasta.');
            setManualResults([]);
            setManualMeta(null);
            setManualSearched(false);
            return;
        }

        setManualLoading(true);
        setManualError('');
        setManualSearched(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;

            const res = await fetch('/api/research/manual', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
                },
                body: JSON.stringify({
                    query: effectiveQuery,
                    province: manualProvince,
                    instancia: manualInstancia,
                    jurisdiction: manualJurisdiction,
                    fuero: manualFuero,
                    tribunal: manualTribunal.trim(),
                    dateFrom: manualDateFrom || null,
                    dateTo: manualDateTo || null,
                    keywords: trimmedKeywords || null,
                    limit: 60
                })
            });

            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.message || payload?.error || 'No se pudo completar la busqueda manual BA.');
            }

            setManualResults(Array.isArray(payload.cases) ? payload.cases : []);
            setManualMeta({
                total: Number(payload.total) || 0,
                totalMatched: Number(payload.totalMatched) || 0,
                totalAvailable: Number(payload.totalAvailable) || 0,
                scannedPages: Number(payload.scannedPages) || 0,
                sourceLabel: payload.sourceLabel || 'SCBA publico',
                sourceUrl: payload.sourceUrl || '',
                message: payload.message || ''
            });
        } catch (err) {
            setManualError(err?.message || 'Error de conexion en busqueda manual BA.');
            setManualResults([]);
            setManualMeta(null);
        } finally {
            setManualLoading(false);
        }
    };

    const handleSearch = async (e, forceQuery = null) => {
        if (e) e.preventDefault();
        const finalQuery = forceQuery || query || (placeholder.startsWith("Ej:") ? "" : placeholder);
        if (!finalQuery) return;

        // Assisted mode: check query quality first
        if (assistedMode && !forceQuery) {
            setAnalyzingQuery(true);
            const quality = analyzeQueryQuality(finalQuery);
            setQueryQuality(quality);
            setAnalyzingQuery(false);

            console.log('[QueryQuality] Analysis:', {
                query: finalQuery,
                score: quality.score,
                level: quality.level,
                shouldEnhance: quality.shouldEnhance,
                issues: quality.issues,
                strengths: quality.strengths
            });

            // If query is poor, offer enhancement
            if (quality.shouldEnhance && quality.score < 60) {
                console.log('[Enhancer] Attempting to enhance query...');
                try {
                    const jurisdiction = scope === 'nacional' ? 'Nacional' : province;
                    const { data: { session: enhanceSession } } = await supabase.auth.getSession();
                    const enhanceToken = enhanceSession?.access_token;

                    const enhanceRes = await fetch('/api/research/enhance', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(enhanceToken && { 'Authorization': `Bearer ${enhanceToken}` })
                        },
                        body: JSON.stringify({ query: finalQuery, jurisdiction })
                    });

                    console.log('[Enhancer] API response:', enhanceRes.status);

                    if (enhanceRes.ok) {
                        const enhancement = await enhanceRes.json();
                        console.log('[Enhancer] Enhancement received:', enhancement);

                        if (enhancement.enhanced && enhancement.enhanced !== finalQuery && enhancement.confidence >= 50) {
                            console.log('[Enhancer] Showing enhancement modal');
                            // Show enhancement modal
                            setEnhancementModal({
                                original: finalQuery,
                                enhanced: enhancement.enhanced,
                                quality: quality,
                                changes: enhancement.changes,
                                reasoning: enhancement.reasoning
                            });
                            return; // Stop here, wait for user decision
                        } else {
                            console.log('[Enhancer] Enhancement not shown:', {
                                same: enhancement.enhanced === finalQuery,
                                lowConfidence: enhancement.confidence < 50
                            });
                        }
                    } else {
                        const errorText = await enhanceRes.text();
                        console.error('[Enhancer] API failed:', errorText);
                    }
                } catch (err) {
                    console.error('[Enhancer] Error:', err);
                }
            } else {
                console.log('[Enhancer] Skipping enhancement (score too high or not needed)');
            }
        }

        // Execute search
        await executeSearch(finalQuery);
    };

    // Separated search execution for reuse
    const executeSearch = async (finalQuery) => {
        setLoading(true);
        setResults(null);
        setTimeLeft(60);
        setReformulationModal(null); // Clear any previous reformulation suggestions

        if (isDemoProp) {
            // SIMULATE SEARCH IN DEMO
            const analysisSteps = [
                'Iniciando busqueda avanzada...',
                'Revisando bases documentales...',
                'Filtrando resultados por relevancia juridica...',
                'Detectando parametros de calculo...',
                'Finalizando analisis legal...'
            ];
            let stepIndex = 0;
            setSearchStatus(analysisSteps[0]);

            const statusInterval = setInterval(() => {
                stepIndex = (stepIndex + 1);
                if (stepIndex < analysisSteps.length) {
                    setSearchStatus(analysisSteps[stepIndex]);
                }
            }, 800);

            setTimeout(() => {
                clearInterval(statusInterval);
                setResults(demoFullResearchResult);
                setLoading(false);
                setSearchStatus('');
            }, 4500);
            return;
        }

        const analysisSteps = [
            'Iniciando busqueda avanzada...',
            'Revisando bases documentales...',
            'Consultando nodos documentales provinciales...',
            'Filtrando resultados por relevancia juridica...',
            'Analizando doctrina y antecedentes relevantes...',
            'Extrayendo fundamentos clave...',
            'Detectando parametros de calculo...',
            'Preparando recomendacion estrategica...',
            'Finalizando analisis legal...'
        ];

        let stepIndex = 0;
        setSearchStatus(analysisSteps[0]);

        const statusInterval = setInterval(() => {
            stepIndex = (stepIndex + 1) % analysisSteps.length;
            setSearchStatus(analysisSteps[stepIndex]);
        }, 3500);

        try {
            // Get current session token for Authorization
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;

            const res = await fetch('/api/research', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
                },
                body: JSON.stringify({
                    query: finalQuery,
                    jurisdiction: scope === 'nacional' ? 'Nacional' : province,
                    mode: 'pro'
                })
            });

            if (res.status === 402) {
                setQuotaExhausted(true);
                setQuotaModalOpen(true);
                setLoading(false);
                return;
            }

            if (!res.ok) throw new Error("Search failed");
            const data = await res.json();
            setResults(data);

            // [FIX] Update History Immediately
            if (data.report_meta) {
                const newHistoryItem = {
                    id: data.report_meta.id,
                    created_at: data.report_meta.created_at,
                    query: finalQuery,
                    jurisdiction: scope === 'nacional' ? 'Nacional' : province,
                    result_json: data
                };
                setHistory(prev => [newHistoryItem, ...prev]);
            }

            // Post-search: check results quality and offer reformulation if needed
            if (assistedMode && data.cases && data.cases.length > 0) {
                const avgScore = data._debug?.avg_score
                    ?? Math.round(data.cases.reduce((sum, c) => sum + (c.score || 0), 0) / data.cases.length);
                const highQualityCases = data._debug?.high_score
                    ?? data.cases.filter(c => (c.score || 0) >= 60).length;

                // If results are poor, offer alternatives
                if (avgScore < 50 || highQualityCases < 2) {
                    setTimeout(async () => {
                        try {
                            const { data: { session: altSession } } = await supabase.auth.getSession();
                            const altToken = altSession?.access_token;

                            const altRes = await fetch('/api/research/alternatives', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(altToken && { 'Authorization': `Bearer ${altToken}` })
                                },
                                body: JSON.stringify({
                                    query: finalQuery,
                                    jurisdiction: scope === 'nacional' ? 'Nacional' : province
                                })
                            });

                            if (altRes.ok) {
                                const alternatives = await altRes.json();
                                if (alternatives.alternatives && alternatives.alternatives.length > 0) {
                                    setReformulationModal({
                                        original: finalQuery,
                                        alternatives: alternatives.alternatives,
                                        avgScore: Math.round(avgScore)
                                    });
                                }
                            }
                        } catch (err) {
                            console.warn('Failed to generate alternatives:', err);
                        }
                    }, 2000); // Show after 2 seconds so user can see initial results
                }
            }

        } catch (error) {
            console.error("Search error:", error);
            setSearchStatus('Error en la investigación avanzada.');
        } finally {
            clearInterval(statusInterval);
            setLoading(false);
            setSearchStatus('');
            setRefreshQuota(5); // Reset quota for new search
        }
    };

    const provinces = [
        "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
        "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza",
        "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
        "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
    ];

    return (
        <div className="research-container">
            {/* CREDITS PURCHASE TOAST */}
            {creditsToast && (
                <div className={`credits-toast ${creditsToast === 'ok' ? 'success' : creditsToast === 'pending' ? 'pending' : 'error'}`}>
                    {creditsToast === 'ok' && 'Creditos acreditados. Ya podes seguir buscando.'}
                    {creditsToast === 'pending' && '⏳ Pago en proceso. Los créditos se acreditarán en breve.'}
                    {creditsToast === 'error' && 'El pago no se completo. Intenta de nuevo.'}
                    <button
                        type="button"
                        className="credits-toast-close"
                        onClick={() => setCreditsToast(null)}
                        aria-label="Cerrar aviso de creditos"
                    >
                        x
                    </button>
                </div>
            )}

            {/* Trial expired block: UX only, backend is real security */}
            {trialExpired && !isDemoProp && (
                <TrialExpiredBlock featureName="Jurisprudencia" />
            )}

            {/* Main content - hidden when trial expired */}
            {!trialExpired && (
                <div className={`research-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                    {/* HISTORY SIDEBAR */}
                    {/* HISTORY SIDEBAR - Modified for Mobile Overlay */}
                    <>
                        {/* Mobile Toggle Button (Visible only on small screens via CSS) */}
                        <button
                            type="button"
                            className="mobile-history-toggle"
                            onClick={() => setSidebarOpen(true)}
                            aria-controls="research-history-sidebar"
                            aria-expanded={sidebarOpen}
                            aria-label="Abrir historial"
                        >
                            <span>Historial</span>
                        </button>

                        {/* Overlay Backdrop (only visible when sidebar is open on mobile) */}
                        <div
                            className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
                            onClick={() => setSidebarOpen(false)}
                            aria-hidden="true"
                        />

                        <aside
                            id="research-history-sidebar"
                            className={`research-sidebar glass-panel ${sidebarOpen ? 'open' : 'closed'}`}
                        >
                            {/* Always show header with Close button on Mobile/Expand */}
                            {(sidebarOpen || true) && (
                                <div className="sidebar-header-row">
                                    <h4 className="sidebar-title">Historial</h4>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }}
                                        className="sidebar-close-btn"
                                        aria-label={sidebarOpen ? 'Cerrar historial' : 'Abrir historial'}
                                    >
                                        {sidebarOpen ? 'x' : '>'}
                                    </button>
                                </div>
                            )}

                            {/* Collapsed State Icon (Desktop Only) */}
                            {!sidebarOpen && (
                                <button
                                    type="button"
                                    className="collapsed-icon-area"
                                    onClick={() => setSidebarOpen(true)}
                                    aria-label="Abrir historial"
                                >
                                    <div className="vertical-trigger">
                                        <span className="v-icon">H</span>
                                        <span className="v-label">HISTORIAL</span>
                                    </div>
                                </button>
                            )}

                            {sidebarOpen && (
                                <div className="history-list history-list-container">
                                    {history.length === 0 && <p className="history-empty-text">Sin investigaciones recientes.</p>}
                                    {history.map(item => (
                                        <button
                                            type="button"
                                            key={item.id}
                                            className="history-item history-item-box"
                                            onClick={() => { setQuery(item.query); setResults(item.result_json); }}
                                            aria-label={`Abrir historial: ${item.query}`}
                                        >
                                            <div className="history-item-query">
                                                {item.query}
                                            </div>
                                            <div className="history-item-meta">
                                                {new Date(item.created_at).toLocaleDateString()} - {item.jurisdiction}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </aside>
                    </>
                    <div className="main-content-area">
                        <nav className="research-nav">
                            <div className="breadcrumb">
                                <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                                <span className="breadcrumb-separator">/</span>
                                <span className="breadcrumb-current">Terminal de Estrategia</span>
                            </div>
                        </nav>

                        <header className="research-header">
                            <div className="header-flex">
                                <Image
                                    src="/judic-ia-mark.png"
                                    alt="Judic-IA Logo"
                                    className="logo-main logo-main-contain"
                                    width={56}
                                    height={75}
                                />
                                <div className="header-text">
                                    <h1 className="dashboard-page-title">Terminal de Estrategia Jurídica</h1>
                                    <p>Investigación avanzada, Ratio Decidendi y generación de estrategia blindada.</p>
                                </div>
                                <UsageGuide content={dashboardManuals.research} />
                            </div>
                        </header>

                        {/* TAB SWITCHER */}
                        <div className="research-tabs">
                            <button
                                type="button"
                                className={`research-tab ${activeTab === 'jurisprudencia' ? 'active' : ''}`}
                                onClick={() => setActiveTab('jurisprudencia')}
                            >
                                <Search size={15} /> Estrategia
                            </button>
                            <button
                                type="button"
                                className={`research-tab ${activeTab === 'pjn' ? 'active' : ''}`}
                                onClick={() => setActiveTab('pjn')}
                            >
                                <Gavel size={15} /> Consulta Verificable
                            </button>
                            <button
                                type="button"
                                className={`research-tab ${activeTab === 'alerts' ? 'active' : ''}`}
                                onClick={() => setActiveTab('alerts')}
                            >
                                <AlertCircle size={15} /> Alertas
                            </button>
                        </div>


                        {/* Consulta verificable tab */}
                        {activeTab === 'pjn' && (
                            <div className="search-box-container glass-panel">
                                <PJNSearchPanel />
                            </div>
                        )}

                        {activeTab === 'alerts' && (
                            <div className="search-box-container glass-panel">
                                <AlertsPanel />
                            </div>
                        )}

                        {/* Jurisprudencia tab */}
                        {activeTab === 'jurisprudencia' && (
                            <div className="search-box-container glass-panel">
                                <div className="juris-mode-tabs">
                                    <button
                                        className={`juris-mode-tab ${jurisprudenciaMode === 'ia' ? 'active' : ''}`}
                                        onClick={() => setJurisprudenciaMode('ia')}
                                        type="button"
                                    >
                                        <Sparkles size={14} /> Estrategia IA
                                    </button>
                                    <button
                                        className={`juris-mode-tab ${jurisprudenciaMode === 'manual' ? 'active' : ''}`}
                                        onClick={() => setJurisprudenciaMode('manual')}
                                        type="button"
                                    >
                                        <Search size={14} /> Busqueda Manual
                                    </button>
                                </div>

                                {jurisprudenciaMode === 'manual' && (
                                    <div className="manual-panel-inline">
                                        <form onSubmit={handleManualSearch} className="manual-form-inline">
                                            <div className="manual-grid-inline">
                                                <div className="manual-field-inline">
                                                    <label htmlFor="manual_province">Provincia</label>
                                                    <select
                                                        id="manual_province"
                                                        value={manualProvince}
                                                        onChange={(e) => setManualProvince(e.target.value)}
                                                    >
                                                        <option value="Buenos Aires">Buenos Aires</option>
                                                    </select>
                                                </div>
                                                <div className="manual-field-inline">
                                                    <label htmlFor="manual_instancia">Instancia</label>
                                                    <select
                                                        id="manual_instancia"
                                                        value={manualInstancia}
                                                        onChange={(e) => setManualInstancia(e.target.value)}
                                                    >
                                                        <option value="todas">Todas</option>
                                                        <option value="scba">SCBA</option>
                                                        <option value="camara">Camara</option>
                                                        <option value="juzgado">Juzgado</option>
                                                    </select>
                                                </div>
                                                <div className="manual-field-inline">
                                                    <label htmlFor="manual_jurisdiction">Jurisdiccion</label>
                                                    <select
                                                        id="manual_jurisdiction"
                                                        value={manualJurisdiction}
                                                        onChange={(e) => setManualJurisdiction(e.target.value)}
                                                    >
                                                        <option value="provincial">Provincial (PBA)</option>
                                                        <option value="todas">Todas</option>
                                                    </select>
                                                </div>
                                                <div className="manual-field-inline">
                                                    <label htmlFor="manual_fuero">
                                                        Fuero
                                                        {indexFacets?.total > 0 && (
                                                            <span className="facet-index-badge">{indexFacets.total.toLocaleString('es-AR')} fallos</span>
                                                        )}
                                                    </label>
                                                    <select
                                                        id="manual_fuero"
                                                        value={manualFuero}
                                                        onChange={(e) => setManualFuero(e.target.value)}
                                                    >
                                                        <option value="todas">Todos los fueros</option>
                                                        {indexFacets?.fueros?.length > 0
                                                            ? indexFacets.fueros.map(f => (
                                                                <option key={f.key} value={f.key}>
                                                                    {f.label} ({f.count.toLocaleString('es-AR')})
                                                                </option>
                                                            ))
                                                            : (
                                                                <>
                                                                    <option value="civil_comercial">Civil y Comercial</option>
                                                                    <option value="familia">Familia</option>
                                                                    <option value="laboral">Laboral</option>
                                                                    <option value="penal">Penal</option>
                                                                    <option value="contencioso_admin">Contencioso Administrativo</option>
                                                                    <option value="previsional">Previsional</option>
                                                                </>
                                                            )
                                                        }
                                                    </select>
                                                </div>
                                                <div className="manual-field-inline manual-field-tribunal">
                                                    <label htmlFor="manual_tribunal_search">Tribunal/Juzgado</label>
                                                    <input
                                                        id="manual_tribunal_search"
                                                        type="text"
                                                        placeholder={indexFacets?.tribunales?.length > 0
                                                            ? `Buscar entre ${indexFacets.tribunales.length} tribunales...`
                                                            : 'Ej: Camara Civil Quilmes'}
                                                        value={tribunalSearch}
                                                        onChange={(e) => {
                                                            setTribunalSearch(e.target.value);
                                                            setManualTribunal(e.target.value);
                                                        }}
                                                        autoComplete="off"
                                                        list="tribunal-datalist"
                                                    />
                                                    {indexFacets?.tribunales?.length > 0 && (
                                                        <datalist id="tribunal-datalist">
                                                            {indexFacets.tribunales
                                                                .filter(t =>
                                                                    !tribunalSearch ||
                                                                    t.value.toLowerCase().includes(tribunalSearch.toLowerCase())
                                                                )
                                                                .slice(0, 50)
                                                                .map(t => (
                                                                    <option key={t.value} value={t.value}>
                                                                        {t.value} ({t.count})
                                                                    </option>
                                                                ))
                                                            }
                                                        </datalist>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="manual-date-row-inline">
                                                <div className="manual-field-inline">
                                                    <label htmlFor="manual_date_from">Fecha desde</label>
                                                    <input
                                                        id="manual_date_from"
                                                        type="date"
                                                        value={manualDateFrom}
                                                        onChange={(e) => setManualDateFrom(e.target.value)}
                                                    />
                                                </div>
                                                <div className="manual-field-inline">
                                                    <label htmlFor="manual_date_to">Fecha hasta</label>
                                                    <input
                                                        id="manual_date_to"
                                                        type="date"
                                                        value={manualDateTo}
                                                        onChange={(e) => setManualDateTo(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="manual-text-row-inline">
                                                <div className="manual-field-inline">
                                                    <label htmlFor="manual_query">Texto libre</label>
                                                    <input
                                                        id="manual_query"
                                                        type="text"
                                                        placeholder="Ej: despido sin causa, mala praxis, reajuste previsional"
                                                        value={manualQuery}
                                                        onChange={(e) => setManualQuery(e.target.value)}
                                                    />
                                                </div>
                                                <div className="manual-field-inline">
                                                    <label htmlFor="manual_keywords">Palabras clave</label>
                                                    <input
                                                        id="manual_keywords"
                                                        type="text"
                                                        placeholder="Ej: alimentos, cuota, camara"
                                                        value={manualKeywords}
                                                        onChange={(e) => setManualKeywords(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="manual-actions-inline">
                                                <button type="submit" disabled={manualLoading} className="btn-search-submit manual-inline-btn">
                                                    {manualLoading ? <Loader2 size={18} className="spin-animation" /> : <Search size={18} />}
                                                    {manualLoading ? 'Buscando...' : 'Buscar registros'}
                                                </button>
                                                <button type="button" className="manual-inline-clear" onClick={resetManualFilters}>
                                                    Limpiar filtros
                                                </button>
                                            </div>
                                        </form>

                                        <p className="manual-inline-hint">
                                            Consulta documental estructurada. Sin consumo de estrategia IA.
                                        </p>
                                        {manualMeta?.sourceLabel && (
                                            <p className="manual-inline-meta">
                                                Referencia: {manualMeta.sourceLabel}
                                                {manualMeta.sourceUrl && (
                                                    <>
                                                        {' '}|{' '}
                                                        <a href={manualMeta.sourceUrl} target="_blank" rel="noopener noreferrer" className="manual-inline-link">
                                                            Abrir portal
                                                        </a>
                                                    </>
                                                )}
                                            </p>
                                        )}
                                        {manualMeta?.message && (
                                            <p className="manual-inline-meta">{manualMeta.message}</p>
                                        )}

                                        {manualError && (
                                            <div className="manual-inline-error">
                                                <AlertCircle size={16} /> {manualError}
                                            </div>
                                        )}

                                        {manualSearched && !manualLoading && (
                                            <div className="manual-inline-results">
                                                <p className="manual-inline-count">
                                                    {manualResults.length} resultado{manualResults.length !== 1 ? 's' : ''} visible{manualResults.length !== 1 ? 's' : ''}
                                                    {manualMeta?.totalMatched ? ` | ${manualMeta.totalMatched} coincidentes` : ''}
                                                    {manualMeta?.totalAvailable ? ` | ${manualMeta.totalAvailable} totales` : ''}
                                                    {manualMeta?.scannedPages ? ` | ${manualMeta.scannedPages} pagina${manualMeta.scannedPages !== 1 ? 's' : ''} escaneada${manualMeta.scannedPages !== 1 ? 's' : ''}` : ''}
                                                </p>

                                                {manualResults.length === 0 ? (
                                                    <p className="manual-inline-empty">No se encontraron coincidencias con los filtros actuales.</p>
                                                ) : (
                                                    <div className="manual-inline-cases">
                                                        {manualResults.map((item, idx) => {
                                                            const sourceUrl = item.url || '';
                                                            const pdfUrl = item.pdf_url || '';

                                                            return (
                                                                <div key={item.id || item.url || idx} className="manual-inline-card">
                                                                    <div className="manual-inline-card-head">
                                                                        <span className="manual-inline-tag">{item.province || 'Buenos Aires'}</span>
                                                                        {item.instancia && <span className="manual-inline-tag">{item.instancia}</span>}
                                                                        {item.fuero && <span className="manual-inline-tag">{item.fuero}</span>}
                                                                        {item.date_label && <span className="manual-inline-score">{item.date_label}</span>}
                                                                        {typeof item.relevance === 'number' && (
                                                                            <span className="manual-inline-score">Score {Math.round(item.relevance)}</span>
                                                                        )}
                                                                    </div>

                                                                    <p className="manual-inline-title">{item.autos || 'Fallo sin titulo disponible'}</p>
                                                                    {item.tribunal && <p className="manual-inline-meta-row">Tribunal/Juzgado: {item.tribunal}</p>}
                                                                    {item.summary && <p className="manual-inline-summary">{item.summary}</p>}

                                                                    <div className="manual-inline-links">
                                                                        {sourceUrl && (
                                                                            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="manual-inline-link">
                                                                                <ExternalLink size={13} /> Ver registro
                                                                            </a>
                                                                        )}
                                                                        {pdfUrl && (
                                                                            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="manual-inline-link">
                                                                                <FileText size={13} /> Ver PDF
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{ display: jurisprudenciaMode === 'manual' ? 'none' : 'block' }}>
                                    {/* MODE SELECTOR - Two clear cards */}
                                    <div className="mode-selector">
                                        <span className="mode-selector-label">¿Cómo querés buscar?</span>
                                        <div className="mode-cards">
                                            <button
                                                type="button"
                                                onClick={() => setAssistedMode(true)}
                                                className={`mode-card ${assistedMode ? 'selected' : ''}`}
                                            >
                                                <div className="mode-card-icon assisted-icon">
                                                    <Sparkles size={22} />
                                                </div>
                                                <span className="mode-card-title">Asistido por IA</span>
                                                <span className="mode-card-desc">La IA analiza y mejora tu búsqueda antes de ejecutarla para obtener mejores resultados.</span>
                                                {assistedMode && <span className="mode-card-badge">Activo</span>}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAssistedMode(false)}
                                                className={`mode-card ${!assistedMode ? 'selected' : ''}`}
                                            >
                                                <div className="mode-card-icon expert-icon">
                                                    <Zap size={22} />
                                                </div>
                                                <span className="mode-card-title">Búsqueda Directa</span>
                                                <span className="mode-card-desc">Tu consulta se ejecuta tal cual la escribís, sin modificaciones. Ideal para búsquedas precisas.</span>
                                                {!assistedMode && <span className="mode-card-badge">Activo</span>}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="jurisdiction-selector">
                                        <label htmlFor="res_scope_nacional" className={`radio-btn ${scope === 'nacional' ? 'active' : ''}`}>
                                            <input
                                                id="res_scope_nacional"
                                                type="radio"
                                                name="scope"
                                                value="nacional"
                                                checked={scope === 'nacional'}
                                                onChange={() => setScope('nacional')}
                                            />
                                            Justicia Nacional / Federal
                                        </label>
                                        <label htmlFor="res_scope_provincial" className={`radio-btn ${scope === 'provincial' ? 'active' : ''}`}>
                                            <input
                                                id="res_scope_provincial"
                                                type="radio"
                                                name="scope"
                                                value="provincial"
                                                checked={scope === 'provincial'}
                                                onChange={() => setScope('provincial')}
                                            />
                                            Justicia Provincial
                                        </label>

                                        {scope === 'provincial' && (
                                            <>
                                                <label htmlFor="res_province_select" className="sr-only">Seleccionar Provincia</label>
                                                <select
                                                    id="res_province_select"
                                                    className="province-select"
                                                    value={province}
                                                    onChange={(e) => setProvince(e.target.value)}
                                                >
                                                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </>
                                        )}
                                    </div>

                                    {/* Search tips */}
                                    <details className="search-tips-details tips-details">
                                        <summary className="tips-summary">
                                            <Zap size={14} fill="#fbbf24" />
                                            <span>Tips para búsquedas de Alta Precisión</span>
                                        </summary>
                                        <div className="tips-content tips-content-box">
                                            <p className="tips-intro-p">Para obtener los mejores resultados, utilizá estos patrones:</p>
                                            <ul className="tips-list">
                                                <li className="tips-li">
                                                    <strong>Tema + "fallo" o "sentencia":</strong> <span className="tips-example">Ej: "despido sin causa fallo", "cuota alimentaria sentencia"</span>
                                                </li>
                                                <li className="tips-li">
                                                    <strong>Frase exacta entre comillas:</strong> <span className="tips-example">Ej: "daño moral" accidente tránsito</span>
                                                </li>
                                                <li className="tips-li">
                                                    <strong>Jurisdicción específica:</strong> <span className="tips-example">Ej: "mala praxis médica cordoba camara"</span>
                                                </li>
                                                <li>
                                                    <strong>Autos (si conocés):</strong> <span className="tips-example">Ej: "autos garcia c/ perez s/ daños"</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </details>

                                    <form onSubmit={handleSearch} className="search-box">
                                        <label htmlFor="research_input" className="sr-only">Consulta de investigación jurídica</label>
                                        <input
                                            id="research_input"
                                            name="query"
                                            type="text"
                                            placeholder={placeholder}
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                        />
                                        {hasSpeechSupport && (
                                            <button
                                                type="button"
                                                onClick={startVoiceInput}
                                                className={`btn-mic${isListening ? ' listening' : ''}`}
                                                title={isListening ? 'Detener grabación' : 'Dictar consulta por voz'}
                                                aria-label={isListening ? 'Detener grabación' : 'Dictar consulta por voz'}
                                            >
                                                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                                            </button>
                                        )}
                                        <button type="submit" disabled={loading} className="btn-search-submit">
                                            {loading ? <Zap size={18} className="spin-animation" /> : <Search size={18} />}
                                            {loading ? 'Procesando Inteligencia...' : 'Generar Estrategia IA'}
                                        </button>
                                    </form>
                                    {micError && (
                                        <p className="mic-error-hint">{micError}</p>
                                    )}

                                    {!isDemoProp && userProfile && (() => {
                                        const limit = getPlanLimit(userProfile.plan_tier, 'research_reports');
                                        const used = userProfile.research_reports_used || 0;
                                        const extra = userProfile.research_reports_extra || 0;
                                        const monthlyRemaining = limit === -1 ? null : Math.max(0, limit - used);
                                        const usingExtra = limit !== -1 && monthlyRemaining === 0 && extra > 0;
                                        const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));
                                        const isLow = limit !== -1 && !usingExtra && monthlyRemaining <= Math.ceil(limit * 0.2);
                                        return (
                                            <div className="research-quota-bar">
                                                <div className="research-quota-track">
                                                    <div
                                                        className={`research-quota-fill ${isLow || usingExtra ? 'low' : ''}`}
                                                        style={{ width: usingExtra ? '100%' : `${pct}%` }}
                                                    />
                                                </div>
                                                <span className={`research-quota-label ${isLow || usingExtra ? 'low' : ''}`}>
                                                    {limit === -1
                                                        ? 'busquedas ilimitadas'
                                                        : usingExtra
                                                            ? `${extra} créditos extra restantes`
                                                            : `${monthlyRemaining} de ${limit} búsquedas disponibles este mes`}
                                                    {extra > 0 && !usingExtra && (
                                                        <span className="quota-extra-badge"> +{extra} extra</span>
                                                    )}
                                                    {limit !== -1 && userProfile?.subscription_status === 'active' && (
                                                        <button
                                                            type="button"
                                                            className="quota-buy-btn"
                                                            onClick={() => setQuotaModalOpen(true)}
                                                        >
                                                            + Comprar más
                                                        </button>
                                                    )}
                                                </span>
                                            </div>
                                        );
                                    })()}

                                    {loading && (
                                        <div className="loader-container loader-wrapper" aria-live="polite" aria-atomic="true">
                                            <div className="loader-text-wrapper">
                                                <Loader2 className="spin-animation text-amber-400" size={48} />
                                                <p className="loader-status-text">
                                                    {searchStatus}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {results && (
                                        <div className="action-buttons">
                                            <div className="copy-container">
                                                <button
                                                    type="button"
                                                    className="btn-action"
                                                    onClick={() => {
                                                        // ... copy logic same ...
                                                        const parts = [
                                                            "ESTUDIO LEGAL - INVESTIGACION DE IA (JUDIC-IA)",
                                                            "",
                                                            "NORMATIVA APLICABLE:",
                                                            results.laws,
                                                            "",
                                                            "JURISPRUDENCIA Y FALLOS:",
                                                            results.cases.map(c => `- ${c.title}\n   ${c.summary}\n   Referencia: ${c.source || 'N/D'}`).join('\n\n'),
                                                            "",
                                                            results.calculation ? `LIQUIDACION ESTIMADA:\n${results.calculation}\n` : null,
                                                            results.evidence ? `PUNTOS DE PRUEBA:\n${results.evidence}\n` : null,
                                                            "ESTRATEGIA SUGERIDA:",
                                                            results.strategy,
                                                            "",
                                                            "ENLACES:",
                                                            results.links?.map(l => `- ${l.title}: ${l.url}`).join('\n') || "No hay enlaces digitales directos."
                                                        ].filter(Boolean).join('\n');

                                                        navigator.clipboard.writeText(parts);
                                                        setCopySuccess(true);
                                                        setTimeout(() => setCopySuccess(false), 2000);
                                                    }}
                                                >
                                                    <ClipboardCopy size={16} />
                                                    <span>Copiar Texto</span>
                                                </button>
                                                {copySuccess && <span className="copy-toast">Copiado</span>}
                                            </div>
                                            <button type="button" className="btn-action btn-pdf" onClick={handleDownloadPDF}>
                                                <FileText size={16} />
                                                <span>Exportar Informe de Estrategia</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )} {/* end activeTab === 'jurisprudencia' */}

                        {activeTab === 'jurisprudencia' && jurisprudenciaMode === 'ia' && results && (
                            <div className="results-area" aria-live="polite" aria-busy={loading}>
                                {results.brave_used && (
                                    <div className="badge-brave">
                                        <span>Motor inteligente activo</span>
                                        <span className="opacity-60">|</span>
                                        <span>Resultados en tiempo real</span>
                                        {/* DEBUG LOGIC */}
                                        {/* STATUS BADGE LOGIC */}
                                        {isDemoProp || (userProfile && userProfile.subscription_status === 'demo') ? (
                                            <>
                                                <span className="quota-status-badge">|</span>
                                                <span className="demo-quota-text">Refrescos Desactivados (Demo)</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="quota-status-badge">|</span>
                                                <span>Refrescos Restantes: {refreshQuota}/5</span>
                                            </>
                                        )}
                                    </div>
                                )}
                                {results.laws && results.laws.length > 5 && (
                                    <section className="result-card glass-card">
                                        <h3>Normativa Aplicable</h3>
                                        <div className="content">{renderContent(results.laws)}</div>
                                    </section>
                                )}

                                <section className="result-card glass-card">
                                    <h3>Jurisprudencia Similares</h3>
                                    <div className="content">
                                        {Array.isArray(results.cases) ? (
                                            <div className="cases-grid">
                                                {results.cases.length === 0 && <p className="case-empty-text">No se encontraron fallos digitales directos.</p>}
                                                {results.cases.map((c, i) => {
                                                    // Fix malformed URLs (e.g., "www.example.com/https://...")
                                                    let safeUrl = c.url;
                                                    if (safeUrl) {
                                                        if (safeUrl.includes('://') && !safeUrl.startsWith('http')) {
                                                            // Extract the actual URL after the protocol
                                                            const protocolIndex = safeUrl.indexOf('://');
                                                            safeUrl = safeUrl.substring(safeUrl.lastIndexOf('http'));
                                                        } else if (!safeUrl.startsWith('http')) {
                                                            safeUrl = `https://${safeUrl}`;
                                                        }
                                                    }
                                                    const isRefreshing = refreshingCases[i];
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`case-item-card ${isRefreshing ? 'refreshing' : ''}`}
                                                        >
                                                            <div className="case-content-wrapper">
                                                                <div className="case-info">
                                                                    <h4 className="case-title">
                                                                        <Gavel size={16} className="text-amber-400" />
                                                                        {c.title}
                                                                    </h4>
                                                                    <div className="case-summary-scroll">
                                                                        <p className="case-summary-text">
                                                                            {c.summary}
                                                                        </p>
                                                                    </div>
                                                                    <span className="case-source">Referencia: {c.source || 'Registro legal'}</span>
                                                                </div>
                                                                {safeUrl && (
                                                                    <div className="case-actions">
                                                                        <button
                                                                            type="button"
                                                                            className="btn-preview-icon"
                                                                            title="Buscar nueva alternativa (Refresh)"
                                                                            aria-label="Buscar nueva alternativa"
                                                                            onClick={() => handleRefreshCase(i)}
                                                                            disabled={refreshingCases[i]}
                                                                        >
                                                                            <RefreshCw size={16} className={refreshingCases[i] ? "spin-animation" : ""} />
                                                                        </button>
                                                                        <a
                                                                            href={safeUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="btn-link-icon"
                                                                            title="Abrir registro"
                                                                            aria-label="Abrir registro"
                                                                            onClick={() => trackClick(safeUrl, 'open_link')}
                                                                        >
                                                                            <ExternalLink size={16} />
                                                                        </a>
                                                                        <button
                                                                            type="button"
                                                                            className="btn-preview-icon"
                                                                            title={capturingCases[i] ? "Generando PDF limpio..." : "Visualizar (PDF Limpio)"}
                                                                            aria-label={capturingCases[i] ? "Generando PDF limpio..." : "Ver fallo en PDF limpio"}
                                                                            onClick={() => handleCapture(i, safeUrl, c.title)}
                                                                            disabled={capturingCases[i]}
                                                                        >
                                                                            {capturingCases[i] ? <Loader2 size={16} className="spin-animation" /> : <Eye size={16} />}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            // Fallback for old history items (String)
                                            results.cases
                                        )}
                                    </div>
                                </section>

                                {results.calculation && results.calculation.length > 5 && (
                                    <section className="result-card glass-card calculation">
                                        <h3>Liquidacion Estimada</h3>
                                        <div className="content">{renderContent(results.calculation)}</div>
                                    </section>
                                )}

                                {results.evidence && results.evidence.length > 5 && (
                                    <section className="result-card glass-card evidence">
                                        <h3>Puntos de Prueba (Sugeridos)</h3>
                                        <div className="content">{renderContent(results.evidence)}</div>
                                    </section>
                                )}

                                {results.strategy && results.strategy.length > 5 && (
                                    <section className="result-card glass-card strategy">
                                        <h3>Sugerencia de Estrategia</h3>
                                        <div className="content">{renderContent(results.strategy)}</div>
                                    </section>
                                )}

                                {results.links && results.links.length > 0 && (
                                    <section className="result-card links">
                                        <h3>Recursos y Enlaces Utiles</h3>
                                        <div className="links-grid">
                                            {results.links.map((link, idx) => {
                                                // Fix malformed URLs
                                                let safeUrl = link.url;
                                                if (safeUrl.includes('://') && !safeUrl.startsWith('http')) {
                                                    safeUrl = safeUrl.substring(safeUrl.lastIndexOf('http'));
                                                } else if (!safeUrl.startsWith('http')) {
                                                    safeUrl = `https://${safeUrl}`;
                                                }
                                                return (
                                                    <div key={idx} className="link-wrapper">
                                                        <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="link-item">
                                                            {link.title} {'->'}
                                                        </a>

                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}



                        {activeTab === 'jurisprudencia' && jurisprudenciaMode === 'ia' && !results && !loading && (
                            <div className="empty-state">
                                <p>Escribi tu consulta legal y el sistema te ayudara a optimizarla automaticamente.</p>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* Quota limit modal - credit packs */}
            {quotaModalOpen && (
                <div className="quota-modal-overlay" onClick={() => { setQuotaModalOpen(false); setQuotaExhausted(false); }}>
                    <div className="quota-modal-card quota-modal-packs" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="quota-modal-title">
                        <div className="quota-icon-circle">
                            <span className="quota-icon-emoji">{quotaExhausted ? '!' : '+'}</span>
                        </div>
                        <h3 className="quota-title" id="quota-modal-title">
                            {quotaExhausted ? 'Búsquedas Agotadas' : 'Comprar Búsquedas Extra'}
                        </h3>
                        <p className="quota-desc">
                            {quotaExhausted
                                ? `Usaste tus ${getPlanLimit(userProfile?.plan_tier, 'research_reports')} búsquedas del mes. Cargá un pack para seguir investigando.`
                                : 'Los créditos extra no vencen al fin del mes. Se acumulan con tu cuota mensual.'
                            }
                        </p>

                        {!canBuyExtraResearchCredits ? (
                            <div className="credits-no-sub">
                                <p>Los créditos extra son exclusivos para suscriptores del Plan Profesional.</p>
                                <button
                                    type="button"
                                    className="btn-quota-pro"
                                    onClick={() => window.location.href = '/dashboard/settings?tab=billing'}
                                >
                                    Ver Plan Profesional
                                </button>
                            </div>
                        ) : null}

                        {canBuyExtraResearchCredits && (
                            <div className="credit-packs-grid">
                                {[
                                    { id: 'pack_10', credits: 10, price: '7.500', badge: null },
                                    { id: 'pack_25', credits: 25, price: '15.000', badge: 'Popular' },
                                    { id: 'pack_50', credits: 50, price: '25.000', badge: 'Mejor valor' },
                                ].map(pack => (
                                    <button
                                        type="button"
                                        key={pack.id}
                                        className={`credit-pack-card ${buyingPack === pack.id ? 'loading' : ''}`}
                                        disabled={!!buyingPack}
                                        onClick={async () => {
                                            setBuyingPack(pack.id);
                                            try {
                                                const { data: { session: creditsSession } } = await supabase.auth.getSession();
                                                const creditsToken = creditsSession?.access_token;
                                                const res = await fetch('/api/mp/credits/create', {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        ...(creditsToken && { 'Authorization': `Bearer ${creditsToken}` }),
                                                    },
                                                    body: JSON.stringify({ pack_id: pack.id }),
                                                });
                                                const data = await res.json();
                                                if (data.init_point) {
                                                    window.open(data.init_point, '_blank', 'noopener,noreferrer');
                                                } else {
                                                    alert('Error al iniciar el pago. Intentá de nuevo.');
                                                }
                                            } catch {
                                                alert('Error de conexión. Intentá de nuevo.');
                                            } finally {
                                                setBuyingPack(null);
                                            }
                                        }}
                                    >
                                        {pack.badge && (
                                            <span className="pack-badge">{pack.badge}</span>
                                        )}
                                        <span className="pack-credits">{pack.credits}</span>
                                        <span className="pack-label">búsquedas</span>
                                        <span className="pack-price">$ {pack.price} ARS</span>
                                        {buyingPack === pack.id && (
                                            <Loader2 size={16} className="spin-animation pack-spinner" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {canBuyExtraResearchCredits && (
                            <p className="quota-reset-note">
                                Los créditos extra no vencen. Se acumulan con tu cuota mensual.
                            </p>
                        )}
                        <div className="quota-actions">
                            <button
                                type="button"
                                onClick={() => setQuotaModalOpen(false)}
                                className="btn-quota-cancel"
                            >
                                Ahora no
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QUERY ENHANCEMENT MODAL */}
            {enhancementModal && (
                <div className="quota-modal-overlay" onClick={() => setEnhancementModal(null)}>
                    <div className="enhancement-modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="enhancement-modal-title">
                        <button
                            type="button"
                            className="modal-close-btn"
                            onClick={() => setEnhancementModal(null)}
                            aria-label="Cerrar modal"
                        >
                            x
                        </button>
                        <div className="enhancement-icon-circle">
                            <Sparkles size={32} className="text-amber-400" />
                        </div>
                        <h3 className="enhancement-title" id="enhancement-modal-title">Mejora de Búsqueda Detectada</h3>

                        <div className="enhancement-quality-badge">
                            <AlertCircle size={16} />
                            <span>Calidad de búsqueda: {enhancementModal.quality.level === 'POOR' ? 'Baja' : 'Mejorable'} ({enhancementModal.quality.score}/100)</span>
                        </div>

                        {enhancementModal.quality.issues.length > 0 && (
                            <div className="enhancement-issues">
                                <p className="enhancement-section-title">Problemas detectados:</p>
                                <ul>
                                    {enhancementModal.quality.issues.map((issue, i) => (
                                        <li key={i}>{issue}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="enhancement-comparison">
                            <div className="enhancement-query original">
                                <label>Tu búsqueda:</label>
                                <div className="query-text">{enhancementModal.original}</div>
                            </div>
                            <div className="enhancement-arrow">-&gt;</div>
                            <div className="enhancement-query enhanced">
                                <label>Búsqueda mejorada:</label>
                                <div className="query-text">{enhancementModal.enhanced}</div>
                            </div>
                        </div>

                        {enhancementModal.changes && enhancementModal.changes.length > 0 && (
                            <div className="enhancement-changes">
                                <p className="enhancement-section-title">Mejoras aplicadas:</p>
                                <ul>
                                    {enhancementModal.changes.map((change, i) => (
                                        <li key={i}>- {change}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="enhancement-actions">
                            <button
                                type="button"
                                className="btn-enhancement-accept"
                                onClick={() => {
                                    setQuery(enhancementModal.enhanced);
                                    setEnhancementModal(null);
                                    handleSearch(null, enhancementModal.enhanced);
                                }}
                            >
                                <TrendingUp size={16} />
                                Usar búsqueda mejorada
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setEnhancementModal(null);
                                    handleSearch(null, enhancementModal.original);
                                }}
                                className="btn-enhancement-original"
                            >
                                Usar búsqueda original
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REFORMULATION SUGGESTIONS MODAL */}
            {reformulationModal && (
                <div className="quota-modal-overlay" onClick={() => setReformulationModal(null)}>
                    <div className="enhancement-modal-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="reformulation-modal-title">
                        <button
                            type="button"
                            className="modal-close-btn"
                            onClick={() => setReformulationModal(null)}
                            aria-label="Cerrar modal"
                        >
                            x
                        </button>
                        <div className="enhancement-icon-circle">
                            <AlertCircle size={32} className="text-orange-400" />
                        </div>
                        <h3 className="enhancement-title" id="reformulation-modal-title">Resultados Limitados</h3>

                        <p className="reformulation-desc">
                            La búsqueda "{reformulationModal.original}" obtuvo resultados de calidad limitada (score promedio: {reformulationModal.avgScore}/100).
                        </p>

                        <p className="reformulation-desc">
                            Probá con alguna de estas búsquedas alternativas:
                        </p>

                        <div className="reformulation-alternatives">
                            {reformulationModal.alternatives.map((alt, i) => (
                                <button
                                    type="button"
                                    key={i}
                                    className="reformulation-option"
                                    onClick={() => {
                                        setQuery(alt.query);
                                        setReformulationModal(null);
                                        handleSearch(null, alt.query);
                                    }}
                                >
                                    <div className="reformulation-query">{alt.query}</div>
                                    <div className="reformulation-reason">{alt.reason}</div>
                                </button>
                            ))}
                        </div>

                        <div className="enhancement-actions">
                            <button
                                type="button"
                                onClick={() => setReformulationModal(null)}
                                className="btn-enhancement-original"
                            >
                                Mantener resultados actuales
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


