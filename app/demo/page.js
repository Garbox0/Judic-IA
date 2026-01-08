"use client";
import SafeChatWidget from "../components/SafeChatWidget";
import Link from "next/link";
import styles from "../page.module.css";

export default function DemoPage() {
    return (
        <main className={styles.main}>
            {/* Reuse Landing CSS classes for consistency (Assuming landing.css is global or we import styles) */}
            <style jsx global>{`
                body { background: #020617; }
                .demo-nav {
                    position: absolute; top: 0; left: 0; right: 0;
                    padding: 1.5rem 2rem;
                    display: flex; justify-content: space-between; align-items: center;
                    z-index: 50;
                    background: linear-gradient(to bottom, rgba(2,6,23,0.9), transparent);
                }
                .demo-brand { font-family: 'Playfair Display', serif; font-size: 1.5rem; color: #f8fafc; display: flex; align-items: center; gap: 0.5rem; }
                .demo-tag { font-family: 'Inter', sans-serif; font-size: 0.75rem; background: rgba(251, 191, 36, 0.1); color: #fbbf24; padding: 0.2rem 0.6rem; borderRadius: 20px; border: 1px solid rgba(251, 191, 36, 0.2); }
                .btn-back-demo {
                    color: #94a3b8; text-decoration: none; font-size: 0.9rem; font-weight: 500;
                    display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;
                    border-radius: 8px; transition: all 0.2s;
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
                }
                .btn-back-demo:hover { background: rgba(255,255,255,0.1); color: white; border-color: rgba(255,255,255,0.1); }
                
                .demo-container {
                    min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
                    background: radial-gradient(circle at 50% 30%, #1e293b 0%, #020617 70%);
                    position: relative; overflow: hidden;
                }
                .demo-content { text-align: center; max-width: 600px; padding: 2rem; position: relative; z-index: 10; animation: fadeUp 0.8s ease-out; }
                .demo-title { font-size: 2.5rem; font-weight: 700; margin-bottom: 1rem; color: #f8fafc; letter-spacing: -0.02em; }
                .highlight { color: #fbbf24; position: relative; display: inline-block; }
                .highlight::after { content: ''; position: absolute; bottom: 0px; left: 0; width: 100%; height: 8px; background: rgba(251, 191, 36, 0.2); z-index: -1; transform: skewX(-10deg); }
                
                .demo-desc { font-size: 1.1rem; color: #cbd5e1; line-height: 1.6; margin-bottom: 3rem; }
                .suggestion-box {
                    background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1);
                    padding: 1rem 1.5rem; border-radius: 12px; display: inline-block;
                    margin-top: 1rem; backdrop-filter: blur(4px);
                }
                .suggestion-text { font-family: 'DM Mono', monospace; color: #fbbf24; font-size: 0.95rem; }

                /* Background Effects */
                .glow-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.4; z-index: 0; }
                .orb-top { width: 300px; height: 300px; background: #3b82f6; top: -100px; left: 20%; }
                .orb-bottom { width: 400px; height: 400px; background: #fbbf24; bottom: -150px; right: 20%; opacity: 0.15; }

                @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            <div className="demo-container">
                <nav className="demo-nav">
                    <div className="demo-brand">
                        Judic-IA <span className="demo-tag">DEMO</span>
                    </div>
                    <Link href="/" className="btn-back-demo">
                        <span>←</span> Volver al inicio
                    </Link>
                </nav>

                <div className="glow-orb orb-top"></div>
                <div className="glow-orb orb-bottom"></div>

                <div className="demo-content">
                    <h1 className="demo-title">Prueba el Asistente del <span className="highlight">Dr. Martínez</span></h1>
                    <div className="demo-desc">
                        Experimenta el poder de la IA jurídica. Este chat simula la experiencia que tendrán tus clientes al ingresar a tu sitio web.
                        <div className="suggestion-box">
                            <span style={{ color: '#94a3b8', marginRight: '8px' }}>Prueba decir:</span>
                            <span className="suggestion-text">"Me echaron del trabajo y no sé qué hacer"</span>
                        </div>
                    </div>

                    {/* Client Bot Widget - Mode: DEMO */}
                    <SafeChatWidget
                        mode="demo"
                        lawyerId="00000000-0000-0000-0000-000000000000"
                        initialMessage="Hola, soy el asistente virtual del Dr. Martínez. ¿En qué puedo ayudarte hoy?"
                        embedded={true}
                    />
                </div>
            </div>
        </main>
    );
}
