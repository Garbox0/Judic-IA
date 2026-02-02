/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false, // Hide "X-Powered-By: Next.js"
  skipTrailingSlashRedirect: true, // Prevent 307 redirects on API routes (webhooks) - Forced Update
  async rewrites() {

    return [
      {
        source: '/home',
        destination: '/?public=1',
      },
    ];
  },
  async headers() {
    // Content Security Policy (Dependencies: Supabase, Google Analytics, MercadoPago)
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://www.googletagmanager.com https://www.google-analytics.com https://sdk.mercadopago.com https://js.stripe.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' blob: data: https: https://aeecmwzmarjzliwctqcx.supabase.co https://www.googletagmanager.com https://www.google-analytics.com;
      font-src 'self' data: https://fonts.gstatic.com;
      connect-src 'self' https://aeecmwzmarjzliwctqcx.supabase.co wss://aeecmwzmarjzliwctqcx.supabase.co https://www.google-analytics.com https://api.mercadopago.com https://events.mercadopago.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com;
      frame-src 'self' https://www.google.com https://sandbox.mercadopago.com.ar https://www.mercadopago.com.ar;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'self';
      block-all-mixed-content;
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      // Headers generales (NO PDF)
      {
        source: '/((?!legislation/.*\\.pdf$).*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' }
        ],
      },

      // PDFs: permitir embebido en el mismo origen
      {
        source: '/legislation/(.*)\\.pdf',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'self'; object-src 'self'; frame-ancestors 'self';" },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Type', value: 'application/pdf' },
        ],
      },
    ];
  },
};


export default nextConfig;
