/**
 * Diccionario Oficial de Departamentos Judiciales de la SCBA (Provincia de Buenos Aires)
 * Extraído desde la MEV (Mesa de Entradas Virtual).
 * 
 * Este mapeo servirá para nuestro scraper cuando ataquemos el portal de la SCBA.
 */

export const DEPARTAMENTOS_SCBA = [
    { id: "aa", name: "TODOS los Deptos", has_family: false },
    { id: "AZ", name: "Azul", has_family: true, family_id: "AZF" },
    { id: "BB", name: "Bahía Blanca", has_family: true, family_id: "BBF" },
    { id: "DO", name: "Dolores", has_family: true, family_id: "DOF" },
    { id: "JU", name: "Junín", has_family: true, family_id: "JUF" },
    { id: "LM", name: "La Matanza", has_family: true, family_id: "LMF" },
    { id: "LP", name: "La Plata", has_family: true, family_id: "LPF" },
    { id: "LZ", name: "Lomas de Zamora", has_family: true, family_id: "LZF" },
    { id: "MP", name: "Mar del Plata", has_family: true, family_id: "MPF" },
    { id: "ME", name: "Mercedes", has_family: true, family_id: "MEF" },
    { id: "MR", name: "Moreno - Gral. Rodriguez", has_family: true, family_id: "MRF" },
    { id: "MO", name: "Moron", has_family: true, family_id: "MOF" },
    { id: "NE", name: "Necochea", has_family: true, family_id: "NEF" },
    { id: "OL", name: "Olavarría", has_family: true, family_id: "OLF" },
    { id: "PE", name: "Pergamino", has_family: true, family_id: "PEF" },
    { id: "QU", name: "Quilmes", has_family: true, family_id: "QUF" },
    { id: "SI", name: "San Isidro", has_family: true, family_id: "SIF" },
    { id: "SM", name: "San Martín", has_family: true, family_id: "SMF" },
    { id: "SN", name: "San Nicolas", has_family: true, family_id: "SNF" },
    { id: "TN", name: "Tandil", has_family: true, family_id: "TNF" },
    { id: "TL", name: "Trenque Lauquen", has_family: true, family_id: "TLF" },
    { id: "TY", name: "Tres Arroyos", has_family: true, family_id: "TYF" },
    { id: "ZC", name: "Zarate/Campana", has_family: true, family_id: "ZCF" },
    { id: "PAZ", name: "Justicia de PAZ", has_family: false }
];

export const getDepartamentoScbaById = (id) => {
    return DEPARTAMENTOS_SCBA.find(d => d.id === String(id)) || null;
};
