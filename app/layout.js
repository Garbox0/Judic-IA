import { Outfit, Playfair_Display } from "next/font/google"; // Using Outfit for modern/premium feel
import "./globals.css";
import "./landing.css"; // Fix FOUC


const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata = {
  title: "Judic-IA | Asistente Legal Inteligente",
  description: "Asistente digital para abogados que automatiza y clasifica consultas legales con inteligencia artificial.",
  keywords: ["abogados", "inteligencia artificial", "jurisprudencia", "agenda legal", "gestión de clientes"],
  robots: "index, follow",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

import { headers } from "next/headers";
import { GoogleAnalytics } from '@next/third-parties/google';

export default async function RootLayout({ children }) {
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${outfit.variable} ${playfair.variable}`} suppressHydrationWarning>
        {children}
        <GoogleAnalytics gaId="G-YGHD9G2S0R" />
      </body>
    </html>
  );
}
