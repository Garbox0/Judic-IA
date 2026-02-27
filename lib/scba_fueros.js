/**
 * Diccionario Oficial de Fueros de la SCBA (Provincia de Buenos Aires)
 */

export const FUEROS_SCBA = [
    { id: "CC", name: "Civil y Comercial" },
    { id: "CA", name: "Contencioso Administrativo" },
    { id: "MP", name: "Ministerio Público" },
    { id: "PE", name: "Penal" },
    { id: "TR", name: "Trabajo" },
    { id: "FA", name: "Familia" },
    { id: "PZ", name: "Justicia de Paz" }
];

export const getFueroScbaById = (id) => {
    return FUEROS_SCBA.find(f => f.id === String(id)) || null;
};
