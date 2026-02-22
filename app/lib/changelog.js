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
