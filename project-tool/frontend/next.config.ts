import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Type safety is enforced by `npm run typecheck` (tsc --noEmit); no ESLint config yet.
  eslint: { ignoreDuringBuilds: true },
  // In Docker, Nginx routes /api, /media and /ws to Django before requests reach Next.js.
  // These rewrites only matter when running `next dev` on its own without Nginx.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*/` },
      { source: "/media/:path*", destination: `${backendUrl}/media/:path*` },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
