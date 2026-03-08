import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// ── Clientes ──────────────────────────────────────────────────────────────────
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AGENT_KEY   = process.env.AGENT_API_KEY   || 'judicia-agent-2026';
const SCRAPER_URL = process.env.SCRAPER_URL      || 'http://judicia-scraper.local:3100';
const SCRAPER_KEY = process.env.SCRAPER_SECRET   || 'Cthulhu_Scraper_2025_Secret!';
const CAPTURE_URL = process.env.CAPTURE_SERVICE_URL || 'https://archivos.judic-ia.com';
const CAPTURE_KEY = process.env.CAPTURE_API_KEY  || 'judicia-capture-2026';
const HISTORY_LIMIT = 10;

// Días no hábiles judiciales fijos (Argentina)
const FERIADOS_FIJOS = ['01-01','02-24','02-25','03-24','04-02','05-01','05-25','06-20','07-09','08-17','10-12','11-02','11-05','12-08','12-25'];

// ── Herramientas ──────────────────────────────────────────────────────────────
const TOOLS = [
    {
        name: 'buscar_expedientes_pjn',
        description: 'Busca expedientes en el PJN (Poder Judicial de la Nación) por número o nombre de parte. Úsalo para cualquier consulta sobre expedientes federales.',
        input_schema: {
            type: 'object',
            properties: {
                tipo: { type: 'string', enum: ['expediente', 'parte'] },
                numero: { type: 'string', description: 'Número sin año (solo si tipo=expediente)' },
                anio: { type: 'string', description: 'Año (solo si tipo=expediente)' },
                nombre: { type: 'string', description: 'Nombre de parte (solo si tipo=parte)' },
                fuero: { type: 'string', description: 'Fuero opcional: Civil, Laboral, Comercial, Penal, etc.' },
            },
            required: ['tipo'],
        },
    },
    {
        name: 'ver_actuaciones_expediente',
        description: 'Obtiene el detalle completo de un expediente del PJN: caratula, estado, y lista de actuaciones/movimientos recientes. Úsalo cuando pregunten por los movimientos o actuaciones de un expediente específico.',
        input_schema: {
            type: 'object',
            properties: {
                numero: { type: 'string', description: 'Número del expediente' },
                anio: { type: 'string', description: 'Año del expediente' },
                fuero: { type: 'string', description: 'Fuero/jurisdicción (opcional pero recomendado)' },
            },
            required: ['numero', 'anio'],
        },
    },
    {
        name: 'boletin_oficial',
        description: 'Consulta las publicaciones del día en el Boletín Oficial de Argentina. Úsalo para leyes nuevas, decretos, resoluciones, o cuando pregunten "qué salió hoy".',
        input_schema: {
            type: 'object',
            properties: {
                seccion: { type: 'string', enum: ['primera', 'segunda', 'tercera', 'cuarta'], description: 'Primera: leyes/decretos. Segunda: sociedades. Tercera: contrataciones.' },
                busqueda: { type: 'string', description: 'Filtro de búsqueda opcional' },
            },
        },
    },
    {
        name: 'texto_norma',
        description: 'Trae el texto completo de una ley, decreto, resolución u otra norma desde InfoLeg. Ideal cuando pidan el articulado o el contenido completo de una norma.',
        input_schema: {
            type: 'object',
            properties: {
                norma: { type: 'string', description: 'Ej: "Ley 20744", "Decreto 135/2026", "Resolución 123/2026"' },
            },
            required: ['norma'],
        },
    },
    {
        name: 'mis_expedientes',
        description: 'Lista los expedientes/causas registrados por el usuario en Judic-IA.',
        input_schema: {
            type: 'object',
            properties: {
                estado: { type: 'string', enum: ['activos', 'archivados', 'todos'] },
                busqueda: { type: 'string', description: 'Filtrar por caratula o título' },
            },
        },
    },
    {
        name: 'mis_plazos',
        description: 'Muestra los plazos y vencimientos próximos del usuario.',
        input_schema: {
            type: 'object',
            properties: {
                dias: { type: 'number', description: 'Días hacia adelante a mostrar (default 14)' },
            },
        },
    },
    {
        name: 'mis_alertas',
        description: 'Lista las alertas de monitoreo de expedientes activas del usuario.',
        input_schema: { type: 'object', properties: {} },
    },
    {
        name: 'crear_alerta',
        description: 'Crea una nueva alerta para monitorear un expediente o parte. Siempre confirmá con el usuario antes de crear. Consume 1 crédito.',
        input_schema: {
            type: 'object',
            properties: {
                consulta: { type: 'string', description: 'Nro expediente (12345/2023) o nombre de parte' },
                portal: { type: 'string', enum: ['PJN', 'SCBA', 'CSJN_SORTEOS'] },
            },
            required: ['consulta', 'portal'],
        },
    },
    {
        name: 'calcular_interes',
        description: 'Calcula intereses sobre un capital para un período. Usa Tasa Activa BNA (la más usada en litigios laborales y civiles) u otras tasas. Ideal para liquidaciones.',
        input_schema: {
            type: 'object',
            properties: {
                capital: { type: 'number', description: 'Monto en pesos' },
                desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
                hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD (default: hoy)' },
                tasa: { type: 'string', enum: ['activa_bna', 'pasiva_bna', 'cer', 'uva'], description: 'Tipo de tasa (default: activa_bna)' },
            },
            required: ['capital', 'desde'],
        },
    },
    {
        name: 'calcular_indemnizacion',
        description: 'Calcula la indemnización laboral (LCT) ante un despido sin causa. Incluye indemnización art. 245, preaviso, integración mes de despido y SAC proporcional.',
        input_schema: {
            type: 'object',
            properties: {
                sueldo: { type: 'number', description: 'Última remuneración mensual bruta' },
                fecha_ingreso: { type: 'string', description: 'Fecha de ingreso YYYY-MM-DD' },
                fecha_egreso: { type: 'string', description: 'Fecha de egreso YYYY-MM-DD (default: hoy)' },
                incluir_preaviso: { type: 'boolean', description: 'Incluir indemnización por omisión de preaviso (default: true)' },
            },
            required: ['sueldo', 'fecha_ingreso'],
        },
    },
    {
        name: 'calcular_plazo',
        description: 'Calcula vencimientos de plazos judiciales (días hábiles o corridos) desde una fecha de notificación.',
        input_schema: {
            type: 'object',
            properties: {
                fecha_inicio: { type: 'string', description: 'Fecha de inicio/notificación YYYY-MM-DD' },
                dias: { type: 'number', description: 'Cantidad de días del plazo' },
                tipo: { type: 'string', enum: ['habiles', 'corridos'], description: 'Tipo de días (default: habiles)' },
            },
            required: ['fecha_inicio', 'dias'],
        },
    },
    {
        name: 'resumen_matutino',
        description: 'Genera un resumen del día para el abogado: plazos urgentes, novedades del Boletín Oficial y alertas recientes. Úsalo cuando saluden ("buenos días") o pidan un resumen del día.',
        input_schema: { type: 'object', properties: {} },
    },
];

// ── Helpers matemáticos ───────────────────────────────────────────────────────

function diasEntreFechas(desde, hasta) {
    return Math.floor((new Date(hasta) - new Date(desde)) / 86400000);
}

function esHabilJudicial(fecha) {
    const d = new Date(fecha);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return false;
    const mmdd = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return !FERIADOS_FIJOS.includes(mmdd);
}

function addDiasHabiles(fechaStr, dias) {
    const d = new Date(fechaStr);
    let contador = 0;
    while (contador < dias) {
        d.setDate(d.getDate() + 1);
        if (esHabilJudicial(d)) contador++;
    }
    return d.toISOString().substring(0, 10);
}

// Tasas de interés mensuales aproximadas vigentes (Argentina 2025-2026)
// Fuente: BNA / BCRA — actualizar periódicamente
const TASAS_MENSUALES = {
    activa_bna: 0.0400,   // ~48% anual — Tasa Activa Cartera General BNA
    pasiva_bna: 0.0280,   // ~34% anual — Tasa Pasiva BNA plazo fijo 30d
    cer:        0.0350,   // CER aproximado (variable con inflación)
    uva:        0.0360,   // UVA aproximado (variable con inflación)
};

function calcularInteresCompuesto(capital, desde, hasta, tasa) {
    const dias = diasEntreFechas(desde, hasta);
    const tasaMensual = TASAS_MENSUALES[tasa] || TASAS_MENSUALES.activa_bna;
    const tasaDiaria = tasaMensual / 30;
    const intereses = capital * (Math.pow(1 + tasaDiaria, dias) - 1);
    return { dias, intereses: Math.round(intereses), total: Math.round(capital + intereses) };
}

// ── Ejecución de herramientas ─────────────────────────────────────────────────

async function execTool(name, input, userId) {
    try {
        switch (name) {

            case 'buscar_expedientes_pjn': {
                const body = input.tipo === 'expediente'
                    ? { tab: 'porExpediente', numero: input.numero, anio: input.anio, maxPages: 3 }
                    : { tab: 'porParte', nombre: input.nombre, maxPages: 5 };
                if (input.fuero) body.jurisdictionName = input.fuero;

                const res = await fetch(`${SCRAPER_URL}/pjn/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-scraper-token': SCRAPER_KEY },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(60000),
                });
                if (!res.ok) throw new Error(`Error scraper ${res.status}`);
                const data = await res.json();
                const casos = data.casos || data.results || [];
                if (!casos.length) return { ok: true, resultado: 'No se encontraron expedientes.' };
                return {
                    ok: true, total: casos.length,
                    expedientes: casos.slice(0, 6).map(c => ({
                        caratula: c.caratula || c.titulo,
                        numero: c.numero || c.nroExpediente,
                        fuero: c.fuero || c.jurisdiccion,
                        estado: c.estado,
                        ultimaActuacion: c.ultimaActuacion || c.ultimoMovimiento,
                    })),
                };
            }

            case 'ver_actuaciones_expediente': {
                const scraperDetalle = SCRAPER_URL.replace('/search', '') + '/pjn/detalle';
                const res = await fetch(scraperDetalle, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-scraper-token': SCRAPER_KEY },
                    body: JSON.stringify({ numero: input.numero, anio: input.anio, jurisdiccion: input.fuero }),
                    signal: AbortSignal.timeout(60000),
                });
                if (!res.ok) throw new Error(`Error scraper detalle ${res.status}`);
                const data = await res.json();
                const actuaciones = (data.actuaciones || []).slice(0, 8);
                return {
                    ok: true,
                    caratula: data.caratula,
                    estado: data.estado,
                    fuero: data.fuero || data.jurisdiccion,
                    total_actuaciones: data.actuaciones?.length || 0,
                    actuaciones: actuaciones.map(a => ({
                        fecha: a.fecha,
                        tipo: a.tipo || a.descripcion,
                        observacion: a.observacion || a.detalle,
                    })),
                };
            }

            case 'boletin_oficial': {
                const sec = input.seccion || 'primera';
                const params = new URLSearchParams({ seccion: sec });
                if (input.busqueda) params.set('q', input.busqueda);
                const res = await fetch(`${CAPTURE_URL}/boletin?${params}`, {
                    headers: { 'x-api-key': CAPTURE_KEY },
                    signal: AbortSignal.timeout(25000),
                });
                if (!res.ok) throw new Error(`BO error ${res.status}`);
                const { items, total } = await res.json();
                if (!items?.length) return { ok: true, resultado: 'No hay publicaciones disponibles.' };
                const grouped = {};
                for (const it of items.slice(0, 15)) {
                    if (!grouped[it.rubro]) grouped[it.rubro] = [];
                    grouped[it.rubro].push(`${it.norma}${it.titulo ? ' — ' + it.titulo : ''}`);
                }
                return { ok: true, seccion: sec, total, grupos: grouped };
            }

            case 'texto_norma': {
                const res = await fetch(`${CAPTURE_URL}/infoleg?q=${encodeURIComponent(input.norma)}`, {
                    headers: { 'x-api-key': CAPTURE_KEY },
                    signal: AbortSignal.timeout(30000),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `InfoLeg error ${res.status}`);
                }
                const data = await res.json();
                const texto = (data.html || '')
                    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                    .substring(0, 10000);
                return { ok: true, titulo: data.titulo, url: data.url, texto };
            }

            case 'mis_expedientes': {
                let query = supabase
                    .from('cases')
                    .select('id, title, caratula, status, created_at, pjn_data')
                    .eq('assigned_to', userId)
                    .order('created_at', { ascending: false })
                    .limit(20);
                const estado = input.estado || 'activos';
                if (estado === 'activos') query = query.neq('status', 'archived');
                else if (estado === 'archivados') query = query.eq('status', 'archived');
                const { data, error } = await query;
                if (error) throw error;
                if (!data?.length) return { ok: true, resultado: 'No tenés expedientes registrados.' };
                let lista = data;
                if (input.busqueda) {
                    const q = input.busqueda.toLowerCase();
                    lista = data.filter(c => (c.caratula || c.title || '').toLowerCase().includes(q));
                }
                return {
                    ok: true, total: lista.length,
                    expedientes: lista.map(c => ({
                        caratula: c.caratula || c.title,
                        estado: c.status,
                        fuero: c.pjn_data?.jurisdiccion,
                        fecha: c.created_at?.substring(0, 10),
                    })),
                };
            }

            case 'mis_plazos': {
                const dias = input.dias || 14;
                const hasta = new Date();
                hasta.setDate(hasta.getDate() + dias);
                const { data, error } = await supabase
                    .from('deadlines')
                    .select('id, title, description, due_date, priority, inquiries(contact_name)')
                    .eq('user_id', userId)
                    .gte('due_date', new Date().toISOString().substring(0, 10))
                    .lte('due_date', hasta.toISOString().substring(0, 10))
                    .order('due_date', { ascending: true });
                if (error) throw error;
                if (!data?.length) return { ok: true, resultado: `No tenés vencimientos en los próximos ${dias} días.` };
                return {
                    ok: true,
                    plazos: data.map(d => ({
                        titulo: d.title,
                        descripcion: d.description,
                        fecha: d.due_date,
                        dias_restantes: Math.ceil((new Date(d.due_date) - new Date()) / 86400000),
                        prioridad: d.priority,
                        cliente: d.inquiries?.contact_name,
                    })),
                };
            }

            case 'mis_alertas': {
                const { data, error } = await supabase
                    .from('case_alerts')
                    .select('id, query, portal, status, created_at, last_checked_at')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(15);
                if (error) throw error;
                if (!data?.length) return { ok: true, resultado: 'No tenés alertas activas.' };
                return {
                    ok: true,
                    alertas: data.map(a => ({
                        consulta: a.query,
                        portal: a.portal,
                        estado: a.status,
                        ultima_revision: a.last_checked_at?.substring(0, 10),
                    })),
                };
            }

            case 'crear_alerta': {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('alert_credits, plan_tier')
                    .eq('id', userId).single();
                if (!profile || (profile.alert_credits ?? 0) < 1) {
                    return { ok: false, error: 'Sin créditos de alerta. Cargá desde judic-ia.com/dashboard/settings' };
                }
                const queryType = /\d+\/\d{4}/.test(input.consulta) ? 'por_expediente' : 'por_parte';
                const { error: creditErr } = await supabase.rpc('consume_alert_credit', { p_user_id: userId });
                if (creditErr) throw creditErr;
                const { data: alerta, error: alertErr } = await supabase
                    .from('case_alerts')
                    .insert({ user_id: userId, query: input.consulta, portal: input.portal, query_type: queryType, status: 'active' })
                    .select('id').single();
                if (alertErr) {
                    await supabase.rpc('add_alert_credits', { p_user_id: userId, p_credits: 1 });
                    throw alertErr;
                }
                return { ok: true, alerta_id: alerta.id, consulta: input.consulta, portal: input.portal };
            }

            case 'calcular_interes': {
                const hasta = input.hasta || new Date().toISOString().substring(0, 10);
                const tasa = input.tasa || 'activa_bna';
                const result = calcularInteresCompuesto(input.capital, input.desde, hasta, tasa);
                const tasaLabel = { activa_bna: 'Tasa Activa BNA', pasiva_bna: 'Tasa Pasiva BNA', cer: 'CER', uva: 'UVA' };
                return {
                    ok: true,
                    capital: input.capital,
                    desde: input.desde,
                    hasta,
                    tasa: tasaLabel[tasa] || tasa,
                    tasa_mensual_aprox: `${(TASAS_MENSUALES[tasa] * 100).toFixed(2)}%`,
                    dias: result.dias,
                    intereses: result.intereses,
                    total: result.total,
                    nota: 'Cálculo estimado. Verificar con tasas oficiales actualizadas.',
                };
            }

            case 'calcular_indemnizacion': {
                const fechaEgreso = input.fecha_egreso || new Date().toISOString().substring(0, 10);
                const ingreso = new Date(input.fecha_ingreso);
                const egreso = new Date(fechaEgreso);
                const mesesTrabajados = (egreso.getFullYear() - ingreso.getFullYear()) * 12 + (egreso.getMonth() - ingreso.getMonth());
                const aniosTrabajados = Math.max(1, Math.ceil(mesesTrabajados / 12));
                const sueldo = input.sueldo;

                // Art. 245 LCT — 1 mes de sueldo por año (mín 2 meses)
                const indemBase = Math.max(sueldo * 2, sueldo * aniosTrabajados);

                // Preaviso (art. 231 LCT)
                let preaviso = 0;
                if (input.incluir_preaviso !== false) {
                    if (mesesTrabajados < 3) preaviso = sueldo * 0.5;
                    else if (mesesTrabajados < 12) preaviso = sueldo;
                    else preaviso = sueldo * 2;
                }

                // Integración mes de despido
                const diasMes = 30;
                const diaEgreso = egreso.getDate();
                const diasRestantesMes = diasMes - diaEgreso;
                const integracion = (sueldo / diasMes) * diasRestantesMes;

                // SAC proporcional (sobre preaviso e integración)
                const sacProporcional = (preaviso + integracion) / 12;

                const total = indemBase + preaviso + integracion + sacProporcional;

                return {
                    ok: true,
                    antiguedad: `${Math.floor(mesesTrabajados / 12)} años y ${mesesTrabajados % 12} meses`,
                    sueldo,
                    indemnizacion_art245: Math.round(indemBase),
                    preaviso: Math.round(preaviso),
                    integracion_mes_despido: Math.round(integracion),
                    sac_proporcional: Math.round(sacProporcional),
                    total: Math.round(total),
                    nota: 'Cálculo base LCT. No incluye rubros adicionales (vacaciones proporcionales, horas extras, etc.). Verificar tope salarial SMVM.',
                };
            }

            case 'calcular_plazo': {
                const tipo = input.tipo || 'habiles';
                let fechaVencimiento;
                if (tipo === 'habiles') {
                    fechaVencimiento = addDiasHabiles(input.fecha_inicio, input.dias);
                } else {
                    const d = new Date(input.fecha_inicio);
                    d.setDate(d.getDate() + input.dias);
                    fechaVencimiento = d.toISOString().substring(0, 10);
                }
                const esHabil = esHabilJudicial(new Date(fechaVencimiento));
                // Si cae en no hábil, mover al siguiente hábil
                if (!esHabil) {
                    fechaVencimiento = addDiasHabiles(fechaVencimiento, 0);
                }
                const diasHastaVto = diasEntreFechas(new Date().toISOString().substring(0, 10), fechaVencimiento);
                return {
                    ok: true,
                    fecha_inicio: input.fecha_inicio,
                    dias: input.dias,
                    tipo,
                    fecha_vencimiento: fechaVencimiento,
                    dias_hasta_vencimiento: diasHastaVto,
                    urgente: diasHastaVto <= 3,
                    nota: 'Feriados judiciales nacionales fijos incluidos. Verificar feriados locales y acordadas de feria.',
                };
            }

            case 'resumen_matutino': {
                // Ejecutar en paralelo: plazos urgentes + BO primera + alertas recientes
                const hoy = new Date().toISOString().substring(0, 10);
                const en7dias = new Date();
                en7dias.setDate(en7dias.getDate() + 7);

                const [plazosRes, alertasRes, boRes, causasRes] = await Promise.allSettled([
                    supabase.from('deadlines').select('title, due_date, priority').eq('user_id', userId)
                        .gte('due_date', hoy).lte('due_date', en7dias.toISOString().substring(0, 10)).order('due_date').limit(5),
                    supabase.from('case_alerts').select('query, portal, last_checked_at').eq('user_id', userId).eq('status', 'active').limit(5),
                    fetch(`${CAPTURE_URL}/boletin?seccion=primera`, { headers: { 'x-api-key': CAPTURE_KEY }, signal: AbortSignal.timeout(15000) }).then(r => r.json()).catch(() => ({ items: [] })),
                    supabase.from('cases').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).neq('status', 'archived'),
                ]);

                const plazos = plazosRes.status === 'fulfilled' ? (plazosRes.value.data || []) : [];
                const alertas = alertasRes.status === 'fulfilled' ? (alertasRes.value.data || []) : [];
                const boItems = boRes.status === 'fulfilled' ? (boRes.value.items || []).slice(0, 5) : [];
                const totalCausas = causasRes.status === 'fulfilled' ? (causasRes.value.count || 0) : 0;

                return {
                    ok: true,
                    fecha: new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
                    expedientes_activos: totalCausas,
                    plazos_urgentes: plazos.map(p => ({
                        titulo: p.title,
                        fecha: p.due_date,
                        dias_restantes: Math.ceil((new Date(p.due_date) - new Date()) / 86400000),
                        prioridad: p.priority,
                    })),
                    alertas_activas: alertas.length,
                    boletin_hoy: boItems.map(i => `${i.norma}${i.titulo ? ' — ' + i.titulo : ''}`),
                };
            }

            default:
                return { ok: false, error: `Herramienta desconocida: ${name}` };
        }
    } catch (err) {
        console.error(`[Agent tool ${name}]`, err.message);
        return { ok: false, error: err.message };
    }
}

// ── Historia ──────────────────────────────────────────────────────────────────

async function getHistory(userId) {
    const { data } = await supabase
        .from('whatsapp_history')
        .select('role, content')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);
    return (data || []).reverse();
}

async function saveHistory(userId, role, content) {
    await supabase.from('whatsapp_history').insert({ user_id: userId, role, content });
    // Limpiar mensajes viejos
    const { data: old } = await supabase
        .from('whatsapp_history').select('id')
        .eq('user_id', userId).order('created_at', { ascending: false }).range(20, 200);
    if (old?.length) await supabase.from('whatsapp_history').delete().in('id', old.map(r => r.id));
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(profile) {
    const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `Sos *Judic-IA*, el asistente legal inteligente de ${profile.full_name || 'un abogado argentino'}.
Hoy es ${today}.

*Podés ayudar con:*
🔍 Búsqueda de expedientes en el PJN (por número o parte)
📋 Actuaciones y movimientos de expedientes
📰 Boletín Oficial del día (leyes, decretos, resoluciones)
📖 Texto completo de normas vía InfoLeg
⚖️ Cálculo de intereses (Tasa Activa BNA, Pasiva, CER, UVA)
👔 Liquidación laboral (indemnización LCT art. 245)
📅 Cálculo de plazos judiciales (hábiles o corridos)
🔔 Alertas de monitoreo de expedientes
📁 Expedientes y plazos propios del usuario

*Formato para WhatsApp:*
- Usá *negrita* para datos importantes
- Listas con números o viñetas (•) para varios items
- Emojis con moderación y coherencia
- Respuestas concisas (máx 20 líneas), salvo texto completo de normas
- Para cálculos, mostrá siempre el detalle y el total
- Nunca uses HTML ni markdown de GitHub

*Importante:*
- No des asesoramiento legal definitivo — sos un asistente de información
- Para crear alertas, confirmá siempre antes de ejecutar
- Los cálculos son estimaciones — indicalo brevemente al final
- Si el usuario saluda, respondé amistosamente y ofrecé el resumen del día

*Plan:* ${profile.plan_tier || 'starter'} | *Créditos alerta:* ${profile.alert_credits ?? 0}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request) {
    const agentKey = request.headers.get('x-agent-key');
    if (agentKey !== AGENT_KEY) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { phone, message, senderName } = await request.json();
    if (!phone || !message) {
        return NextResponse.json({ error: 'phone y message requeridos' }, { status: 400 });
    }

    // Buscar usuario por número de WhatsApp
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, plan_tier, alert_credits, subscription_status, trial_ends_at')
        .eq('whatsapp_phone', phone)
        .maybeSingle();

    if (!profile) {
        return NextResponse.json({
            response: `⚠️ Tu número no está vinculado a ninguna cuenta de Judic-IA.\n\nIngresá a *judic-ia.com/dashboard/whatsapp* y vinculá tu número para usar el asistente.`,
        });
    }

    const planActivo = [
        'professional', 'enterprise', 'enterprise_s', 'enterprise_m',
        'enterprise_l', 'enterprise_xl', 'enterprise_member'
    ].includes(profile.plan_tier)
        || (profile.plan_tier === 'trial' && profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date());

    if (!planActivo) {
        return NextResponse.json({
            response: `⚠️ Tu plan no está activo. Activalo en *judic-ia.com/dashboard/settings*`,
        });
    }

    await saveHistory(profile.id, 'user', message);
    const history = await getHistory(profile.id);
    const messages = [...history.slice(0, -1), { role: 'user', content: message }];

    let response = '';
    let loopMessages = messages;

    for (let i = 0; i < 5; i++) {
        const result = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            system: buildSystemPrompt(profile),
            tools: TOOLS,
            messages: loopMessages,
        });

        if (result.stop_reason === 'end_turn') {
            response = result.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
            break;
        }

        if (result.stop_reason === 'tool_use') {
            const toolUseBlocks = result.content.filter(b => b.type === 'tool_use');
            loopMessages = [...loopMessages, { role: 'assistant', content: result.content }];
            const toolResults = await Promise.all(
                toolUseBlocks.map(async tc => {
                    console.log(`[Agent] ${tc.name}`, JSON.stringify(tc.input).substring(0, 120));
                    const res = await execTool(tc.name, tc.input, profile.id);
                    return { type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(res) };
                })
            );
            loopMessages = [...loopMessages, { role: 'user', content: toolResults }];
            continue;
        }

        response = result.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        break;
    }

    if (!response) response = 'No pude procesar tu consulta. Intentá de nuevo.';
    await saveHistory(profile.id, 'assistant', response);

    return NextResponse.json({ response, userId: profile.id });
}
