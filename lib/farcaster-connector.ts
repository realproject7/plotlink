import { type Address, type EIP1193Provider, getAddress } from "viem";
import { createConnector } from "wagmi";

// Lazily resolved SDK module & provider
let sdkModule: typeof import("@farcaster/miniapp-sdk") | undefined;
let cachedProvider: EIP1193Provider | undefined;

async function getSDK() {
  if (!sdkModule) {
    sdkModule = await import("@farcaster/miniapp-sdk");
  }
  return sdkModule.sdk;
}

async function resolveProvider(): Promise<EIP1193Provider> {
  if (cachedProvider) return cachedProvider;
  const sdk = await getSDK();
  // getEthereumProvider() may return a promise in some SDK versions
  cachedProvider = (await sdk.wallet.getEthereumProvider()) as EIP1193Provider;
  return cachedProvider;
}

/**
 * Detect whether we are running inside a Farcaster Mini App context.
 * Safe to call on server (returns false) and outside Farcaster (returns false).
 */
export async function isFarcasterMiniApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const sdk = await getSDK();
    const ctx = await sdk.context;
    return !!ctx;
  } catch {
    return false;
  }
}

farcaster.type = "farcaster" as const;

/**
 * Custom wagmi v3 connector that wraps `sdk.wallet.getEthereumProvider()`
 * from `@farcaster/miniapp-sdk`. Only usable inside a Farcaster Mini App.
 */
export function farcaster() {
  return createConnector<EIP1193Provider>((config) => ({
    id: "farcaster",
    name: "Farcaster",
    type: farcaster.type,

    async connect(parameters?) {
      const provider = await resolveProvider();
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as Address[];
      let currentChainId = Number(
        await provider.request({ method: "eth_chainId" }),
      );

      const chainId = parameters?.chainId;
      if (chainId && currentChainId !== chainId) {
        const chain = await this.switchChain!({ chainId });
        currentChainId = chain.id;
      }

      const result: { accounts: readonly Address[]; chainId: number } = {
        accounts: accounts.map((a) => getAddress(a)),
        chainId: currentChainId,
      };
      // wagmi v3 connect() is generic over withCapabilities — safe to widen
      return result as never;
    },

    async disconnect() {
      // The Farcaster provider does not support programmatic disconnect
    },

    async getAccounts() {
      const provider = await resolveProvider();
      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as Address[];
      return accounts.map((a) => getAddress(a)) as readonly Address[];
    },

    async getChainId() {
      const provider = await resolveProvider();
      const chainId = await provider.request({ method: "eth_chainId" });
      return Number(chainId);
    },

    async getProvider() {
      return await resolveProvider();
    },

    async isAuthorized() {
      try {
        const accounts = await this.getAccounts();
        return accounts.length > 0;
      } catch {
        return false;
      }
    },

    async switchChain({ chainId }) {
      const provider = await resolveProvider();
      const chain = config.chains.find((c) => c.id === chainId);
      if (!chain) throw new Error(`Chain ${chainId} not configured`);

      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });

      config.emitter.emit("change", { chainId });
      return chain;
    },

    onAccountsChanged(accounts) {
      if (accounts.length === 0) {
        config.emitter.emit("disconnect");
      } else {
        config.emitter.emit("change", {
          accounts: accounts.map((a) => getAddress(a as Address)),
        });
      }
    },

    onChainChanged(chain) {
      const chainId = Number(chain);
      config.emitter.emit("change", { chainId });
    },

    onDisconnect() {
      config.emitter.emit("disconnect");
    },
  }));
}
