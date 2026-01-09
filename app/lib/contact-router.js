import { CONTACT_CHANNELS } from "./contact-channels";

export function routeContactChannel(text = "") {
    const t = text.toLowerCase();

    // Prioridad: Billing > Support > Sales
    if (CONTACT_CHANNELS.billing.topics.some(w => t.includes(w))) return CONTACT_CHANNELS.billing;
    if (CONTACT_CHANNELS.support.topics.some(w => t.includes(w))) return CONTACT_CHANNELS.support;
    if (CONTACT_CHANNELS.sales.topics.some(w => t.includes(w))) return CONTACT_CHANNELS.sales;

    return null; // No specific contact intent detected, or default to general support if strictly forced
}
