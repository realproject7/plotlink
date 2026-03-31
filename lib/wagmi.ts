import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  baseAccount,
  trustWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createFallbackTransport } from "./rpc";
import { DATA_SUFFIX } from "./builder-code";

const IS_MAINNET = process.env.NEXT_PUBLIC_CHAIN_ID === "8453";
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "placeholder";

// RainbowKit wallet list
const walletConnectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [
        metaMaskWallet,
        baseAccount,
        trustWallet,
        rainbowWallet,
        walletConnectWallet,
      ],
    },
  ],
  {
    appName: "PlotLink",
    projectId,
  },
);

// Farcaster miniapp connector first for auto-connect in Warpcast
const connectors = [farcasterMiniApp(), ...walletConnectors];

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors,
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
