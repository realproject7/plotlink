import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [farcasterMiniApp(), injected()],
  transports: {
    [base.id]: http(
      process.env.NEXT_PUBLIC_CHAIN_ID === "8453"
        ? process.env.NEXT_PUBLIC_RPC_URL
        : undefined,
    ),
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_CHAIN_ID !== "8453"
        ? process.env.NEXT_PUBLIC_RPC_URL
        : undefined,
    ),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
