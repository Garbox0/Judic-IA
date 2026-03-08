import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// ── Clientes ──────────────────────────────────────────────────────────────────
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AGENT_KEY   = process.env.AGENT_API_KEY || 'judicia-agent-2026';
const SCRAPER_URL = process.env.SCRAPER_URL   || 'http://judicia-scraper.local:3100';
const SCRAPER_KEY = process.env.SCRAPER_SECRET || 'Cthulhu_Scraper_2025_Secret!';
const CAPTURE_URL = process.env.CAPTURE_SERVICE_URL || 'https://archivos.judic-ia.com';
const CAPTURE_KEY = process.env.CAPTURE_API_KEY     || 'judicia-capture-2026';
const HISTORY_LIMIT = 8; // mensajes a recordar por conversación

// ── Herramientas de Claude ────────────────────────────────────────────────────
const TOOLS = [
    {
        name: 'buscar_expedientes_pjn',
        description: 'Busca expedientes en el PJN (Poder Judicial de la Nación). Úsalo cuando el usuario mencione un número de expediente (ej: "1234/2023"), el nombre de una parte, o quiera buscar en el PJN/justicia federal.',
        input_schema: {
            type: 'object',
            properties: {
                tipo: { type: 'string', enum: ['expediente', 'parte'], description: 'Buscar por número de expediente o por nombre de parte' },
                numero: { type: 'string', description: 'Número del expediente (sin año). Requerido si tipo=expediente' },
                anio: { type: 'string', description: 'Año del expediente (ej: 2023). Requerido si tipo=expediente' },
                nombre: { type: 'string', description: 'Nombre de la parte a buscar. Requerido si tipo=parte' },
                fuero: { type: 'string', description: 'Fuero/jurisdicción opcional (ej: Civil, Laboral, Comercial, Penal)' },
            },
            required: ['tipo'],
        },
    },
    {
        name: 'boletin_oficial',
        description: 'Consulta el Boletín Oficial de la República Argentina. Úsalo cuando pregunten sobre leyes nuevas, decretos, resoluciones publicadas, o "qué salió hoy en el boletín".',
        input_schema: {
            type: 'object',
            properties: {
                seccion: { type: 'string', enum: ['primera', 'segunda', 'tercera', 'cuarta'], description: 'Sección del BO. Primera: leyes/decretos/resoluciones. Segunda: sociedades. Tercera: contrataciones.' },
                busqueda: { type: 'string', description: 'Término de búsqueda opcional para filtrar resultados' },
            },
        },
    },
    {
        name: 'texto_norma',
        description: 'Obtiene el texto completo de una ley, decreto, resolución u otra norma desde InfoLeg. Úsalo cuando pidan el contenido de una norma específica.',
        input_schema: {
            type: 'object',
            properties: {
                norma: { type: 'string', description: 'Identificador de la norma. Ej: "Ley 27802", "Decreto 135/2026", "Resolución 123/2026"' },
            },
            required: ['norma'],
        },
    },
    {
        name: 'mis_expedientes',
        description: 'Lista los expedientes/causas que el usuario tiene registrados en Judic-IA. Úsalo cuando pregunten "mis expedientes", "mis causas", "qué casos tengo".',
        input_schema: {
            type: 'object',
            properties: {
                estado: { type: 'string', enum: ['activos', 'archivados', 'todos'], description: 'Filtrar por estado. Por defecto muestra activos.' },
            },
        },
    },
    {
        name: 'mis_plazos',
        description: 'Muestra los plazos y vencimientos próximos del usuario. Úsalo cuando pregunten por fechas, vencimientos, "qué tengo esta semana", deadlines.',
        input_schema: {
            type: 'object',
            properties: {
                dias: { type: 'number', description: 'Cuántos días hacia adelante mostrar. Por defecto 14.' },
            },
        },
    },
    {
        name: 'mis_alertas',
        description: 'Lista las alertas activas de monitoreo de expedientes del usuario.',
        input_schema: { type: 'object', properties: {} },
    },
    {
        name: 'crear_alerta',
        description: 'Crea una nueva alerta para monitorear un expediente o parte en un portal. Consume 1 crédito de alerta. Siempre confirmá con el usuario antes de crear.',
        input_schema: {
            type: 'object',
            properties: {
                consulta: { type: 'string', description: 'Número de expediente (ej: 12345/2023) o nombre de parte a monitorear' },
                portal: { type: 'string', enum: ['PJN', 'SCBA', 'CSJN_SORTEOS'], description: 'Portal donde monitorear' },
            },
            required: ['consulta', 'portal'],
        },
    },
];

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
                if (!res.ok) throw new Error(`Scraper error ${res.status}`);
                const data = await res.json();
                const casos = data.casos || data.results || [];
                if (!casos.length) return { ok: true, resultado: 'No se encontraron expedientes.' };

                const top = casos.slice(0, 6);
                return {
                    ok: true,
                    total: casos.length,
                    expedientes: top.map(c => ({
                        caratula: c.caratula || c.titulo,
                        numero: c.numero || c.nroExpediente,
                        fuero: c.fuero || c.jurisdiccion,
                        estado: c.estado,
                        ultimaActuacion: c.ultimaActuacion || c.ultimoMovimiento,
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

                // Agrupar por rubro, mostrar top 10
                const top = items.slice(0, 12);
                const grouped = {};
                for (const it of top) {
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
                // Extraer texto plano del HTML (sin tags) y limitar
                const texto = (data.html || '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 8000);
                return { ok: true, titulo: data.titulo, url: data.url, texto };
            }

            case 'mis_expedientes': {
                const estado = input.estado || 'activos';
                let query = supabase
                    .from('cases')
                    .select('id, title, caratula, status, created_at, pjn_data')
                    .eq('assigned_to', userId)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (estado === 'activos') query = query.neq('status', 'archived');
                else if (estado === 'archivados') query = query.eq('status', 'archived');

                const { data, error } = await query;
                if (error) throw error;
                if (!data?.length) return { ok: true, resultado: 'No tenés expedientes registrados.' };

                return {
                    ok: true,
                    total: data.length,
                    expedientes: data.map(c => ({
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
                    plazos: data.map(d => {
                        const dias_restantes = Math.ceil((new Date(d.due_date) - new Date()) / 86400000);
                        return {
                            titulo: d.title,
                            descripcion: d.description,
                            fecha: d.due_date,
                            dias_restantes,
                            prioridad: d.priority,
                            cliente: d.inquiries?.contact_name,
                        };
                    }),
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
                // Verificar créditos
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('alert_credits, plan_tier')
                    .eq('id', userId)
                    .single();

                if (!profile || (profile.alert_credits ?? 0) < 1) {
                    return { ok: false, error: 'Sin créditos de alerta disponibles. Cargá créditos desde el panel.' };
                }

                const queryType = /\d+\/\d{4}/.test(input.consulta) ? 'por_expediente' : 'por_parte';

                // Consumir crédito
                const { error: creditErr } = await supabase.rpc('consume_alert_credit', { p_user_id: userId });
                if (creditErr) throw creditErr;

                // Crear alerta
                const { data: alerta, error: alertErr } = await supabase
                    .from('case_alerts')
                    .insert({
                        user_id: userId,
                        query: input.consulta,
                        portal: input.portal,
                        query_type: queryType,
                        status: 'active',
                    })
                    .select('id')
                    .single();

                if (alertErr) {
                    // Reembolsar crédito si falla
                    await supabase.rpc('add_alert_credits', { p_user_id: userId, p_credits: 1 });
                    throw alertErr;
                }

                return { ok: true, alerta_id: alerta.id, consulta: input.consulta, portal: input.portal };
            }

            default:
                return { ok: false, error: `Herramienta desconocida: ${name}` };
        }
    } catch (err) {
        console.error(`[Agent tool ${name}]`, err.message);
        return { ok: false, error: err.message };
    }
}

// ── Historia de conversación ──────────────────────────────────────────────────

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
    // Limpiar histórico antiguo (mantener últimos 20)
    const { data: old } = await supabase
        .from('whatsapp_history')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(20, 200);
    if (old?.length) {
        await supabase.from('whatsapp_history').delete().in('id', old.map(r => r.id));
    }
}

// ── Sistema de agente ─────────────────────────────────────────────────────────

function buildSystemPrompt(profile) {
    const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `Sos *Judic-IA*, el asistente legal inteligente de ${profile.full_name || 'un abogado'}.
Hoy es ${today}.

*Tu misión:* Ayudar al abogado con sus consultas legales de forma rápida, precisa y útil.

*Herramientas disponibles:*
- Buscar expedientes en el PJN (por número o por parte)
- Consultar el Boletín Oficial (leyes, decretos, resoluciones de hoy)
- Obtener texto completo de normas vía InfoLeg
- Ver sus expedientes registrados en Judic-IA
- Ver sus plazos y vencimientos próximos
- Ver y crear alertas de monitoreo de expedientes

*Reglas de formato para WhatsApp:*
- Usá *negrita* para títulos y datos importantes
- Usá listas con • o números para varios items
- Emojis con moderación para claridad visual (📋 expedientes, ⚖️ legal, 📰 boletín, ⏰ plazos, 🔔 alertas)
- Respuestas concisas — no más de 15 líneas salvo que pidan el texto completo de una norma
- Nunca uses HTML ni markdown de Reddit, solo formato WhatsApp

*Restricciones:*
- No des asesoramiento legal definitivo, recordá que sos un asistente de información
- Para crear alertas, SIEMPRE confirmá antes de ejecutar
- Si no encontrás información, decilo claramente y sugerí alternativas

*Plan del usuario:* ${profile.plan_tier || 'starter'}`;
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(request) {
    // Autenticación server-to-server
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

    const userId = profile.id;

    // Verificar plan activo
    const planActivo = ['professional', 'enterprise', 'enterprise_s', 'enterprise_m', 'enterprise_l', 'enterprise_xl', 'enterprise_member'].includes(profile.plan_tier)
        || (profile.plan_tier === 'trial' && profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date());

    if (!planActivo) {
        return NextResponse.json({
            response: `⚠️ Tu plan no está activo. Activá tu suscripción en *judic-ia.com/dashboard/settings* para usar el agente.`,
        });
    }

    // Cargar historial
    const history = await getHistory(userId);

    // Guardar mensaje del usuario
    await saveHistory(userId, 'user', message);

    // Construir mensajes para Claude
    const messages = [
        ...history,
        { role: 'user', content: message },
    ];

    // Llamar a Claude con herramientas (agentic loop)
    let response = '';
    const MAX_LOOPS = 4;
    let loopMessages = [...messages];

    for (let i = 0; i < MAX_LOOPS; i++) {
        const result = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            system: buildSystemPrompt(profile),
            tools: TOOLS,
            messages: loopMessages,
        });

        if (result.stop_reason === 'end_turn') {
            response = result.content
                .filter(b => b.type === 'text')
                .map(b => b.text)
                .join('\n')
                .trim();
            break;
        }

        if (result.stop_reason === 'tool_use') {
            const toolUseBlocks = result.content.filter(b => b.type === 'tool_use');
            loopMessages.push({ role: 'assistant', content: result.content });

            // Ejecutar todas las herramientas (en paralelo si hay varias)
            const toolResults = await Promise.all(
                toolUseBlocks.map(async (tc) => {
                    console.log(`[Agent] tool: ${tc.name}`, JSON.stringify(tc.input).substring(0, 100));
                    const toolResult = await execTool(tc.name, tc.input, userId);
                    return {
                        type: 'tool_result',
                        tool_use_id: tc.id,
                        content: JSON.stringify(toolResult),
                    };
                })
            );

            loopMessages.push({ role: 'user', content: toolResults });
            continue;
        }

        // Fallback
        response = result.content
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('\n')
            .trim();
        break;
    }

    if (!response) {
        response = 'Lo siento, no pude procesar tu consulta. Intentá de nuevo.';
    }

    // Guardar respuesta del asistente
    await saveHistory(userId, 'assistant', response);

    return NextResponse.json({ response, userId });
}
