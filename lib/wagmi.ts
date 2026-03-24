import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { createFallbackTransport } from "./rpc";
import { DATA_SUFFIX } from "./builder-code";

const IS_MAINNET = process.env.NEXT_PUBLIC_CHAIN_ID === "8453";

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [farcasterMiniApp(), injected()],
  transports: {
    [base.id]: IS_MAINNET ? createFallbackTransport() : http(),
    [baseSepolia.id]: IS_MAINNET ? http() : createFallbackTransport(),
  },
  ssr: true,
  ...(DATA_SUFFIX ? { dataSuffix: DATA_SUFFIX } : {}),
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
