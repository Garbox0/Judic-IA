import SafeChatWidget from "../components/SafeChatWidget";
import Link from "next/link";
import styles from "../page.module.css";

// FORCE DYNAMIC RENDERING
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function DemoPage() {
    return (
        <main className={styles.main} style={{ background: '#0f172a' }}>
            {/* Simple Header */}
            <nav className="glass-panel" style={{
                position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)',
                width: '90%', maxWidth: '1200px', display: 'flex', justifyContent: 'space-between',
                padding: '1rem 2rem', zIndex: 100
            }}>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--primary)' }}>Judic-IA <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>| Demo Cliente</span></div>
                <Link href="/" className="btn" style={{ fontSize: '0.9rem' }}>← Volver</Link>
            </nav>

            {/* Demo Context */}
            <div className="container" style={{ marginTop: '8rem', textAlign: 'center', maxWidth: '600px' }}>
                <h1 style={{ marginBottom: '1rem' }}>Prueba el Asistente del <span className={styles.gold}>Dr. Martínez</span></h1>
                <p style={{ color: 'var(--muted)', marginBottom: '2rem' }}>
                    Imagina que eres una persona con un problema legal.
                    El chat de abajo simula ser tu asistente virtual instalado en tu web.
                    <br /><br />
                    <strong>Prueba decir:</strong> <i>"Me echaron del trabajo y no sé qué hacer"</i>
                </p>
            </div>

            {/* Client Bot Widget - Mode: CLIENT - Dynamically loaded */}
            <SafeChatWidget
                mode="client"
                initialMessage="Hola, soy el asistente virtual del Dr. Martínez. ¿En qué puedo ayudarte hoy?"
                embedded={true}
            />
        </main>
    );
}
