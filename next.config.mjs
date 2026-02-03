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
