import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['109.123.236.73', '192.168.1.136'],
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;