/** @type {import('next').NextConfig} */
const frameAncestors = process.env.FRAME_ANCESTORS || 'https://learning.clubwealth.com https://*.clubwealth.com';

// Set once, before Next starts its build workers, so the browser and server parts of one build agree.
process.env.CW_BUILD_ID ||= process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`;
const buildId = process.env.CW_BUILD_ID;

const nextConfig = {
  reactStrictMode: true,
  // One id per deploy, baked into both the browser code and the server: when they differ, the
  // page someone has open is older than what's live, and the hub offers a reload.
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  poweredByHeader: false,
  // The Task Recorder download zips the extension/ folder at request time, so ship it with that route.
  outputFileTracingIncludes: { '/api/task-recordings/extension': ['./extension/**/*'] },
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
