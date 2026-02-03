"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Book, Gavel, FileText, Scale, Search, Map, Globe, Shield, Pickaxe, Utensils, Landmark, Scroll, Users, Briefcase, HeartHandshake } from 'lucide-react';
import UsageGuide from '@/app/components/UsageGuide';
import { dashboardManuals } from '@/app/lib/dashboardManuals';
import './legislation.css';

export default function LegislationPage() {
    const [searchMode, setSearchMode] = useState('norma'); // 'norma' | 'boletin'

    // State for Norm Search
    const [searchState, setSearchState] = useState({
        tipo: '',
        numero: '',
        anio: '',
        texto: '',
        dependencia: ''
    });

    // State for Boletin Search
    const [boState, setBoState] = useState({
        type: 'fecha', // 'fecha' | 'numero'
        fecha: '',
        numero: ''
    });

    const [selectedJurisdiction, setSelectedJurisdiction] = useState('Buenos Aires (PBA)');
    const [isProceduralExpanded, setIsProceduralExpanded] = useState(false);

    const handleSearch = (e) => {
        e.preventDefault();
        const { tipo, numero, anio, texto } = searchState;
        if (!tipo && !numero && !anio && !texto) return;

        // Construct a Smart Query for InfoLeg via Google
        let queryParts = [`site:infoleg.gob.ar`];

        if (tipo) queryParts.push(tipo);
        if (numero) queryParts.push(`"${numero}"`); // Exact number match
        if (anio) queryParts.push(anio);
        if (texto) queryParts.push(texto);

        const finalQuery = queryParts.join(' ');
        const url = `https://www.google.com/search?q=${encodeURIComponent(finalQuery)}`;
        window.open(url, '_blank');
    };

    // 1. CÓDIGOS NACIONALES (FONDO Y FORMA)
    const codesFondo = [
        {
            title: "Constitución Nacional",
            desc: "Ley suprema. Derechos, garantías y organización del Estado.",
            url: "/dashboard/legislation/viewer/constitucion-nacional.pdf?province=nacion",
            icon: <Landmark size={28} className="text-amber-400" />
        },
        {
            title: "Código Civil y Comercial de la Nación",
            desc: "Regula las relaciones civiles y comerciales (InfoLeg).",
            url: "https://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/235975/texact.htm",
            icon: <Scale size={28} className="text-amber-400" />
        },
        {
            title: "Código Penal de la Nación",
            desc: "Delitos y penas en el territorio argentino (InfoLeg).",
            url: "https://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/16546/texact.htm",
            icon: <Gavel size={28} className="text-amber-400" />
        },
        {
            title: "Código Procesal Civil y Comercial",
            desc: "Reglas de procedimiento en materia civil y comercial (InfoLeg).",
            url: "https://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/16547/texact.htm",
            icon: <Book size={28} className="text-amber-400" />
        },
        {
            title: "Código Procesal Penal Federal",
            desc: "Procedimiento penal federal acusatorio (PDF).",
            url: "/dashboard/legislation/viewer/codigo-procesal-penal-federal.pdf?province=nacion",
            icon: <Scale size={28} className="text-amber-400" />
        },
        {
            title: "Código Procesal Penal (Ley 27.063)",
            desc: "Nuevo Código Procesal Penal de la Nación (InfoLeg).",
            url: "https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/383/texact.htm",
            icon: <Scale size={28} className="text-amber-400" />
        },
        {
            title: "Ley de Contrato de Trabajo (20.744)",
            desc: "Régimen de contrato de trabajo (Sector Privado).",
            url: "/dashboard/legislation/viewer/ley-contrato-trabajo.pdf?province=nacion",
            icon: <FileText size={28} className="text-amber-400" />
        },
        {
            title: "Código de Minería",
            desc: "Régimen legal de las minas y su explotación (InfoLeg).",
            url: "https://servicios.infoleg.gob.ar/infolegInternet/anexos/40000-44999/43797/texact.htm",
            icon: <Pickaxe size={28} className="text-amber-400" />
        },
        {
            title: "Código Aduanero",
            desc: "Disposiciones sobre el tráfico internacional (InfoLeg).",
            url: "https://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/16536/texact.htm",
            icon: <Globe size={28} className="text-amber-400" />
        },
        {
            title: "Código Aeronáutico",
            desc: "Rige la aeronáutica civil en el territorio (InfoLeg).",
            url: "https://servicios.infoleg.gob.ar/infolegInternet/anexos/20000-24999/24963/texact.htm",
            icon: <Shield size={28} className="text-amber-400" />
        },
        {
            title: "Código Alimentario Argentino",
            desc: "Normas higiénico-sanitarias y bromatológicas.",
            url: "/dashboard/legislation/viewer/codigo-alimentario.pdf?province=nacion",
            icon: <Utensils size={28} className="text-amber-400" />
        },
        {
            title: "Código Alimentario (ANMAT)",
            desc: "Portal oficial de la ANMAT para el código alimentario.",
            url: "https://www.argentina.gob.ar/anmat/codigoalimentario",
            icon: <Utensils size={28} className="text-amber-400" />
        },
        {
            title: "Código de Ética Pública",
            desc: "Deberes, prohibiciones e incompatibilidades.",
            url: "/dashboard/legislation/viewer/codigo-etica-publica.pdf?province=nacion",
            icon: <Landmark size={28} className="text-amber-400" />
        },
        {
            title: "Código Electoral Nacional",
            desc: "Régimen electoral y partidos políticos.",
            url: "/dashboard/legislation/viewer/codigo-electoral-nacional.pdf?province=nacion",
            icon: <Briefcase size={28} className="text-amber-400" />
        },
        {
            title: "Reglamento para la Justicia Nacional",
            desc: "Reglamentación oficial del Poder Judicial (PJN).",
            url: "https://www.pjn.gov.ar/",
            icon: <FileText size={28} className="text-amber-400" />
        }
    ];

    // ... (specialLaws left unchanged)
    const specialLaws = [
        {
            title: "Defensa del Consumidor (24.240)",
            desc: "Protección y defensa de los consumidores y usuarios.",
            url: "/dashboard/legislation/viewer/ley-defensa-consumidor.pdf?province=nacion",
            icon: <HeartHandshake size={28} className="text-blue-400" />
        },
        {
            title: "Concursos y Quiebras (24.522)",
            desc: "Reorganización de empresas y procesos falenciales.",
            url: "/dashboard/legislation/viewer/ley-concursos-quiebras.pdf?province=nacion",
            icon: <Briefcase size={28} className="text-blue-400" />
        },
        {
            title: "Sociedades Comerciales (19.550)",
            desc: "Ley Gral. de Sociedades. Tipos societarios y funcionamiento.",
            url: "/dashboard/legislation/viewer/ley-sociedades-comerciales.pdf?province=nacion",
            icon: <Users size={28} className="text-blue-400" />
        },
        {
            title: "Riesgos del Trabajo (24.557)",
            desc: "Prevención de riesgos y reparación de daños laborales.",
            url: "/dashboard/legislation/viewer/ley-riesgos-trabajo.pdf?province=nacion",
            icon: <Shield size={28} className="text-blue-400" />
        },
        {
            title: "Procedimiento Administrativo (19.549)",
            desc: "Normas para trámites y actos ante la administración.",
            url: "/dashboard/legislation/viewer/ley-procedimiento-administrativo.pdf?province=nacion",
            icon: <Scroll size={28} className="text-blue-400" />
        }
    ];

    // 3. CÓDIGOS DE FORMA (PROCESALES) - POR JURISDICCIÓN
    const proceduralData = {
        // "Nación" moved to 'codesFondo' as per user request (unified grid)
        "Buenos Aires (PBA)": [
            { title: "Constitución de la Pcia. de Bs. As.", url: "/dashboard/legislation/viewer/constitucion-pba.pdf?province=buenos-aires" },
            { title: "Código Rural (Ley 10.081)", url: "/dashboard/legislation/viewer/codigo-rural-pba.pdf?province=buenos-aires" },
            { title: "Código Fiscal (Ley 10.397)", url: "/dashboard/legislation/viewer/codigo-fiscal-pba.pdf?province=buenos-aires" },
            { title: "Código de Tránsito (Ley 13.927)", url: "/dashboard/legislation/viewer/codigo-transito-pba.pdf?province=buenos-aires" },
            { title: "Código Procesal Penal (Ley 11.922)", url: "/dashboard/legislation/viewer/codigo-procesal-penal-pba.pdf?province=buenos-aires" },
            { title: "Código Contencioso Administrativo (Ley 12.008)", url: "/dashboard/legislation/viewer/codigo-contencioso-admin-pba.pdf?province=buenos-aires" },
            { title: "Ley de Ejecución Penal (Ley 12.256)", url: "https://normas.gba.gob.ar/ar-b/ley/1999/12256/4596" },
            { title: "Código de Aguas (Ley 12.257)", url: "https://normas.gba.gob.ar/ar-b/ley/1999/12257/4574" },
            { title: "Código Procesal, Civil y Comercial (Ley 7425)", url: "/dashboard/legislation/viewer/codigo-civil-comercial-pba.pdf?province=buenos-aires" },
            { title: "Procedimiento Administrativo (Dto. Ley 7647/70)", url: "https://normas.gba.gob.ar/ar-b/decreto-ley/1970/7647/1476" },
            { title: "Código de Faltas (Dto. Ley 8031/73)", url: "https://normas.gba.gob.ar/ar-b/decreto-ley/1973/8031/1434" },
            { title: "Código de Faltas Municipales (Dto. Ley 8751/77)", url: "https://normas.gba.gob.ar/ar-b/decreto-ley/1977/8751/1239" },
            { title: "Código Implementación Derechos Consumidores (Ley 13.133)", url: "https://normas.gba.gob.ar/ar-b/ley/2003/13133/4128" },
            { title: "Código Electoral (Ley 5109)", url: "https://normas.gba.gob.ar/ar-b/ley/1946/5109/10163" },
            { title: "Adhesión Código Alimentario Argentino (Ley 13.230)", url: "https://normas.gba.gob.ar/ar-b/ley/2004/13230/3638" }
        ],
        "CABA": [
            { title: "Código Contravencional", url: "/dashboard/legislation/viewer/codigo-contravencional-caba.pdf?province=caba" },
            { title: "Código de Procedimientos de Faltas", url: "/dashboard/legislation/viewer/codigo-procedimientos-faltas-caba.pdf?province=caba" },
            { title: "Código Fiscal", url: "/dashboard/legislation/viewer/codigo-fiscal-caba.pdf?province=caba" },
            { title: "Código Contencioso Admin. y Tributario", url: "/dashboard/legislation/viewer/codigo-contencioso-admin-tributario-caba.pdf?province=caba" },
            { title: "Código Procesal Penal", url: "/dashboard/legislation/viewer/codigo-procesal-penal-caba.pdf?province=caba" },
            { title: "Código de Tránsito y Transporte", url: "/dashboard/legislation/viewer/codigo-transito-transporte-caba.pdf?province=caba" },
            { title: "Código Electoral", url: "https://www.saij.gob.ar/6031-local-ciudad-autonoma-buenos-aires-creacion-instituto-gestion-electoral-lpx0006031-2018-10-25/123456789-0abc-defg-130-6000xvorpyel" },
            { title: "Código Urbanístico", url: "https://boletinoficial.buenosaires.gob.ar/normativaba/norma/446782" }
        ],
        "Córdoba": [
            { title: "Código de Procedimiento Contencioso-Administrativo", url: "http://web2.cba.gov.ar/web/leyes.nsf/0/EF9B8FD2619646E403257BE10057A1BE?OpenDocument&Highlight=0,7182" },
            { title: "Código Procesal Penal de la Provincia", url: "http://web2.cba.gov.ar/web/leyes.nsf/0/34892CF23B741475032586BE00575E42?OpenDocument&Highlight=0,c%F3digo%20procesal%20penal" },
            { title: "Código de Procedimiento Civil y Comercial", url: "http://web2.cba.gov.ar/web/leyes.nsf/0/19FD5340A2AA7E7003258A2000449696?OpenDocument&Highlight=0,8465" },
            { title: "Código Procesal del Trabajo (Ley 7987)", url: "https://www.argentina.gob.ar/normativa/provincial/ley-7987-123456789-0abc-defg-789-7000ovorpyel" }
        ],
        "Catamarca": [
            { title: "Código Contencioso Administrativo (Ley 2403)", url: "/dashboard/legislation/viewer/codigo-contencioso-administrativo-catamarca.pdf?province=catamarca" },
            { title: "Cód. Procedimientos Administrativos (Ley 3559)", url: "/dashboard/legislation/viewer/codigo-procedimientos-administrativos-catamarca.pdf?province=catamarca" },
            { title: "Cód. Procedimientos Mineros (Ley 2233)", url: "/dashboard/legislation/viewer/codigo-procedimientos-mineros-catamarca.pdf?province=catamarca" },
            { title: "Código Procesal Civil y Comercial (Ley 5213)", url: "https://digesto.catamarca.gob.ar/ley/ley_detail/2857" },
            { title: "Cód. Procesal Civil y Comercial (Ley 2339)", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-ley-2339-catamarca.pdf?province=catamarca" },
            { title: "Ley de Ejecución Penal (Ley 4991)", url: "https://www.argentina.gob.ar/normativa/provincial/ley-4991-123456789-0abc-defg-199-4000kvorpyel/actualizacion" },
            { title: "Modificación Cód. Procesal Penal (Ley 5425)", url: "/dashboard/legislation/viewer/modificacion-codigo-procesal-penal-catamarca.pdf?province=catamarca" },
            { title: "Código Tributario (Ley 5022)", url: "/dashboard/legislation/viewer/codigo-tributario-catamarca.pdf?province=catamarca" },
            { title: "Código de Faltas (Ley 5171)", url: "/dashboard/legislation/viewer/codigo-faltas-catamarca.pdf?province=catamarca" },
            { title: "Código Procesal del Trabajo (Ley 4799)", url: "/dashboard/legislation/viewer/codigo-procesal-trabajo-catamarca.pdf?province=catamarca" },
        ],
        "Santa Fe": [
            { title: "Constitución de la Pcia. de Santa Fe", url: "https://www.santafe.gov.ar/index.php/web/content/view/full/113110" },
            { title: "Código Procesal Civil y Comercial", url: "https://www.santafe.gov.ar/normativa/" }
        ],
        "Corrientes": [
            { title: "Código Fiscal", url: "/dashboard/legislation/viewer/codigo-fiscal-corrientes.pdf?province=corrientes" },
            { title: "Ley Tarifaria (Ley 6249)", url: "/dashboard/legislation/viewer/ley-tarifaria-corrientes.pdf?province=corrientes" },
            { title: "Código Fiscal – Ley Tarifaria (Ley 1564)", url: "/dashboard/legislation/viewer/codigo-fiscal-ley-1564-corrientes.pdf?province=corrientes" },
            { title: "Código Procesal Penal (Ley 6518)", url: "/dashboard/legislation/viewer/codigo-procesal-penal-corrientes.pdf?province=corrientes" },
            { title: "Cód. Procesal, Civil y Comercial (Ley 6556)", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-corrientes.pdf?province=corrientes" },
            { title: "Código de Aguas (Ley 3066)", url: "/dashboard/legislation/viewer/codigo-aguas-ley-3066-corrientes.pdf?province=corrientes" },
            { title: "Código de Aguas (Dto. Ley 191/2001)", url: "/dashboard/legislation/viewer/codigo-aguas-dto-191-corrientes.pdf?province=corrientes" },
            { title: "Código Contencioso Admin. (Ley 4106)", url: "/dashboard/legislation/viewer/codigo-contencioso-administrativo-corrientes.pdf?province=corrientes" },
            { title: "Código Derechos Consumidor (Ley 5760)", url: "/dashboard/legislation/viewer/codigo-derechos-consumidor-corrientes.pdf?province=corrientes" },
            { title: "Código Procedimiento Laboral (Ley 5341)", url: "/dashboard/legislation/viewer/codigo-procedimiento-laboral-corrientes.pdf?province=corrientes" },
            { title: "Cód. Proc. Constitucionales (Ley 5676)", url: "/dashboard/legislation/viewer/codigo-proc-constitucionales-corrientes.pdf?province=corrientes" },
            { title: "Código Rural (Ley 3607)", url: "/dashboard/legislation/viewer/codigo-rural-corrientes.pdf?province=corrientes" },
        ],
        "Chaco": [
            { title: "Cód. Procesal Civil y Comercial (Ley 2559)", url: "https://www.argentina.gob.ar/normativa/provincial/ley-2559-123456789-0abc-defg-955-2000hvorpyel/actualizacion" },
            { title: "Código de Faltas (Ley 850)", url: "https://www.saij.gob.ar/850-local-chaco-codigo-faltas-provincia-chaco-lph1000850-1995-09-20/123456789-0abc-defg-058-0001hvorpyel" },
            { title: "Código Procesal Penal (Ley 965)", url: "/dashboard/legislation/viewer/codigo-procesal-penal-chaco.pdf?province=chaco" },
            { title: "Código Rural (Ley 713)", url: "https://www.saij.gob.ar/legislacion/ley-chaco-3727-codigo_rural_provincia_chaco.htm" },
            { title: "Cód. Procedimiento Administrativo (Ley 179)", url: "https://www.saij.gob.ar/LPH0100179" },
            { title: "Cód. Contencioso Administrativo (Ley 135)", url: "https://es.scribd.com/document/512841343/Ley-135-A-contencioso-Chaco" },
            { title: "Código Tributario (Dto. Ley 2444/62)", url: "/dashboard/legislation/viewer/codigo-tributario-chaco.pdf?province=chaco" },
            { title: "Cód. Procedimientos Mineros (Ley 1135)", url: "https://www.saij.gob.ar/4889-local-chaco-codigo-procedimientos-mineros-establece-actividades-regidas-codigo-mineria-demas-leyes-materia-lph0004889-2001-05-30/123456789-0abc-defg-988-4000hvorpyel" },
            { title: "Código de Aguas (Ley 555)", url: "/dashboard/legislation/viewer/codigo-aguas-chaco.pdf?province=chaco" },
        ],
        "Chubut": [
            { title: "Código Procesal Penal (Ley XV Nº 9)", url: "https://sistemas.chubut.gov.ar/digesto/sistema/consulta.php?idile1=7954" },
            { title: "Código Contravencional (Ley XV- Nº 6)", url: "https://sistemas.chubut.gov.ar/digesto/sistema/consulta.php?idile1=31887" },
            { title: "Código Fiscal (Ley XXIV N° 38)", url: "https://sistemas.chubut.gov.ar/digesto/sistema/consulta.php?idile1=5557" },
            { title: "Código de Seguridad Social (Ley XVIII- Nº 4)", url: "https://sistemas.chubut.gov.ar/digesto/sistema/consulta.php?idile1=5076" },
            { title: "Cód. Procesal Civil y Comercial (Ley XIII Nº 5)", url: "https://sistemas.chubut.gov.ar/digesto/sistema/consulta.php?idile1=21163" },
            { title: "Código Ambiental (Ley XI N° 35)", url: "https://sistemas.chubut.gov.ar/digesto/sistema/consulta.php?idile1=5566" },
            { title: "Cód. de Procedimientos del Trabajo (Ley XIV N° 1)", url: "https://sistemas.chubut.gov.ar/digesto/sistema/consulta.php?idile1=3669" }
        ],
        "Entre Ríos": [
            { title: "Código Procesal Penal (Ley 9754)", url: "/dashboard/legislation/viewer/codigo-procesal-penal-entre-rios.pdf?province=entre-rios" },
            { title: "Cód. Contencioso Administrativo (Ley 7061)", url: "/dashboard/legislation/viewer/codigo-contencioso-administrativo-entre-rios.pdf?province=entre-rios" },
            { title: "Código Rural (Ley 1509)", url: "/dashboard/legislation/viewer/codigo-rural-entre-rios.pdf?province=entre-rios" },
            { title: "Código Fiscal (T.O. 2022)", url: "/dashboard/legislation/viewer/codigo-fiscal-entre-rios.pdf?province=entre-rios" },
            { title: "Código Procesal Civil y Comercial", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-entre-rios.pdf" },
            { title: "Código Procesal Laboral", url: "/dashboard/legislation/viewer/codigo-procesal-laboral-entre-rios.pdf" },
            { title: "Código Procesal de Familia", url: "/dashboard/legislation/viewer/codigo-procesal-familia-entre-rios.pdf" }
        ],
        "Formosa": [
            { title: "Código Procesal Civil y Comercial", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-formosa.pdf?province=formosa" },
            { title: "Código Fiscal", url: "https://www.saij.gob.ar/legislacion/ley-formosa-1589-codigo_fiscal_formosa.htm" },
            { title: "Código Procesal Penal", url: "/dashboard/legislation/viewer/codigo-procesal-penal-formosa.pdf?province=formosa" },
            { title: "Código de Faltas", url: "/dashboard/legislation/viewer/codigo-faltas-formosa.pdf?province=formosa" },
            { title: "Cód. Proc. Tribunal de Familia", url: "/dashboard/legislation/viewer/codigo-familia-formosa.pdf?province=formosa" },
            { title: "Cód. de Procedimiento de Trabajo", url: "/dashboard/legislation/viewer/codigo-procedimiento-trabajo-formosa.pdf?province=formosa" },
        ],
        "Mendoza": [
            { title: "Cód. Procesal Civil, Comercial y Tributario – Ley 9001", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-tributario-mendoza.pdf?province=mendoza" },
            { title: "Código Fiscal (T.O. 2026)", url: "/dashboard/legislation/viewer/codigo-fiscal-mendoza.pdf?province=mendoza" },
            { title: "Código Procesal Administrativo – Ley 3918", url: "/dashboard/legislation/viewer/codigo-procesal-administrativo-mendoza.pdf?province=mendoza" },
            { title: "Código Procesal Laboral – Ley 9109", url: "/dashboard/legislation/viewer/codigo-procesal-laboral-mendoza.pdf?province=mendoza" },
            { title: "Código Procesal Penal – Ley 8937", url: "/dashboard/legislation/viewer/codigo-procesal-penal-mendoza.pdf?province=mendoza" },
            { title: "Código Contravencional de Faltas – Ley 9099", url: "/dashboard/legislation/viewer/codigo-contravencional-mendoza.pdf?province=mendoza" }
        ],
        "Jujuy": [
            { title: "Código Procesal Civil – Ley 1967", url: "/dashboard/legislation/viewer/codigo-procesal-civil-jujuy.pdf?province=jujuy" },
            { title: "Código Procesal Penal – Ley 3584", url: "/dashboard/legislation/viewer/codigo-procesal-penal-3584-jujuy.pdf?province=jujuy" },
            { title: "Código Procesal Penal – Ley 5623", url: "/dashboard/legislation/viewer/codigo-procesal-penal-5623-jujuy.pdf?province=jujuy" },
            { title: "CPP Fe de Erratas", url: "/dashboard/legislation/viewer/cpp-fe-erratas-jujuy.pdf?province=jujuy" },
            { title: "Código Procesal del Trabajo – Ley 1938", url: "/dashboard/legislation/viewer/codigo-procesal-trabajo-jujuy.pdf?province=jujuy" },
            { title: "Código Contencioso Administrativo – Ley 1888", url: "/dashboard/legislation/viewer/codigo-contencioso-administrativo-jujuy.pdf?province=jujuy" },
            { title: "Código de Procedimientos Mineros – Ley 5186", url: "/dashboard/legislation/viewer/codigo-procedimientos-mineros-jujuy.pdf?province=jujuy" },
            { title: "Código Electoral – Ley 4164", url: "/dashboard/legislation/viewer/codigo-electoral-jujuy.pdf?province=jujuy" },
            { title: "Código Fiscal – Ley 5791", url: "/dashboard/legislation/viewer/codigo-fiscal-jujuy.pdf?province=jujuy" }
        ],
        "La Pampa": [
            { title: "Código Procesal Civil y Comercial – Ley 1828", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-la-pampa.pdf?province=la-pampa" },
            { title: "Ley de Procedimiento Laboral (NJF 986)", url: "/dashboard/legislation/viewer/ley-procedimiento-laboral-la-pampa.pdf?province=la-pampa" },
            { title: "Compendio de Normas Electorales", url: "/dashboard/legislation/viewer/compendio-normas-electorales-la-pampa.pdf?province=la-pampa" },
            { title: "Código Procesal Penal – Ley 2287", url: "/dashboard/legislation/viewer/codigo-procesal-penal-la-pampa.pdf?province=la-pampa" }
        ],
        "La Rioja": [
            { title: "Código Procesal Civil y Comercial", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-la-rioja.pdf?province=la-rioja" },
            { title: "Código Procesal Penal", url: "/dashboard/legislation/viewer/codigo-procesal-penal-la-rioja.pdf?province=la-rioja" },
            { title: "Código de Procedimientos Mineros", url: "/dashboard/legislation/viewer/codigo-procedimientos-mineros-la-rioja.pdf?province=la-rioja" },
            { title: "Ley Orgánica de la Función Judicial", url: "/dashboard/legislation/viewer/ley-organica-funcion-judicial-la-rioja.pdf?province=la-rioja" },
            { title: "Ley Electoral Provincial", url: "/dashboard/legislation/viewer/ley-electoral-la-rioja.pdf?province=la-rioja" },
            { title: "Ley Orgánica de los Partidos Políticos", url: "/dashboard/legislation/viewer/ley-partidos-politicos-la-rioja.pdf?province=la-rioja" }
        ],
        "Misiones": [
            { title: "Cód. Procesal Civil, Comercial, Familia y Violencia – Ley XII Nº 27", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-misiones.pdf?province=misiones" },
            { title: "Código Fiscal – Ley XXII Nº 35", url: "/dashboard/legislation/viewer/codigo-fiscal-misiones.pdf?province=misiones" },
            { title: "Código de Faltas – Ley XIV Nº 5", url: "/dashboard/legislation/viewer/codigo-faltas-misiones.pdf?province=misiones" },
            { title: "Código de Procedimiento Laboral – Ley XIII Nº 2", url: "/dashboard/legislation/viewer/codigo-procedimiento-laboral-misiones.pdf?province=misiones" },
            { title: "Cód. Proc. Contencioso Administrativo – Ley I Nº 95", url: "/dashboard/legislation/viewer/codigo-contencioso-administrativo-misiones.pdf?province=misiones" },
            { title: "Código Procesal Penal – Ley XIV Nº 13", url: "/dashboard/legislation/viewer/codigo-procesal-penal-misiones.pdf?province=misiones" }
        ],
        "Neuquén": [
            { title: "Código Fiscal – Ley 2680", url: "/dashboard/legislation/viewer/codigo-fiscal-neuquen.pdf?province=neuquen" },
            { title: "Código Procesal Administrativo – Ley 1305", url: "/dashboard/legislation/viewer/codigo-procesal-administrativo-neuquen.pdf?province=neuquen" },
            { title: "Código Procesal Civil y Comercial – Ley 912", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-neuquen.pdf?province=neuquen" },
            { title: "Código Procesal Penal – Ley 3021", url: "/dashboard/legislation/viewer/codigo-procesal-penal-3021-neuquen.pdf?province=neuquen" },
            { title: "Código Procesal Penal – Ley 2784", url: "/dashboard/legislation/viewer/codigo-procesal-penal-2784-neuquen.pdf?province=neuquen" },
            { title: "Código de Procedimiento Minero – Ley 902", url: "/dashboard/legislation/viewer/codigo-procedimiento-minero-neuquen.pdf?province=neuquen" },
            { title: "Código Electoral – Ley 165", url: "/dashboard/legislation/viewer/codigo-electoral-neuquen.pdf?province=neuquen" }
        ],
        "Río Negro": [
            { title: "Código Procesal Civil y Comercial – Ley 4142", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-rio-negro.pdf?province=rio-negro" },
            { title: "Código de Faltas – Ley 532", url: "/dashboard/legislation/viewer/codigo-faltas-rio-negro.pdf?province=rio-negro" },
            { title: "Código Procesal Penal – Ley 2107", url: "/dashboard/legislation/viewer/codigo-procesal-penal-rio-negro.pdf?province=rio-negro" },
            { title: "Código de Procedimiento Minero – Ley 4941", url: "/dashboard/legislation/viewer/codigo-procedimiento-minero-rio-negro.pdf?province=rio-negro" },
            { title: "Código de Aguas – Ley 2952", url: "/dashboard/legislation/viewer/codigo-aguas-rio-negro.pdf?province=rio-negro" }
        ],
        "Salta": [
            { title: "Código Procesal Penal – Ley 7690", url: "/dashboard/legislation/viewer/codigo-procesal-penal-7690-salta.pdf?province=salta" },
            { title: "Código Procesal Penal – Ley 6345", url: "/dashboard/legislation/viewer/codigo-procesal-penal-6345-salta.pdf?province=salta" },
            { title: "Código Fiscal – Decreto Ley 9/1975", url: "/dashboard/legislation/viewer/codigo-fiscal-salta.pdf?province=salta" },
            { title: "Código Contravencional – Ley 7135", url: "/dashboard/legislation/viewer/codigo-contravencional-salta.pdf?province=salta" },
            { title: "Código Procesal Civil y Comercial – Ley 5233", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-salta.pdf?province=salta" },
            { title: "Código de Procedimientos Mineros – Ley 7141", url: "/dashboard/legislation/viewer/codigo-procedimientos-mineros-salta.pdf?province=salta" },
            { title: "Código Procesal Laboral – Ley 528", url: "/dashboard/legislation/viewer/codigo-procesal-laboral-salta.pdf?province=salta" },
            { title: "Cód. Proc. Contencioso Administrativo – Ley 793", url: "/dashboard/legislation/viewer/codigo-contencioso-administrativo-salta.pdf?province=salta" }
        ],
        "San Juan": [
            { title: "Cód. Procesal Civil, Comercial y Minería – Ley 988", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-mineria-san-juan.pdf?province=san-juan" },
            { title: "Código Procesal Penal – Ley 754", url: "/dashboard/legislation/viewer/codigo-procesal-penal-san-juan.pdf?province=san-juan" },
            { title: "Código de Procedimiento Laboral – Ley 337", url: "/dashboard/legislation/viewer/codigo-procedimiento-laboral-san-juan.pdf?province=san-juan" },
            { title: "Código de Faltas – Ley 941", url: "/dashboard/legislation/viewer/codigo-faltas-san-juan.pdf?province=san-juan" },
            { title: "Código Tributario – Ley 151", url: "/dashboard/legislation/viewer/codigo-tributario-san-juan.pdf?province=san-juan" },
            { title: "Código de Procedimiento Minero – Ley 688", url: "/dashboard/legislation/viewer/codigo-procedimiento-minero-san-juan.pdf?province=san-juan" },
            { title: "Código Sanitario – Ley 67", url: "/dashboard/legislation/viewer/codigo-sanitario-san-juan.pdf?province=san-juan" },
            { title: "Código Electoral – Ley 1268", url: "/dashboard/legislation/viewer/codigo-electoral-san-juan.pdf?province=san-juan" },
            { title: "Cód. Derechos Consumidores y Usuarios – Ley 898", url: "/dashboard/legislation/viewer/codigo-consumidores-san-juan.pdf?province=san-juan" }
        ],
        "San Luis": [
            { title: "Código Procesal Civil y Comercial – Ley VI-0150", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-san-luis.pdf?province=san-luis" },
            { title: "Código Tributario – Ley 490", url: "/dashboard/legislation/viewer/codigo-tributario-san-luis.pdf?province=san-luis" },
            { title: "Código Procesal Criminal – Ley VI-0152", url: "/dashboard/legislation/viewer/codigo-procesal-criminal-san-luis.pdf?province=san-luis" },
            { title: "Código Procesal Laboral – Ley VI-0711", url: "/dashboard/legislation/viewer/codigo-procesal-laboral-san-luis.pdf?province=san-luis" },
            { title: "Cód. Derechos Consumidores y Usuarios – Ley 7714", url: "/dashboard/legislation/viewer/codigo-consumidores-san-luis.pdf?province=san-luis" },
            { title: "Código Contravencional – Ley 1000", url: "/dashboard/legislation/viewer/codigo-contravencional-san-luis.pdf?province=san-luis" },
            { title: "Código de Procedimientos Mineros – Ley VI-0157", url: "/dashboard/legislation/viewer/codigo-procedimientos-mineros-san-luis.pdf?province=san-luis" },
            { title: "Código de Procedimientos Administrativos – Ley 5540", url: "/dashboard/legislation/viewer/codigo-procedimientos-administrativos-san-luis.pdf?province=san-luis" },
            { title: "Código Rural – Ley 5553", url: "/dashboard/legislation/viewer/codigo-rural-san-luis.pdf?province=san-luis" },
            { title: "Código de Aguas – Ley 0671", url: "/dashboard/legislation/viewer/codigo-aguas-san-luis.pdf?province=san-luis" }
        ],
        "Santa Cruz": [
            { title: "Cód. Procesal Civil y Comercial – Ley 1418", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-1418-santa-cruz.pdf?province=santa-cruz" },
            { title: "Cód. Procesal Civil y Comercial – Ley 3453", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-3453-santa-cruz.pdf?province=santa-cruz" },
            { title: "Código Procesal Penal – Ley 2424", url: "/dashboard/legislation/viewer/codigo-procesal-penal-santa-cruz.pdf?province=santa-cruz" },
            { title: "Cód. Proc. Contencioso Administrativo – Ley 2600", url: "/dashboard/legislation/viewer/codigo-contencioso-administrativo-santa-cruz.pdf?province=santa-cruz" },
            { title: "Código de Faltas – Ley 3125", url: "/dashboard/legislation/viewer/codigo-faltas-santa-cruz.pdf?province=santa-cruz" },
            { title: "Código Fiscal – Ley 3486", url: "/dashboard/legislation/viewer/codigo-fiscal-santa-cruz.pdf?province=santa-cruz" },
            { title: "Código de Edificación – Ley 2654", url: "/dashboard/legislation/viewer/codigo-edificacion-santa-cruz.pdf?province=santa-cruz" },
            { title: "Código de Procedimientos Mineros – Ley 990", url: "/dashboard/legislation/viewer/codigo-procedimientos-mineros-santa-cruz.pdf?province=santa-cruz" }
        ],
        "Santa Fe": [
            { title: "Código Procesal Civil y Comercial – Ley 5531", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-santa-fe.pdf?province=santa-fe" },
            { title: "Código Procesal Penal – Ley 12734", url: "/dashboard/legislation/viewer/codigo-procesal-penal-santa-fe.pdf?province=santa-fe" },
            { title: "Código Procesal Laboral – Ley 7945", url: "/dashboard/legislation/viewer/codigo-procesal-laboral-santa-fe.pdf?province=santa-fe" },
            { title: "Cód. Procesal Laboral – Ley 13840 (mod.)", url: "/dashboard/legislation/viewer/codigo-procesal-laboral-13840-santa-fe.pdf?province=santa-fe" },
            { title: "Código de Faltas – Ley 10703", url: "/dashboard/legislation/viewer/codigo-faltas-santa-fe.pdf?province=santa-fe" },
            { title: "Código Procesal de Menores – Ley 11452", url: "/dashboard/legislation/viewer/codigo-procesal-menores-santa-fe.pdf?province=santa-fe" },
            { title: "Código de Convivencia – Ley 13774", url: "/dashboard/legislation/viewer/codigo-convivencia-santa-fe.pdf?province=santa-fe" },
            { title: "Código Fiscal – Ley 3456", url: "/dashboard/legislation/viewer/codigo-fiscal-santa-fe.pdf?province=santa-fe" },
            { title: "Código Tributario Municipal – Ley 8173", url: "/dashboard/legislation/viewer/codigo-tributario-municipal-santa-fe.pdf?province=santa-fe" }
        ],
        "Santiago del Estero": [
            { title: "Código Electoral – Ley 6908", url: "/dashboard/legislation/viewer/codigo-electoral-santiago.pdf?province=santiago-del-estero" },
            { title: "Código de Faltas – Ley 6906", url: "/dashboard/legislation/viewer/codigo-faltas-santiago.pdf?province=santiago-del-estero" },
            { title: "Código Fiscal – Ley 6792", url: "/dashboard/legislation/viewer/codigo-fiscal-santiago.pdf?province=santiago-del-estero" },
            { title: "Cód. Procedimientos Minero – Ley 6920", url: "/dashboard/legislation/viewer/codigo-procedimientos-minero-santiago.pdf?province=santiago-del-estero" },
            { title: "Cód. Procedimiento Laboral – Ley 3603", url: "/dashboard/legislation/viewer/codigo-procedimiento-laboral-3603-santiago.pdf?province=santiago-del-estero" },
            { title: "Cód. Procedimiento Laboral – Ley 7049", url: "/dashboard/legislation/viewer/codigo-procedimiento-laboral-7049-santiago.pdf?province=santiago-del-estero" },
            { title: "Cód. Procesal Civil y Comercial – Ley 6910", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-santiago.pdf?province=santiago-del-estero" },
            { title: "Código Procesal Penal – Ley 1733", url: "/dashboard/legislation/viewer/codigo-procesal-penal-1733-santiago.pdf?province=santiago-del-estero" },
            { title: "Código Procesal Penal – Ley 6941", url: "/dashboard/legislation/viewer/codigo-procesal-penal-6941-santiago.pdf?province=santiago-del-estero" },
            { title: "Cód. Procesal Penal Transición – Ley 6986", url: "/dashboard/legislation/viewer/codigo-procesal-penal-6986-santiago.pdf?province=santiago-del-estero" },
            { title: "Cód. Proc. Contencioso Administrativo – Ley 2297", url: "/dashboard/legislation/viewer/codigo-contencioso-administrativo-santiago.pdf?province=santiago-del-estero" },
            { title: "Código Trámite Administrativo – Ley 2296", url: "/dashboard/legislation/viewer/codigo-tramite-administrativo-santiago.pdf?province=santiago-del-estero" }
        ],
        "Tierra del Fuego": [
            { title: "Cód. Proc. Civil, Comercial, Laboral, Rural y Minero – Ley 147", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-laboral-tdf.pdf?province=tierra-del-fuego" },
            { title: "Código Procesal Penal – Ley 168", url: "/dashboard/legislation/viewer/codigo-procesal-penal-tdf.pdf?province=tierra-del-fuego" },
            { title: "Cód. Contencioso Administrativo – Ley 133", url: "/dashboard/legislation/viewer/codigo-contencioso-administrativo-tdf.pdf?province=tierra-del-fuego" },
            { title: "Código Contravencional – Ley 1024", url: "/dashboard/legislation/viewer/codigo-contravencional-tdf.pdf?province=tierra-del-fuego" },
            { title: "Ley de Procedimiento Administrativo – Ley 141", url: "/dashboard/legislation/viewer/codigo-procedimiento-administrativo-tdf.pdf?province=tierra-del-fuego" },
            { title: "Régimen Electoral – Ley 201", url: "/dashboard/legislation/viewer/codigo-electoral-tdf.pdf?province=tierra-del-fuego" },
            { title: "Ley de Registro de Propiedad Inmueble – Ley 532", url: "/dashboard/legislation/viewer/codigo-registro-propiedad-tdf.pdf?province=tierra-del-fuego" }
        ],
        "Tucumán": [
            { title: "Código Procesal Civil y Comercial – Ley 6176", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-tucuman.pdf?province=tucuman" },
            { title: "Código Procesal Laboral – Ley 6204 (TO)", url: "/dashboard/legislation/viewer/codigo-procesal-laboral-tucuman.pdf?province=tucuman" },
            { title: "Código Procesal Penal – Ley 6203 (TO 8268)", url: "/dashboard/legislation/viewer/codigo-procesal-penal-6203-tucuman.pdf?province=tucuman" },
            { title: "Nuevo Código Procesal Penal – Ley 8933", url: "/dashboard/legislation/viewer/codigo-procesal-penal-8933-tucuman.pdf?province=tucuman" },
            { title: "Implementación Nuevo CPP – Ley 9675", url: "/dashboard/legislation/viewer/codigo-implementacion-cpp-tucuman.pdf?province=tucuman" },
            { title: "Código Procesal Constitucional – Ley 6944", url: "/dashboard/legislation/viewer/codigo-procesal-constitucional-tucuman.pdf?province=tucuman" },
            { title: "Código Procesal Administrativo – Ley 6205", url: "/dashboard/legislation/viewer/codigo-procesal-administrativo-tucuman.pdf?province=tucuman" }
        ]
    };

    const jurisdictions = Object.keys(proceduralData);

    return (
        <div className="legislation-container">


            <nav className="legislation-nav">
                <div className="breadcrumb">
                    <Link href="/dashboard" className="breadcrumb-item">Gabinete</Link>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-current">Legislación (InfoLeg)</span>
                </div>
            </nav>

            <header className="legislation-header">
                <div className="header-content">
                    <h1><Scale size={32} className="inline-icon" /> Digesto Jurídico</h1>
                    <p>Fuente oficial unificada. Códigos y leyes de aplicación frecuente.</p>
                </div>
                <UsageGuide content={dashboardManuals.legislation} />

                {/* INFOLEG SEARCH BAR */}
                {/* INFOLEG SEARCH BAR */}
                <div className="infoleg-search glass-panel">
                    {/* Search Tabs */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                        <button
                            onClick={() => setSearchMode('norma')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: searchMode === 'norma' ? '#fbbf24' : '#94a3b8',
                                borderBottom: searchMode === 'norma' ? '2px solid #fbbf24' : '2px solid transparent',
                                padding: '0.5rem 0',
                                cursor: 'pointer',
                                fontWeight: 500
                            }}
                        >
                            Buscar por Norma
                        </button>
                        <button
                            onClick={() => setSearchMode('boletin')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: searchMode === 'boletin' ? '#fbbf24' : '#94a3b8',
                                borderBottom: searchMode === 'boletin' ? '2px solid #fbbf24' : '2px solid transparent',
                                padding: '0.5rem 0',
                                cursor: 'pointer',
                                fontWeight: 500
                            }}
                        >
                            Buscar por Boletín Oficial
                        </button>
                    </div>

                    <form onSubmit={handleSearch}>
                        {searchMode === 'norma' ? (
                            <div className="search-grid">
                                {/* Tipo de Norma */}
                                <div className="search-field col-span-2">
                                    <label htmlFor="leg_tipo">Tipo de Norma</label>
                                    <select
                                        id="leg_tipo"
                                        name="tipo_norma"
                                        autoComplete="off"
                                        className="search-select"
                                        value={searchState.tipo}
                                        onChange={(e) => setSearchState({ ...searchState, tipo: e.target.value })}
                                    >
                                        <option value="">Todos los tipos</option>
                                        <option value="Ley">Ley</option>
                                        <option value="Decreto">Decreto</option>
                                        <option value="Resolución">Resolución</option>
                                        <option value="Disposición">Disposición</option>
                                        <option value="Decisión Administrativa">Decisión Administrativa</option>
                                        <option value="Acordada">Acordada</option>
                                        <option value="Acta">Acta</option>
                                        <option value="Acuerdo">Acuerdo</option>
                                        <option value="Circular">Circular</option>
                                        <option value="Comunicación">Comunicación</option>
                                        <option value="Convenio">Convenio</option>
                                        <option value="Laudo">Laudo</option>
                                        <option value="Nota">Nota</option>
                                        <option value="Ordenanza">Ordenanza</option>
                                    </select>
                                </div>

                                {/* Número */}
                                <div className="search-field">
                                    <label htmlFor="leg_numero">Número</label>
                                    <input
                                        id="leg_numero"
                                        name="numero_norma"
                                        autoComplete="off"
                                        type="text"
                                        className="search-input"
                                        placeholder="Ej: 27448"
                                        value={searchState.numero}
                                        onChange={(e) => setSearchState({ ...searchState, numero: e.target.value })}
                                    />
                                </div>

                                {/* Año */}
                                <div className="search-field">
                                    <label htmlFor="leg_anio">Año</label>
                                    <input
                                        id="leg_anio"
                                        name="anio_norma"
                                        autoComplete="off"
                                        type="text"
                                        className="search-input"
                                        placeholder="Ej: 2024"
                                        value={searchState.anio}
                                        onChange={(e) => setSearchState({ ...searchState, anio: e.target.value })}
                                    />
                                </div>

                                {/* Texto Libre */}
                                <div className="search-field col-span-4">
                                    <label htmlFor="leg_texto">Texto / Palabras Clave</label>
                                    <input
                                        id="leg_texto"
                                        name="texto_busqueda"
                                        autoComplete="off"
                                        type="text"
                                        className="search-input"
                                        placeholder="Ingrese términos de búsqueda..."
                                        value={searchState.texto}
                                        onChange={(e) => setSearchState({ ...searchState, texto: e.target.value })}
                                    />
                                </div>
                            </div>
                        ) : (
                            /* BOLETIN OFICIAL FORM */
                            <div className="search-grid">
                                <div className="search-field col-span-4" style={{ flexDirection: 'row', gap: '2rem', marginBottom: '1rem' }}>
                                    <label htmlFor="bo_type_fecha" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'white' }}>
                                        <input
                                            id="bo_type_fecha"
                                            type="radio"
                                            name="boType"
                                            checked={boState.type === 'fecha'}
                                            onChange={() => setBoState({ ...boState, type: 'fecha' })}
                                        />
                                        Fecha de Publicación
                                    </label>
                                    <label htmlFor="bo_type_numero" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'white' }}>
                                        <input
                                            id="bo_type_numero"
                                            type="radio"
                                            name="boType"
                                            checked={boState.type === 'numero'}
                                            onChange={() => setBoState({ ...boState, type: 'numero' })}
                                        />
                                        Nro. de Boletín
                                    </label>
                                </div>

                                {boState.type === 'fecha' ? (
                                    <div className="search-field col-span-2">
                                        <label htmlFor="bo_fecha">Fecha (dd/mm/aaaa)</label>
                                        <input
                                            id="bo_fecha"
                                            name="bo_fecha"
                                            type="text"
                                            className="search-input"
                                            placeholder="Ej: 25/05/2023"
                                            value={boState.fecha}
                                            onChange={(e) => setBoState({ ...boState, fecha: e.target.value })}
                                        />
                                    </div>
                                ) : (
                                    <div className="search-field col-span-2">
                                        <label htmlFor="bo_numero">Número de Boletín</label>
                                        <input
                                            id="bo_numero"
                                            name="bo_numero"
                                            type="text"
                                            className="search-input"
                                            placeholder="Ej: 35123"
                                            value={boState.numero}
                                            onChange={(e) => setBoState({ ...boState, numero: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="search-actions">
                            <button type="submit" className="btn-search">
                                <Search size={18} />
                                {searchMode === 'norma' ? 'Buscar en InfoLeg' : 'Buscar Boletín'}
                            </button>
                        </div>
                    </form>
                </div>
            </header>

            <div className="legislation-layout">

                {/* SECTION 1: CÓDIGOS DE FONDO */}
                <section className="legislation-section">
                    <div className="section-head">
                        <div className="icon-badge amber">
                            <Book size={20} />
                        </div>
                        <div>
                            <h2>Códigos de Fondo</h2>
                            <p className="section-desc">Normas sustantivas de aplicación nacional (Congreso Nacional).</p>
                        </div>
                    </div>

                    <div className="codes-grid">
                        {codesFondo.map((code, index) => (
                            <Link
                                key={index}
                                href={code.url}
                                target={code.url.startsWith('/dashboard') ? "_self" : "_blank"}
                                rel={code.url.startsWith('/dashboard') ? "" : "noopener noreferrer"}
                                className="code-card glass-panel"
                            >
                                <div className="card-top">
                                    {code.icon}
                                    <span className="arrow">{code.url.startsWith('/dashboard') ? "→" : "↗"}</span>
                                </div>
                                <div className="code-info">
                                    <h3>{code.title}</h3>
                                    <p>{code.desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                <div className="divider"></div>

                {/* SECTION 2: LEYES ESPECIALES */}
                <section className="legislation-section">
                    <div className="section-head">
                        <div className="icon-badge blue">
                            <Scroll size={20} />
                        </div>
                        <div>
                            <h2>Leyes Especiales</h2>
                            <p className="section-desc">Normativa complementaria de uso frecuente.</p>
                        </div>
                    </div>

                    <div className="codes-grid">
                        {specialLaws.map((law, index) => (
                            <Link
                                key={index}
                                href={law.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="code-card glass-panel"
                            >
                                <div className="card-top">
                                    {law.icon}
                                    <span className="arrow">↗</span>
                                </div>
                                <div className="code-info">
                                    <h3>{law.title}</h3>
                                    <p>{law.desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                <div className="divider"></div>

                {/* SECTION 3: CÓDIGOS DE FORMA (COLLAPSIBLE) */}
                <section className="legislation-section">
                    <div
                        className="section-head collapsible-header"
                        onClick={() => setIsProceduralExpanded(!isProceduralExpanded)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="icon-badge blue">
                            <Map size={20} />
                        </div>
                        <div className="head-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div>
                                    <h2>Códigos de Forma (Procesales)</h2>
                                    <p className="section-desc">Reglas de procedimiento según la jurisdicción competente.</p>
                                </div>
                                <span style={{
                                    fontSize: '1.2rem',
                                    color: '#94a3b8',
                                    transition: 'transform 0.2s',
                                    transform: isProceduralExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                                }}>
                                    ▼
                                </span>
                            </div>
                        </div>
                    </div>

                    {isProceduralExpanded && (
                        <>
                            {/* JURISDICTION SELECTOR */}
                            <div className="jurisdiction-select-wrapper" style={{ marginBottom: '1.5rem' }}>
                                <label htmlFor="leg_jurisdiction_select" className="sr-only">Seleccionar Jurisdicción de Códigos de Forma</label>
                                <select
                                    id="leg_jurisdiction_select"
                                    name="jurisdiction"
                                    value={selectedJurisdiction}
                                    onChange={(e) => setSelectedJurisdiction(e.target.value)}
                                    className="jurisdiction-select"
                                >
                                    {jurisdictions.map(j => <option key={j} value={j}>{j}</option>)}
                                </select>
                            </div>

                            <div className="procedural-list">
                                {proceduralData[selectedJurisdiction]?.map((norm, index) => (
                                    <a
                                        key={index}
                                        href={norm.url}
                                        target={norm.url.startsWith('/dashboard') ? "_self" : "_blank"}
                                        rel={norm.url.startsWith('/dashboard') ? "" : "noopener noreferrer"}
                                        className="proc-item glass-panel"
                                    >
                                        <div className="proc-icon">
                                            <FileText size={20} className="text-blue-400" />
                                        </div>
                                        <div className="proc-content">
                                            <h3>{norm.title}</h3>
                                            <span className="jurisdiction-tag">{selectedJurisdiction}</span>
                                        </div>
                                        <div className="proc-action">
                                            Ver Norma →
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </>
                    )}
                </section>

                <div className="divider"></div>

                {/* SECTION 4: RECURSOS TEMÁTICOS */}
                <section className="legislation-section">
                    <div className="section-head">
                        <div className="icon-badge amber">
                            <Globe size={20} />
                        </div>
                        <div>
                            <h2>Recursos Temáticos</h2>
                            <p className="section-desc">Recopilaciones oficiales y boletines.</p>
                        </div>
                    </div>

                    <div className="resources-grid">
                        <a href="https://www.infoleg.gob.ar/?page_id=63" target="_blank" rel="noopener noreferrer" className="resource-card glass-panel">
                            <div className="resource-icon"><Landmark size={18} /></div>
                            <h3>Constitución Nacional</h3>
                            <p>Texto completo de la C.N. con reformas.</p>
                        </a>
                        <a href="https://www.infoleg.gob.ar/?page_id=87" target="_blank" rel="noopener noreferrer" className="resource-card glass-panel">
                            <div className="resource-icon"><Map size={18} /></div>
                            <h3>Códigos Provinciales</h3>
                            <p>Acceso a códigos procesales y constituciones locales.</p>
                        </a>
                        <a href="https://www.infoleg.gob.ar/?page_id=55" target="_blank" rel="noopener noreferrer" className="resource-card glass-panel highlight">
                            <div className="resource-icon"><Globe size={18} className="text-amber-400" /></div>
                            <h3>Constituciones Internacionales</h3>
                            <p>Instrumentos de DDHH (Jerarquía Constitucional).</p>
                        </a>
                        <a href="https://www.dnrpa.gov.ar/portal_dnrpa/" target="_blank" rel="noopener noreferrer" className="resource-card glass-panel">
                            <div className="resource-icon"><Briefcase size={18} /></div>
                            <h3>Digesto Registral</h3>
                            <p>Portal DNRPA (Normativa del Automotor).</p>
                        </a>
                        <a href="https://www.infoleg.gob.ar/?page_id=103" target="_blank" rel="noopener noreferrer" className="resource-card glass-panel">
                            <div className="resource-icon"><Users size={18} /></div>
                            <h3>Empleo Público</h3>
                            <p>Normativa Marco (Ley 25.164 y Decretos).</p>
                        </a>
                        <a href="https://www.boletinoficial.gob.ar/" target="_blank" rel="noopener noreferrer" className="resource-card glass-panel">
                            <div className="resource-icon"><FileText size={18} /></div>
                            <h3>Boletín Oficial</h3>
                            <p>Publicación diaria de normas oficiales.</p>
                        </a>
                        <a href="https://www.saij.gob.ar/" target="_blank" rel="noopener noreferrer" className="resource-card glass-panel">
                            <div className="resource-icon"><Gavel size={18} /></div>
                            <h3>SAIJ</h3>
                            <p>Sistema Argentino de Información Jurídica.</p>
                        </a>
                    </div>
                </section>
            </div>
        </div>
    );
}
