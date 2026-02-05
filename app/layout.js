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
  metadataBase: new URL('https://judic-ia.com'),
  title: "Judic-IA | Asistente Legal Inteligente",
  description: "Asistente digital para abogados que automatiza y clasifica consultas legales con inteligencia artificial.",
  keywords: ["abogados", "inteligencia artificial", "jurisprudencia", "agenda legal", "gestión de clientes", "legaltech argentina"],
  robots: "index, follow",
  alternates: {
    canonical: "https://judic-ia.com",
  },
  openGraph: {
    title: "Judic-IA | La Evolución de tu Estudio Jurídico",
    description: "Automatiza consultas, investiga jurisprudencia y gestiona tu estudio con IA de élite.",
    url: 'https://judic-ia.com',
    siteName: 'Judic-IA',
    locale: 'es_AR',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Judic-IA - Inteligencia Artificial para Abogados',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@JudicIA',
    creator: '@JudicIA',
    title: "Judic-IA | IA Legal de Élite",
    description: "La herramienta que transforma la práctica legal en Argentina.",
    images: ['/og-image.png'],
  },
  other: {
    "norton-safeweb-site-verification": "1E6773V6QM5D5ZHHAQK8JT155X0Y-YOG9V-XO6K5N86TDITPD7XBE9OU7G66LNTPU40BD4CXD38F9AT5K4B7BO7X3I1GU5S-AOGNWLKCZMUF6OU15EMFT35BK3VSS25H",
  },
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
      <head>
        {/* [SECURITY] Propagate nonce via style to satisfy A+ strict mode if enabled */}
        <style nonce={nonce} suppressHydrationWarning>{`:root { --nonce-safe: 1; }`}</style>
      </head>
      <body className={`${outfit.variable} ${playfair.variable}`} suppressHydrationWarning>
        {/* [SECURITY] Global Nonce for Client Components */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `window.judicNonce = "${nonce}";`
          }}
        />
        {children}
        <GoogleAnalytics gaId="G-YGHD9G2S0R" nonce={nonce} />
      </body>
    </html>
  );
}
