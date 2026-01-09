
export const contactChannels = {
    billing: {
        key: 'billing',
        label: 'Facturación y Pagos',
        email: 'billing@judic-ia.com',
        defaultSubject: 'Consulta de Facturación - [Usuario]',
        keywords: ['factura', 'pago', 'tarjeta', 'cobro', 'precio', 'suscripción', 'plan', 'mercado pago', 'downgrade', 'upgrade']
    },
    support: {
        key: 'support',
        label: 'Soporte Técnico',
        email: 'soporte@judic-ia.com',
        defaultSubject: 'Reporte de Error - [Usuario]',
        keywords: ['error', 'bug', 'no funciona', 'roto', 'falla', 'problema', 'glitch', 'pantalla blanca', 'no carga']
    },
    sales: {
        key: 'sales',
        label: 'Ventas y Consultas',
        email: 'hola@judic-ia.com',
        defaultSubject: 'Consulta Comercial - [Interesado]',
        keywords: ['demo', 'reunión', 'agendar', 'contacto', 'hablar con alguien', 'humano', 'asesor']
    }
};

export function routeContactChannel(text) {
    if (!text) return null;
    const lowerText = text.toLowerCase();

    // Check specific keywords for channels
    for (const channelKey in contactChannels) {
        const channel = contactChannels[channelKey];
        if (channel.keywords.some(keyword => lowerText.includes(keyword))) {
            return channel;
        }
    }
    return null;
}
