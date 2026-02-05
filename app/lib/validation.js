/**
 * CUIT/CUIL Validation Utilities for Argentina
 * Uses the official Modulo 11 algorithm from ARCA (formerly AFIP) to validate CUIT/CUIL numbers
 */

/**
 * Validates a CUIT/CUIL number using the Modulo 11 algorithm
 * @param {string} cuit - The CUIT/CUIL to validate (can have dashes or not)
 * @returns {boolean} - True if valid, false otherwise
 */
export function validateCuit(cuit) {
    if (!cuit) return false;

    // Remove dashes and spaces
    const cleaned = cuit.replace(/[-\s]/g, '');

    // Must be exactly 11 digits
    if (!/^\d{11}$/.test(cleaned)) return false;

    // Get the verification digit (last digit)
    const verificador = parseInt(cleaned[10], 10);

    // Multiplier sequence for Modulo 11
    const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

    // Calculate the sum
    let suma = 0;
    for (let i = 0; i < 10; i++) {
        suma += parseInt(cleaned[i], 10) * multiplicadores[i];
    }

    // Calculate expected verification digit
    const resto = suma % 11;
    let digitoEsperado;

    if (resto === 0) {
        digitoEsperado = 0;
    } else if (resto === 1) {
        // Special case: if prefix is 23 (female) it's 4, if 20 (male) it's invalid
        const prefix = cleaned.slice(0, 2);
        if (prefix === '23') {
            digitoEsperado = 4;
        } else if (prefix === '24') {
            digitoEsperado = 9;
        } else {
            digitoEsperado = 11 - resto;
        }
    } else {
        digitoEsperado = 11 - resto;
    }

    return verificador === digitoEsperado;
}

/**
 * Formats a CUIT/CUIL number with dashes (20-12345678-6)
 * @param {string} cuit - The CUIT/CUIL to format
 * @returns {string} - Formatted CUIT or original if invalid length
 */
export function formatCuit(cuit) {
    if (!cuit) return '';

    const cleaned = cuit.replace(/[-\s]/g, '');

    if (cleaned.length !== 11) return cuit;

    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`;
}

/**
 * Gets the type of CUIT/CUIL based on the prefix
 * @param {string} cuit - The CUIT/CUIL to check
 * @returns {string} - 'persona_fisica_m', 'persona_fisica_f', 'empresa', or 'desconocido'
 */
export function getCuitType(cuit) {
    if (!cuit) return 'desconocido';

    const cleaned = cuit.replace(/[-\s]/g, '');
    const prefix = cleaned.slice(0, 2);

    switch (prefix) {
        case '20':
        case '23':
        case '24':
            return 'persona_fisica_m'; // Male or unisex individual
        case '27':
            return 'persona_fisica_f'; // Female individual
        case '30':
        case '33':
        case '34':
            return 'empresa'; // Company
        default:
            return 'desconocido';
    }
}
