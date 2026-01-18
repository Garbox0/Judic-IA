/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false, // Hide "X-Powered-By: Next.js"
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            // Hardened CSP: Removing unsafe-eval, limiting frames and connect sources
            value: "default-src 'self'; " +
              "form-action 'self'; " +
              "script-src 'self' 'unsafe-inline' https://apis.google.com; " +
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
              "font-src 'self' https://fonts.gstatic.com data:; " +
              "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com; " +
              "connect-src 'self' https://*.supabase.co https://api.mercadopago.com https://events.mercadopago.com; " +
              "frame-src 'none'; " +
              "frame-ancestors 'none'; " +
              "object-src 'none';",
          },
        ],
      },
    ];
  },
};


export default nextConfig;
