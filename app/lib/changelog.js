// Judic-IA Changelog
//
// Para agregar una novedad:
// 1. Agregá un objeto nuevo al PRINCIPIO de este array
// 2. id: usar fecha ISO del día (YYYY-MM-DD) — NO cambiar una vez publicado
// 3. date: texto libre para mostrar al usuario ("21 Feb 2026", "Mar 2026", etc.)
// 4. Hacé commit y deploy
// 5. Ir a Configuración → Soporte → click "Enviar novedades por email"
//
// Solo se notifica la primera entrada (la más reciente).

export const CHANGELOG = [
    {
        id: "2026-02-21",       // identificador único de esta release
        date: "21 Feb 2026",    // texto que ve el usuario
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
