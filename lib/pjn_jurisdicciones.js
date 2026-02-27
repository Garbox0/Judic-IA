/**
 * Diccionario Oficial de Jurisdicciones y Cámaras de la Justicia Nacional y Federal
 * Extraído automáticamente desde el portal SCW (PJN).
 * 
 * Este mapeo permite a nuestro motor de alertas saber qué código enviar ('0', '1', '2', etc.)
 * a la página del PJN cuando un usuario decide monitorear una jurisdicción específica.
 */

export const JURISDICCIONES_PJN = [
    { id: "0", name: "CSJ - Corte Suprema de Justicia de la Nación", type: "nacional", location: "CABA" },
    { id: "1", name: "CIV - Cámara Nacional de Apelaciones en lo Civil", type: "nacional", location: "CABA" },
    { id: "2", name: "CAF - Cámara Nacional de Apelaciones en lo Contencioso Administrativo Federal", type: "federal", location: "CABA" },
    { id: "3", name: "CCF - Cámara Nacional de Apelaciones en lo Civil y Comercial Federal", type: "federal", location: "CABA" },
    { id: "4", name: "CNE - Cámara Nacional Electoral", type: "nacional", location: "CABA" },
    { id: "5", name: "CSS - Camara Federal de la Seguridad Social", type: "federal", location: "CABA" },
    { id: "6", name: "CPE - Cámara Nacional de Apelaciones en lo Penal Económico", type: "nacional", location: "CABA" },
    { id: "7", name: "CNT - Cámara Nacional de Apelaciones del Trabajo", type: "nacional", location: "CABA" },
    { id: "8", name: "CFP - Camara Criminal y Correccional Federal", type: "federal", location: "CABA" },
    { id: "9", name: "CCC - Camara Nacional de Apelaciones en lo Criminal y Correccional", type: "nacional", location: "CABA" },
    { id: "10", name: "COM - Camara Nacional de Apelaciones en lo Comercial", type: "nacional", location: "CABA" },
    { id: "11", name: "CPF - Camara Federal de Casación Penal", type: "federal", location: "CABA" },
    { id: "12", name: "CPN - Camara Nacional Casacion Penal", type: "nacional", location: "CABA" },
    { id: "13", name: "FBB - Justicia Federal de Bahia Blanca", type: "federal", location: "Buenos Aires" },
    { id: "14", name: "FCR - Justicia Federal de Comodoro Rivadavia", type: "federal", location: "Chubut" },
    { id: "15", name: "FCB - Justicia Federal de Córdoba", type: "federal", location: "Córdoba" },
    { id: "16", name: "FCT - Justicia Federal de Corrientes", type: "federal", location: "Corrientes" },
    { id: "17", name: "FGR - Justicia Federal de General Roca", type: "federal", location: "Río Negro" },
    { id: "18", name: "FLP - Justicia Federal de La Plata", type: "federal", location: "Buenos Aires" },
    { id: "19", name: "FMP - Justicia Federal de Mar del Plata", type: "federal", location: "Buenos Aires" },
    { id: "20", name: "FMZ - Justicia Federal de Mendoza", type: "federal", location: "Mendoza" },
    { id: "21", name: "FPO - Justicia Federal de Posadas", type: "federal", location: "Misiones" },
    { id: "22", name: "FPA - Justicia Federal de Paraná", type: "federal", location: "Entre Ríos" },
    { id: "23", name: "FRE - Justicia Federal de Resistencia", type: "federal", location: "Chaco" },
    { id: "24", name: "FSA - Justicia Federal de Salta", type: "federal", location: "Salta" },
    { id: "25", name: "FRO - Justicia Federal de Rosario", type: "federal", location: "Santa Fe" },
    { id: "26", name: "FSM - Justicia Federal de San Martin", type: "federal", location: "Buenos Aires" },
    { id: "27", name: "FTU - Justicia Federal de Tucuman", type: "federal", location: "Tucumán" }
];

/**
 * Helper para obtener una jurisdicción por su ID
 */
export const getJurisdiccionById = (id) => {
    return JURISDICCIONES_PJN.find(j => j.id === String(id)) || null;
};

/**
 * Helper para obtener las jurisdicciones de CABA (Corte Suprema y Nacionales/Federales con asiento en CABA)
 */
export const getJurisdiccionesCABA = () => {
    return JURISDICCIONES_PJN.filter(j => j.location === "CABA");
};

/**
 * Helper para obtener las jurisdicciones del interior (Federales fuera de CABA)
 */
export const getJurisdiccionesInterior = () => {
    return JURISDICCIONES_PJN.filter(j => j.location !== "CABA");
};
