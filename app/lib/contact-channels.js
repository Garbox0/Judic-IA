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
