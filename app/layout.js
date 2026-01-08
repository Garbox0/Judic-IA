import { Outfit } from "next/font/google"; // Using Outfit for modern/premium feel
import "./globals.css";
import "./landing.css"; // Fix FOUC


const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata = {
  title: "Judic-IA | Asistente Legal Inteligente",
  description: "Asistente digital para abogados que automatiza y clasifica consultas.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${outfit.variable}`}>
        {children}
      </body>
    </html>
  );
}
