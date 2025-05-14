// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    
    if (process.env.NODE_ENV !== 'production') {
      return []
    }

    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          // === Content Security Policy ===
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self';
              style-src 'self' 'unsafe-inline';
              img-src 'self' data:;
              connect-src 'self' https://api.theinternetrichlist.com;
              font-src 'self';
              object-src 'none';
              upgrade-insecure-requests;
            `.replace(/\s{2,}/g, ' ').trim(),
          },
          // === Click‑jacking protection ===
          { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
          // === MIME sniffing protection ===
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          // === Referrer policy ===
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          // === Permissions policy ===
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'payment=()',
            ].join(', '),
          },
          // === CORS (tightened) ===
          {
            key: 'Access-Control-Allow-Origin',
            value:
              process.env.NODE_ENV === 'production'
                ? 'https://theinternetrichlist.com'
                : 'http://localhost:3000',
          },
          { key: 'Access-Control-Allow-Methods',  value: 'GET,OPTIONS' },
          { key: 'Access-Control-Allow-Headers',  value: 'Content-Type' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ]
  },
}

export default nextConfig