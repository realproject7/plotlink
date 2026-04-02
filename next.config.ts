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
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com",
              [
                "connect-src 'self'",
                // WalletConnect
                "https://*.walletconnect.com wss://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.org https://api.web3modal.com https://pulse.walletconnect.org",
                // RPC providers
                "https://mainnet.base.org https://sepolia.base.org https://base-rpc.publicnode.com https://base.drpc.org https://base.llamarpc.com https://base.meowrpc.com https://base-mainnet.public.blastapi.io https://1rpc.io https://base.gateway.tenderly.co https://rpc.notadegen.com https://base.blockpi.network https://developer-access-mainnet.base.org https://base.api.onfinality.io",
                // Supabase
                "https://*.supabase.co",
                // Farcaster & social
                "https://api.neynar.com https://fc.hunt.town https://*.farcaster.xyz",
                // Price & reputation
                "https://api.coingecko.com https://api.geckoterminal.com https://api.quotient.social https://api.twitterapi.io",
                // IPFS & storage
                "https://ipfs.filebase.io https://ipfs.io https://s3.filebase.com",
                // Vercel analytics
                "https://va.vercel-scripts.com",
              ].join(" "),
              "frame-src 'self' https://*.walletconnect.com https://*.farcaster.xyz",
              "frame-ancestors 'self' https://*.farcaster.xyz https://*.warpcast.com https://base.org https://*.base.org",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
