/**
 * Argentine Judicial Calendar 2026
 * Utility to calculate business days (días hábiles) in Argentina.
 */

// Format: YYYY-MM-DD -> Name
export const HOLIDAYS_2026 = {
    "2026-01-01": "Año Nuevo",
    "2026-02-16": "Carnaval",
    "2026-02-17": "Carnaval",
    "2026-03-23": "Feriado con fines turísticos",
    "2026-03-24": "Día de la Memoria",
    "2026-04-02": "Día de Malvinas",
    "2026-04-03": "Viernes Santo",
    "2026-05-01": "Día del Trabajador",
    "2026-05-25": "Revolución de Mayo",
    "2026-06-15": "Paso a la Inmortalidad de Güemes",
    "2026-06-20": "Paso a la Inmortalidad de Belgrano",
    "2026-07-09": "Día de la Independencia",
    "2026-07-10": "Feriado con fines turísticos",
    "2026-08-17": "Paso a la Inmortalidad de San Martín",
    "2026-10-12": "Día del Respeto a la Diversidad Cultural",
    "2026-11-23": "Día de la Soberanía Nacional",
    "2026-12-07": "Feriado con fines turísticos",
    "2026-12-08": "Inmaculada Concepción",
    "2026-12-25": "Navidad",
};

/**
 * Judicial Recess (Feria Judicial)
 * Standard for National Justice (Argentina)
 */
export const JUDICIAL_RECESS_2026 = {
    summer: { start: "2026-01-01", end: "2026-01-31", name: "Feria Judicial de Verano" },
    winter: { start: "2026-07-13", end: "2026-07-24", name: "Feria Judicial de Invierno" }
};

/**
 * Helper to get YYYY-MM-DD in local time
 */
const toISOLocal = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Returns the reason why a day is non-business, or null if it's a business day.
 */
export const getJudicialNonBusinessReason = (date) => {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) return "Domingo";
    if (dayOfWeek === 6) return "Sábado";

    const isoDate = toISOLocal(date);

    // Check Holidays
    if (HOLIDAYS_2026[isoDate]) return HOLIDAYS_2026[isoDate];

    // Check Recess (Feria)
    const { summer, winter } = JUDICIAL_RECESS_2026;
    if (isoDate >= summer.start && isoDate <= summer.end) return summer.name;
    if (isoDate >= winter.start && isoDate <= winter.end) return winter.name;

    return null;
};

/**
 * Checks if a specific date is a business day (Judicial)
 * @param {Date} date 
 * @returns {boolean}
 */
export const isJudicialBusinessDay = (date) => {
    return getJudicialNonBusinessReason(date) === null;
};

/**
 * Adds business days to a start date
 * In legal context (Arg), the term starts the day AFTER notification.
 * @param {string|Date} startDate 
 * @param {number} days 
 * @returns {Date}
 */
export const addJudicialBusinessDays = (startDate, days) => {
    let date = new Date(startDate);
    // Terms usually start counting from the day after (Art. 156 CPCCN)
    date.setDate(date.getDate() + 1);

    let businessDaysAdded = 0;
    while (businessDaysAdded < days) {
        if (isJudicialBusinessDay(date)) {
            businessDaysAdded++;
        }
        if (businessDaysAdded < days) {
            date.setDate(date.getDate() + 1);
        }
    }

    // Double check if we landed on a non-business day (shouldn't happen with the logic above, but for safety)
    while (!isJudicialBusinessDay(date)) {
        date.setDate(date.getDate() + 1);
    }

    return date;
};

/**
 * Calculates how many judicial business days are between two dates
 */
export const countJudicialBusinessDays = (start, end) => {
    let date = new Date(start);
    let endDate = new Date(end);
    let count = 0;

    // Start from the day after
    date.setDate(date.getDate() + 1);

    while (date <= endDate) {
        if (isJudicialBusinessDay(date)) {
            count++;
        }
        date.setDate(date.getDate() + 1);
    }
    return count;
};
