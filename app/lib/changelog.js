// Judic-IA Changelog
//
// Para agregar una novedad:
// 1. Agregá un objeto nuevo al PRINCIPIO de este array
// 2. id: incrementar el número de la entrada anterior (1, 2, 3...)
// 3. date: texto libre para mostrar al usuario ("21 Feb 2026", "Mar 2026", etc.)
// 4. Hacé commit y deploy
// 5. Ir a Configuración → Soporte → click "Enviar novedades por email"
//
// Solo se notifica la primera entrada (la más reciente).

export const CHANGELOG = [
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
