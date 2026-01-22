export const demoProfile = {
    id: "demo-lawyer-id",
    full_name: "Dr. Martínez",
    email: "demo@judicia.com",
    plan_tier: "professional",
    avatar_url: null
};

export const demoStats = {
    clients: 12,
    deadlines: 3
};

export const demoClients = [
    {
        id: "demo-c1",
        created_at: new Date().toISOString(),
        contact_name: "Juan Pérez",
        contact_phone: "+54 9 11 1234-5678",
        contact_email: "juan.perez@email.com",
        case_type: "Despido Injustificado",
        status: "pending",
        ai_summary: "El cliente relata que fue despedido sin causa hace 2 semanas. Trabajaba en blanco desde 2018. Reclama indemnización y liquidación final.",
        is_case: false
    },
    {
        id: "demo-c2",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        contact_name: "María González",
        contact_phone: "+54 9 11 9876-5432",
        contact_email: "maria.g@email.com",
        case_type: "Divorcio",
        status: "pending",
        ai_summary: "Consulta por divorcio vincular. Hay bienes en común (un departamento y un auto) y dos hijos menores. Busca asesoramiento sobre cuota alimentaria.",
        is_case: true
    },
    {
        id: "demo-c3",
        created_at: new Date(Date.now() - 172800000).toISOString(),
        contact_name: "Roberto Gómez",
        contact_phone: "+54 9 11 5555-4444",
        contact_email: "roberto.g@email.com",
        case_type: "Sucesión",
        status: "pending",
        ai_summary: "Fallecimiento de padre. Herederos: esposa y 3 hijos. Hay testamento.",
        is_case: false
    }
];

export const demoCases = [
    {
        id: "demo-case-1",
        caratula: "González c/ Mercado Libre S.R.L. s/ Despido",
        nro_expediente: "12345/2023",
        jurisdiccion: "CABA",
        fuero: "Laboral",
        estado: "En Prueba",
        ultima_actuacion: "Apertura a prueba",
        fecha_actuacion: new Date(Date.now() - 432000000).toISOString().split('T')[0], // 5 days ago
        client_id: "demo-c1"
    },
    {
        id: "demo-case-2",
        caratula: "Sucesión Ab Intestato de Juan Carlos Pérez",
        nro_expediente: "54321/2024",
        jurisdiccion: "San Isidro",
        fuero: "Civil y Comercial",
        estado: "Declaratoria de Herederos",
        ultima_actuacion: "Edictos publicados",
        fecha_actuacion: new Date(Date.now() - 172800000).toISOString().split('T')[0], // 2 days ago
        client_id: "demo-c3"
    },
    {
        id: "demo-case-3",
        caratula: "Martínez c/ Aseguradora XYZ s/ Daños y Perjuicios",
        nro_expediente: "98765/2022",
        jurisdiccion: "La Plata",
        fuero: "Civil",
        estado: "Sentencia",
        ultima_actuacion: "Notificación de Sentencia",
        fecha_actuacion: new Date(Date.now() - 86400000).toISOString().split('T')[0], // 1 day ago
        client_id: null
    }
];

export const demoDeadlines = [
    {
        id: "demo-evt-1",
        title: "Audiencia Art. 360",
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        time: "09:30",
        type: "audiencia",
        description: "Expte: González c/ Mercado Libre. Juzgado Laboral 10.",
        status: "pending",
        inquiries: { contact_name: "Juan Pérez", id: "demo-c1" }
    },
    {
        id: "demo-evt-2",
        title: "Vencimiento Contestación Demanda",
        date: new Date(Date.now() + 259200000).toISOString().split('T')[0], // In 3 days
        time: "12:00",
        type: "vencimiento",
        description: "Expte: 54321/2024. Preparar escrito.",
        status: "pending",
        inquiries: null
    },
    {
        id: "demo-evt-3",
        title: "Reunión con Cliente (María González)",
        date: new Date(Date.now() + 604800000).toISOString().split('T')[0], // In 7 days
        time: "16:00",
        type: "reunion",
        description: "Firma de documentación divorcio.",
        status: "pending",
        inquiries: { contact_name: "María González", id: "demo-c2" }
    }
];

export const demoFullResearchResult = {
    laws: "**Ley de Contrato de Trabajo (20.744)**\n- Art. 245: Indemnización por antigüedad.\n- Art. 232/233: Preaviso e integración mes de despido.\n- Art. 2 (Ley 25.323): Incremento indemnizatorio del 50%.\n\n**Convenio Colectivo de Trabajo 130/75**\n- Aplicable a empleados de comercio.",
    cases: [
        {
            title: "García c/ Cencosud S.A. s/ Despido",
            summary: "La Cámara Nacional de Apelaciones del Trabajo confirmó la procedencia de la multa del Art. 2 Ley 25.323 al verificarse la intimación fehaciente del trabajador.",
            source: "CNAT Sala V",
            url: "https://example.com/fallo-garcia"
        },
        {
            title: "Rodríguez c/ Carrefour s/ Diferencias Salariales",
            summary: "Se hizo lugar al reclamo por horas extras impagas, aplicando la presunción del Art. 55 LCT ante la falta de exhibición de libros.",
            source: "CNAT Sala II",
            url: "https://example.com/fallo-rodriguez"
        }
    ],
    calculation: "1. **Indemnización por Antigüedad**: $1.500.000 (5 periodos x $300.000 MRMNH)\n2. **Preaviso + SAC**: $325.000\n3. **Multa Art. 2 Ley 25.323**: $750.000\n\n**Total Estimado: $2.575.000 + Intereses**",
    evidence: "1. Telegramas de intimación y rechazo (TCL/CD).\n2. Recibos de sueldo (últimos 12 meses).\n3. Testigos (compañeros de trabajo) para acreditar horario real.",
    strategy: "**Estrategia Ofensiva**:\nSe recomienda iniciar SECLO reclamando la totalidad de los rubros, incluyendo multas de la Ley 24.013 si el registro era defectuoso. La jurisprudencia reciente de la Sala V es favorable en cuanto a la carga probatoria de las horas extras.",
    links: [
        { title: "Calculadora de Indemnizaciones", url: "https://calculator.example.com" },
        { title: "Texto completo Ley 20.744", url: "http://servicios.infoleg.gob.ar/infolegInternet/anexos/25000-29999/25552/texact.htm" }
    ],
    brave_used: true
};

export const demoResearchHistory = [
    {
        id: "demo-res-1",
        query: "Despido sin causa comercio CABA",
        created_at: new Date(Date.now() - 10000000).toISOString(),
        summary: "Análisis de rubros indemnizatorios CCT 130/75.",
        jurisdiction: "Nacional",
        result_json: demoFullResearchResult
    },
    {
        id: "demo-res-2",
        query: "Daño punitivo telefonía celular",
        created_at: new Date(Date.now() - 864000000).toISOString(),
        summary: "Evolución jurisprudencial sobre la aplicación de multas civiles.",
        jurisdiction: "Nacional",
        result_json: {
            ...demoFullResearchResult,
            laws: "**Ley 24.240 (Defensa del Consumidor)**\n- Art. 52 bis: Daño Punitivo.",
            cases: [{ title: "Pérez c/ Telecom", summary: "Condena por daño punitivo ante trato indigno.", source: "Cam. Civ. Com.", url: "" }]
        }
    }
];

export const demoLibrary = [
    {
        id: "demo-lib-1",
        autos: "C. N. A. T. Sala V Expte. N° 123/2023",
        summary: "Se confirma el fallo de primera instancia que declara nulo el despido de la trabajadora embarazada y ordena su reinstalación más el pago de salarios caídos.",
        jurisdiction: "Nacional",
        url: "https://example.com/fallo1",
        created_at: new Date(Date.now() - 20000000).toISOString()
    },
    {
        id: "demo-lib-2",
        autos: "S. C. B. A. Causa C. 123.456",
        summary: "Doctrina legal sobre la procedencia de los intereses moratorios en juicios de daños y perjuicios. Aplicación de la tasa pasiva más alta del Banco Provincia.",
        jurisdiction: "Provincia de Buenos Aires",
        url: "https://example.com/fallo2",
        created_at: new Date(Date.now() - 90000000).toISOString()
    },
    {
        id: "demo-lib-3",
        autos: "C. S. J. N. Fallos 345:123",
        summary: "Leading case sobre la responsabilidad de los buscadores de internet por contenidos publicados por terceros. 'Rodriguez c/ Google'.",
        jurisdiction: "Federal",
        url: "https://example.com/fallo3",
        created_at: new Date(Date.now() - 150000000).toISOString()
    }
];
