// ============================================================
// Judic-IA — Changelog
// ============================================================
//
// CÓMO PUBLICAR UNA NOVEDAD:
//
// 1. Agregá un objeto nuevo al PRINCIPIO de este array
//    con id = (último id + 1), date = texto libre, y los items.
//
//    Ejemplo:
//    {
//        id: 2,
//        date: "28 Feb 2026",
//        badge: "Nuevo",        // opcional
//        items: [
//            "Nueva funcionalidad X",
//            "Se mejoró Y",
//        ],
//    },
//
// 2. Guardá el archivo → commit → push → esperá el deploy de Vercel (1-2 min)
//
// 3. Ir al dashboard → Configuración → tab Soporte
//    El botón "Enviar novedades por email" aparece activo de nuevo.
//    Un click → mail automático a todos los suscriptores.
//
// NOTAS:
// - id: número secuencial, nunca repetir ni cambiar una vez publicado
// - date: texto libre ("28 Feb 2026", "Mar 2026", lo que quieras)
// - badge: opcional — "Nuevo", "Fix", "Mejora", lo que aplique
// - Solo se notifica por email la PRIMERA entrada (la más reciente)
// - El sistema bloquea doble envío de la misma release automáticamente
// ============================================================

export const CHANGELOG = [
    {
        id: 10,
        date: "27 Feb 2026",
        badge: "Mejora",
        items: [
            "Mayor confiabilidad en compras y acreditaciones de creditos",
            "Uso de creditos mas predecible al crear y gestionar alertas",
            "Mejor estabilidad general en el modulo de Alertas",
        ],
    },
    {
        id: 9,
        date: "27 Feb 2026",
        badge: "Mejora",
        items: [
            "Terminal de Estrategia renovada: mejor navegacion entre Estrategia, Consulta Verificable y Monitoreo",
            "Consulta Verificable mas robusta para expedientes por numero o por parte, con mejor visualizacion de resultados y detalle",
            "Monitoreo de alertas mejorado: configuracion mas clara, prueba manual y feedback mas preciso de estado",
            "Mejoras de accesibilidad y lectura en Research (modo claro, foco de teclado y etiquetas para asistencia)",
            "Correcciones de estabilidad y rendimiento general en busquedas y paneles de Research",
        ],
    },
    {
        id: 8,
        date: "23 Feb 2026",
        badge: "Nuevo",
        items: [
            "Podés registrar más de una matrícula: si ejercés en varios colegios o provincias, agregá todas tus matrículas al perfil y cada una se verifica de forma independiente",
            "Al elegir 'Otro' colegio ahora seleccionás la provincia y escribís el nombre del colegio por separado, para que aparezcas correctamente en las búsquedas del marketplace",
            "Las matrículas verificadas se muestran como insignias en tu perfil público",
            "Las zonas de cobertura se actualizan automáticamente a medida que tus matrículas son verificadas",
        ],
    },
    {
        id: 7,
        date: "23 Feb 2026",
        badge: "Mejora",
        items: [
            "Rediseño del chat del abogado: interfaz más ordenada, botones alineados y de tamaño uniforme",
            "Los mensajes que enviás destacan más visualmente con una sombra dorada",
            "Fondo más limpio en la conversación, más fácil de leer en sesiones largas",
            "Panel de detalles del cliente con mejor separación visual",
        ],
    },
    {
        id: 6,
        date: "22 Feb 2026",
        badge: "Nuevo",
        items: [
            "Vista previa antes de enviar: al adjuntar un archivo podés escribir una descripción o enviarlo tal cual, como en WhatsApp",
            "Grabación de notas de voz directamente desde el chat con un botón de micrófono",
        ],
    },
    {
        id: 5,
        date: "22 Feb 2026",
        badge: "Mejora",
        items: [
            "Accesibilidad mejorada en el chat: imágenes, audios y videos ahora son completamente navegables por teclado",
            "Lectores de pantalla anuncian correctamente los archivos adjuntos, errores y mensajes nuevos",
            "Mejor compatibilidad con tecnologías de asistencia en todas las pantallas del chat",
        ],
    },
    {
        id: 4,
        date: "22 Feb 2026",
        badge: "Nuevo",
        items: [
            "Chat con clientes: enviá y recibí archivos directamente en la conversación (imágenes, PDFs, audios, videos y documentos)",
            "Las imágenes se muestran como vista previa inline; los audios y videos tienen reproductor integrado",
            "Botón para descargar cualquier archivo adjunto directamente a tu dispositivo",
            "Escaneo de seguridad automático en todos los archivos recibidos",
            "Los clientes también pueden adjuntar archivos desde su chat",
        ],
    },
    {
        id: 3,
        date: "22 Feb 2026",
        badge: "Seguridad",
        items: [
            "Verificación en dos pasos (2FA) por email",
        ],
    },
    {
        id: 2,
        date: "21 Feb 2026",
        badge: "Nuevo",
        items: [
            "Dictado por voz en Jurisprudencia: buscá con el micrófono sin escribir",
        ],
    },
    {
        id: 1,
        date: "21 Feb 2026",
        badge: "Nuevo",
        items: [
            "Canal de soporte directo por WhatsApp integrado en Configuración → Soporte",
            "Nueva pestaña 'Antecedentes Judiciales de Empresas' en la herramienta de investigación",
            "Moderación de contactos en el marketplace: aceptar, rechazar o bloquear consultas entrantes",
            "Sugerencia de foto profesional al intentar activar el perfil público sin imagen",
            "Sección de Novedades con historial de cambios de la plataforma",
        ],
    },
];
