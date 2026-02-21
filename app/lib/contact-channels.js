// WhatsApp support number (Argentina format: 549 + area code + number, no spaces)
// Example: 5491112345678 for +54 9 11 1234-5678
export const WHATSAPP_SUPPORT_NUMBER = '5491121632824';

export function buildWhatsApp(number, userName, planTier) {
    const name = userName || 'Usuario';
    const plan = planTier || 'free';
    const text = `Hola, soy ${name} (plan ${plan}) y necesito ayuda con Judic-IA.`;
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export const CONTACT_CHANNELS = {
    sales: {
        key: "sales",
        label: "Consultas generales / Demo",
        email: "hola@judic-ia.com",
        topics: ["demo", "precios", "planes", "alianzas", "comercial", "ventas", "contratar"],
        defaultSubject: "Consulta comercial / Demo - Judic-IA",
    },
    support: {
        key: "support",
        label: "Soporte técnico",
        email: "soporte@judic-ia.com",
        topics: ["error", "bug", "no funciona", "problema", "login", "cuenta", "app", "falla"],
        defaultSubject: "Soporte técnico - Judic-IA",
    },
    billing: {
        key: "billing",
        label: "Facturación y suscripciones",
        email: "billing@judic-ia.com",
        topics: ["pago", "factura", "suscripcion", "cobro", "mp", "mercadopago", "reintegro", "tarjeta", "vencimiento"],
        defaultSubject: "Facturación / Suscripción - Judic-IA",
    },
};

export function buildMailto(email, subject, body) {
    const s = encodeURIComponent(subject || "");
    const b = encodeURIComponent(body || "");
    return `mailto:${email}?subject=${s}&body=${b}`;
}
