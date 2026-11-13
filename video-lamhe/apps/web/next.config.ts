import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Single .env at the repo root is shared by web + api.
loadEnvConfig(path.resolve(__dirname, '../..'));

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Docker builds (apps/web/Dockerfile) set NEXT_STANDALONE=1; `next start` / dev stay unchanged.
  ...(process.env.NEXT_STANDALONE === '1' && {
    output: 'standalone' as const,
    outputFileTracingRoot: path.resolve(__dirname, '../..'),
  }),
  // Linting runs once from the repo root (npm run lint), not again inside next build.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@video-lamhe/shared'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
