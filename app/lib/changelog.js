// Judic-IA Changelog
//
// Para agregar una novedad:
// 1. Agregá un objeto nuevo al PRINCIPIO de este array
// 2. Hacé commit y deploy
// 3. Disparar la notificación a suscriptores:
//    POST https://judic-ia.com/api/newsletter/broadcast
//    Header: x-broadcast-secret: [tu BROADCAST_SECRET del .env]
//
// Solo se notifica la primera entrada (la más reciente).

export const CHANGELOG = [
    {
        date: "Febrero 2026",
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
