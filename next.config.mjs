/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false, // Hide "X-Powered-By: Next.js"
  skipTrailingSlashRedirect: true, // Prevent 307 redirects on API routes (webhooks) - Forced Update
  async rewrites() {
    return [];
  },
  async headers() {
    return [
      // Headers generales (NO PDF)
      {
        source: '/((?!legislation/.*\\.pdf$).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com https://*.supabase.co",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.pwnedpasswords.com https://www.google-analytics.com https://www.googletagmanager.com https://api.mercadopago.com",
              "frame-src 'self' https://www.mercadopago.com.ar https://www.mercadopago.com",
              "frame-ancestors 'self'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join('; ')
          }
        ],
      },

      // PDFs: permitir embebido en el mismo origen
      {
        source: '/legislation/(.*)\\.pdf',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.pwnedpasswords.com; frame-ancestors 'self'; block-all-mixed-content; upgrade-insecure-requests;" },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Type', value: 'application/pdf' },
        ],
      },
    ];
  },
};


export default nextConfig;
