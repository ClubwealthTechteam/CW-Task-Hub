/** @type {import('next').NextConfig} */
const frameAncestors = process.env.FRAME_ANCESTORS || 'https://learning.clubwealth.com https://*.clubwealth.com';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Allows CW University to show the hub inside its own page; blocks every other site.
          { key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${frameAncestors}` },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
