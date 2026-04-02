import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self' https: wss: data: blob:",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https:",
              "style-src 'self' 'unsafe-inline' https:",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data: https:",
              "connect-src 'self' https: wss:",
              "frame-src 'self' https:",
              "frame-ancestors 'self' https://*.farcaster.xyz https://*.warpcast.com https://base.org https://*.base.org",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
