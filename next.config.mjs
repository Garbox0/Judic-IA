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
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            // Permissive CSP for Next.js (allowing scripts/styles) but blocking framing/mixed content
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https://*.supabase.co https://lh3.googleusercontent.com; connect-src 'self' https://*.supabase.co https://api.mercadopago.com https://events.mercadopago.com; frame-description 'none'; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};


export default nextConfig;
