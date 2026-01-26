"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Book, Gavel, FileText, Scale, Search, Map, Globe, Shield, Pickaxe, Utensils, Landmark, Scroll, Users, Briefcase, HeartHandshake } from 'lucide-react';

export default function LegislationPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedJurisdiction, setSelectedJurisdiction] = useState('Nación');

    const handleSearch = (e) => {
        e.preventDefault();
        if (!searchQuery) return;
        // Smart Search: Use Google Site Search for reliable InfoLeg results
        const url = `https://www.google.com/search?q=site:infoleg.gob.ar+${encodeURIComponent(searchQuery)}`;
        window.open(url, '_blank');
    };

    // 1. CÓDIGOS DE FONDO (SUSTANTIVOS) - NACIONALES
    const codesFondo = [
        {
            title: "Constitución Nacional",
            desc: "Ley suprema. Derechos, garantías y organización del Estado.",
            url: "/dashboard/legislation/viewer/constitucion-nacional.pdf?province=nacion",
            icon: <Landmark size={28} className="text-amber-400" />
        },
        {
            title: "Código Civil y Comercial de la Nación",
            desc: "Regula las relaciones civiles y comerciales.",
            url: "/dashboard/legislation/viewer/codigo-civil-comercial-nacion.pdf?province=nacion",
            icon: <Scale size={28} className="text-amber-400" />
        },
        {
            title: "Código Penal de la Nación",
            desc: "Delitos y penas en el territorio argentino.",
            url: "/dashboard/legislation/viewer/codigo-penal-nacion.pdf?province=nacion",
            icon: <Gavel size={28} className="text-amber-400" />
        },
        {
            title: "Ley de Contrato de Trabajo (20.744)",
            desc: "Régimen de contrato de trabajo (Sector Privado).",
            url: "/dashboard/legislation/viewer/ley-contrato-trabajo.pdf?province=nacion",
            icon: <FileText size={28} className="text-amber-400" />
        },
        {
            title: "Código de Minería",
            desc: "Régimen legal de las minas y su explotación.",
            url: "/dashboard/legislation/viewer/codigo-mineria.pdf?province=nacion",
            icon: <Pickaxe size={28} className="text-amber-400" />
        },
        {
            title: "Código Aduanero",
            desc: "Disposiciones sobre el tráfico internacional.",
            url: "/dashboard/legislation/viewer/codigo-aduanero.pdf?province=nacion",
            icon: <Globe size={28} className="text-amber-400" />
        },
        {
            title: "Código Aeronáutico",
            desc: "Rige la aeronáutica civil en el territorio.",
            url: "/dashboard/legislation/viewer/codigo-aeronautico.pdf?province=nacion",
            icon: <Shield size={28} className="text-amber-400" />
        },
        {
            title: "Código Alimentario Argentino",
            desc: "Normas higiénico-sanitarias y bromatológicas.",
            url: "/dashboard/legislation/viewer/codigo-alimentario.pdf?province=nacion",
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
        }
    ];

    // 2. LEYES ESPECIALES Y COMPLEMENTARIAS
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
        "Nación": [
            { title: "Código Civil y Comercial de la Nación", url: "/dashboard/legislation/viewer/codigo-civil-comercial-nacion.pdf?province=nacion" },
            { title: "Código Penal de la Nación", url: "/dashboard/legislation/viewer/codigo-penal-nacion.pdf?province=nacion" },
            { title: "Código Procesal Civil y Comercial", url: "/dashboard/legislation/viewer/codigo-procesal-civil-comercial-nacion.pdf?province=nacion" },
            { title: "Código Procesal Penal Federal", url: "/dashboard/legislation/viewer/codigo-procesal-penal-federal.pdf?province=nacion" },
            { title: "Código Procesal Penal (Ley 27.063)", url: "/dashboard/legislation/viewer/codigo-procesal-penal-27063.pdf?province=nacion" },
            { title: "Código Aduanero", url: "/dashboard/legislation/viewer/codigo-aduanero.pdf?province=nacion" },
            { title: "Código Aeronáutico", url: "/dashboard/legislation/viewer/codigo-aeronautico.pdf?province=nacion" },
            { title: "Código de Minería", url: "/dashboard/legislation/viewer/codigo-mineria.pdf?province=nacion" },
            { title: "Código Alimentario Argentino", url: "/dashboard/legislation/viewer/codigo-alimentario.pdf?province=nacion" },
            { title: "Código Alimentario (ANMAT)", url: "https://www.argentina.gob.ar/anmat/codigoalimentario" },
            { title: "Código de Ética Pública", url: "/dashboard/legislation/viewer/codigo-etica-publica.pdf?province=nacion" },
            { title: "Código Electoral Nacional", url: "/dashboard/legislation/viewer/codigo-electoral-nacional.pdf?province=nacion" },
            { title: "Reglamento para la Justicia Nacional", url: "https://www.pjn.gov.ar/" }
        ],
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
            { title: "Código Procesal Civil, Comercial y Tributario", url: "http://www.jus.mendoza.gov.ar/" }
        ]
    };

    const jurisdictions = Object.keys(proceduralData);

    return (
        <div className="legislation-container">
            <style jsx>{`
                .inline-icon { vertical-align: middle; margin-right: 0.5rem; color: #fbbf24; }
                .resource-icon { margin-bottom: 0.5rem; color: #94a3b8; }
                .legislation-container { padding: 0 3rem 4rem; max-width: 1200px; margin: 0 auto; color: white; }
                
                @media (max-width: 900px) {
                    .legislation-container { padding: 0 1.5rem 2rem; }
                }

                .breadcrumb { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 2rem; color: #94a3b8; }
                .breadcrumb-item { color: #94a3b8; text-decoration: none; transition: 0.2s; }
                .breadcrumb-item:hover { color: #fbbf24; }
                .breadcrumb-separator { opacity: 0.5; }

                .legislation-header { margin-bottom: 3rem; text-align: center; }
                .header-content h1 { font-size: 2.5rem; margin-bottom: 0.5rem; background: linear-gradient(to right, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .header-content p { color: #94a3b8; margin-bottom: 2rem; font-size: 1.1rem; }

                /* SEARCH BAR REFINED */
                .infoleg-search {
                    margin: 0 auto;
                    padding: 0.4rem;
                    border-radius: 999px;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: rgba(15, 23, 42, 0.8);
                    max-width: 700px;
                    box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5);
                    transition: all 0.2s;
                }
                .infoleg-search:focus-within {
                    border-color: #fbbf24;
                    box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1);
                    transform: scale(1.01);
                }
                .search-form { display: flex; align-items: center; gap: 0.5rem; }
                .search-icon-wrapper {
                    display: flex; align-items: center; gap: 0.4rem;
                    background: rgba(255,255,255,0.05);
                    padding: 0.5rem 1rem;
                    border-radius: 999px;
                    color: #fbbf24;
                    font-weight: 600;
                    font-size: 0.85rem;
                }
                .search-form input {
                    flex: 1; background: transparent; border: none; color: white;
                    font-size: 1rem; padding: 0.5rem; outline: none;
                }
                .search-form button {
                    background: #fbbf24; color: #020617; border: none;
                    padding: 0.6rem 1.5rem; border-radius: 999px;
                    font-weight: 700; cursor: pointer; transition: 0.2s;
                }
                .search-form button:hover { background: #f59e0b; }

                /* SECTIONS */
                .legislation-layout { display: flex; flex-direction: column; gap: 3rem; }
                
                .section-head { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; }
                .section-head .head-row { display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 1rem; }
                
                .icon-badge {
                    width: 48px; height: 48px; border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                .icon-badge.amber { background: rgba(251, 191, 36, 0.1); color: #fbbf24; }
                .icon-badge.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

                .section-head h2 { font-size: 1.4rem; margin: 0; color: #f8fafc; }
                .section-desc { margin: 0.2rem 0 0 0; color: #94a3b8; font-size: 0.9rem; }

                .divider { height: 1px; background: linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent); }

                /* CODES GRID (FONDO) */
                .codes-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                    gap: 1.2rem;
                }
                .code-card {
                    padding: 1.5rem;
                    background: rgba(30, 41, 59, 0.4);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 16px;
                    text-decoration: none;
                    transition: all 0.2s;
                    display: flex; flex-direction: column; gap: 1rem;
                }
                .code-card:hover { 
                    border-color: rgba(251, 191, 36, 0.3);
                    background: rgba(30, 41, 59, 0.7);
                    transform: translateY(-4px); 
                }
                .card-top { display: flex; justify-content: space-between; align-items: flex-start; }
                .arrow { color: #525252; font-size: 1.2rem; transition: 0.2s; }
                .code-card:hover .arrow { color: #fbbf24; transform: translate(2px, -2px); }
                
                .code-info h3 { margin: 0; font-size: 1rem; color: #e2e8f0; line-height: 1.3; }
                .code-info p { margin: 0.5rem 0 0 0; font-size: 0.8rem; color: #94a3b8; line-height: 1.4; }

                /* PROCEDURAL LIST (FORMA) */
                .jurisdiction-select {
                    background: #0f172a;
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    color: white;
                    padding: 0.6rem 2rem 0.6rem 1rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    outline: none;
                    min-width: 200px;
                }
                .jurisdiction-select:focus { border-color: #3b82f6; }

                .procedural-list { display: grid; grid-template-columns: 1fr; gap: 0.8rem; }
                .proc-item {
                    display: flex; align-items: center; gap: 1rem;
                    padding: 1rem;
                    background: rgba(30, 41, 59, 0.3);
                    border: 1px solid rgba(255,255,255,0.03);
                    border-radius: 12px;
                    text-decoration: none;
                    transition: 0.2s;
                }
                .proc-item:hover {
                    background: rgba(30, 41, 59, 0.6);
                    border-color: #3b82f6;
                    transform: translateX(4px);
                }
                .proc-icon { font-size: 1.5rem; }
                .proc-content { flex: 1; }
                .proc-content h3 { margin: 0; font-size: 1rem; color: #e2e8f0; }
                .jurisdiction-tag {
                    display: inline-block; margin-top: 0.3rem;
                    font-size: 0.7rem; background: rgba(59, 130, 246, 0.1);
                    color: #60a5fa; padding: 0.1rem 0.4rem; border-radius: 4px;
                }
                .proc-action { font-size: 0.85rem; color: #94a3b8; font-weight: 500; }
                .proc-item:hover .proc-action { color: #60a5fa; }

                .resources-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 1rem;
                }

                .resource-card {
                    padding: 1.2rem;
                    background: rgba(30, 41, 59, 0.4);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 12px;
                    text-decoration: none;
                    transition: 0.2s;
                    display: flex; flex-direction: column; gap: 0.5rem;
                }

                .resource-card:hover { 
                    background: rgba(30, 41, 59, 0.6);
                    border-color: #fbbf24;
                    transform: translateY(-3px);
                }

                .resource-card h3 { font-size: 0.95rem; color: #f1f5f9; margin: 0; font-weight: 600; }
                .resource-card p { font-size: 0.8rem; color: #94a3b8; margin: 0; line-height: 1.4; }
                
                .resource-card.highlight { border-left: 3px solid #fbbf24; }

                @media (max-width: 600px) {
                    .header-content h1 { font-size: 2rem; }
                    .search-form { flex-direction: column; align-items: stretch; }
                    .search-icon-wrapper { justify-content: center; }
                    .head-row { flex-direction: column; align-items: flex-start; }
                    .jurisdiction-select { width: 100%; }
                }
            `}</style>

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

                {/* INFOLEG SEARCH BAR */}
                <div className="infoleg-search glass-panel">
                    <form onSubmit={handleSearch} className="search-form">
                        <div className="search-icon-wrapper">
                            <Search size={18} />
                            <span className="search-label">InfoLeg</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar leyes, decretos o normas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button type="submit">Buscar</button>
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

                {/* SECTION 3: CÓDIGOS DE FORMA */}
                <section className="legislation-section">
                    <div className="section-head">
                        <div className="icon-badge blue">
                            <Map size={20} />
                        </div>
                        <div className="head-row">
                            <div>
                                <h2>Códigos de Forma (Procesales)</h2>
                                <p className="section-desc">Reglas de procedimiento según la jurisdicción competente.</p>
                            </div>

                            {/* JURISDICTION SELECTOR */}
                            <div className="jurisdiction-select-wrapper">
                                <select
                                    value={selectedJurisdiction}
                                    onChange={(e) => setSelectedJurisdiction(e.target.value)}
                                    className="jurisdiction-select"
                                >
                                    {jurisdictions.map(j => <option key={j} value={j}>{j}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="procedural-list">
                        {proceduralData[selectedJurisdiction]?.map((norm, index) => (
                            <a
                                key={index}
                                href={norm.url}
                                target="_blank"
                                rel="noopener noreferrer"
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
                        <a href="http://www.saij.gob.ar/" target="_blank" rel="noopener noreferrer" className="resource-card glass-panel">
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
