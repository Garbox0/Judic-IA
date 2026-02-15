"use client";
import { useRef, useState, useEffect } from 'react';
import { Settings, Users, ChevronLeft, ChevronRight } from 'lucide-react';

const guides = [
    {
        id: 1,
        title: "Inicio de Sesión",
        desc: "Accede de forma segura a tu panel de control.",
        video: "/videos/1.Guia%20de%20login%20abogadol.mp4",
        icon: Users
    },
    {
        id: 2,
        title: "Registro Profesional",
        desc: "Guía paso a paso para crear tu cuenta de abogado.",
        video: "/videos/2.Guia%20de%20creacion%20abogado.mp4",
        icon: Settings
    }
];

export default function VideoGuides() {
    const trackRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateButtons = () => {
        const el = trackRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    };

    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;
        updateButtons();
        el.addEventListener('scroll', updateButtons, { passive: true });
        window.addEventListener('resize', updateButtons);
        return () => {
            el.removeEventListener('scroll', updateButtons);
            window.removeEventListener('resize', updateButtons);
        };
    }, []);

    const scroll = (dir) => {
        const el = trackRef.current;
        if (!el) return;
        const card = el.querySelector('.video-card-v3');
        const distance = card ? card.offsetWidth + 24 : 400;
        el.scrollBy({ left: dir * distance, behavior: 'smooth' });
    };

    return (
        <section className="section-container" id="guias">
            <div className="section-header reveal">
                <h2 className="section-title">Guías <span className="gradient-text italic-serif">Visuales</span></h2>
                <p className="section-subtitle">
                    Domina la plataforma con nuestros tutoriales paso a paso.
                </p>
            </div>

            <div className="video-carousel reveal">
                {canScrollLeft && (
                    <button className="carousel-btn carousel-btn-left" onClick={() => scroll(-1)} aria-label="Anterior">
                        <ChevronLeft size={24} />
                    </button>
                )}

                <div className="video-track" ref={trackRef}>
                    {guides.map((guide) => {
                        const Icon = guide.icon;
                        return (
                            <div key={guide.id} className="video-card-v3">
                                <div className="video-wrapper">
                                    <video
                                        controls
                                        className="video-player"
                                        preload="metadata"
                                        playsInline
                                    >
                                        <source src={guide.video} type="video/mp4" />
                                        Tu navegador no soporta el elemento de video.
                                    </video>
                                </div>
                                <div className="video-info">
                                    <div className="video-tag">
                                        <span className="video-number">{guide.id}</span>
                                        <Icon size={16} />
                                        <span>Tutorial</span>
                                    </div>
                                    <h3>{guide.title}</h3>
                                    <p>{guide.desc}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {canScrollRight && (
                    <button className="carousel-btn carousel-btn-right" onClick={() => scroll(1)} aria-label="Siguiente">
                        <ChevronRight size={24} />
                    </button>
                )}
            </div>
        </section>
    );
}
