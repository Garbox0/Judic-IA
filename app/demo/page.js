"use client";
import SafeChatWidget from "../components/SafeChatWidget";
import Link from "next/link";
import styles from "./demo.module.css";

import { Gavel } from "lucide-react";

export default function DemoPage() {
    return (
        <main className={styles.main}>
            <div className={styles.container}>
                <nav className={styles.nav}>
                    <div className={styles.brand}>
                        Judic-IA <span className={styles.tag}>DEMO</span>
                    </div>
                    <div className={styles.navActions}>
                        <Link href="/demo/dashboard" className={styles.dashboardBtnNav}>
                            <Gavel size={18} style={{ marginRight: '8px' }} /> Panel Abogado
                        </Link>
                        <Link href="/" className={styles.backBtn}>
                            <span>←</span> Volver al inicio
                        </Link>
                    </div>
                </nav>

                <div className={styles.content}>
                    <h1 className={styles.title}><span className={styles.highlight}>Dr. Martínez</span></h1>
                    <p className={styles.meta}>Abogado · Derecho Laboral · CABA</p>

                    {/* Client Bot Widget - Mode: DEMO */}
                    <div className={styles.chatWrapper}>
                        <SafeChatWidget
                            mode="demo"
                            lawyerId="00000000-0000-0000-0000-000000000000"
                            initialMessage="Hola, soy el asistente virtual del Dr. Martínez. ¿En qué puedo ayudarte hoy?"
                            embedded={true}
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}
