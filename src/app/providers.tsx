"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, type Theme } from "@rainbow-me/rainbowkit";
import { config } from "../../lib/wagmi";
import { useState, Suspense } from "react";
import { useReferralCapture } from "../hooks/useReferralCapture";

import "@rainbow-me/rainbowkit/styles.css";

// PlotLink-themed RainbowKit theme using CSS vars
const plotlinkTheme: Theme = {
  blurs: {
    modalOverlay: "blur(4px)",
  },
  colors: {
    accentColor: "var(--accent)",
    accentColorForeground: "var(--bg)",
    actionButtonBorder: "var(--border)",
    actionButtonBorderMobile: "var(--border)",
    actionButtonSecondaryBackground: "transparent",
    closeButton: "var(--fg)",
    closeButtonBackground: "transparent",
    connectButtonBackground: "transparent",
    connectButtonBackgroundError: "transparent",
    connectButtonInnerBackground: "transparent",
    connectButtonText: "var(--fg)",
    connectButtonTextError: "var(--danger)",
    connectionIndicator: "var(--accent)",
    downloadBottomCardBackground: "var(--bg)",
    downloadTopCardBackground: "var(--accent)",
    error: "var(--danger)",
    generalBorder: "var(--border)",
    generalBorderDim: "var(--border)",
    menuItemBackground: "var(--surface)",
    modalBackdrop: "rgba(0, 0, 0, 0.5)",
    modalBackground: "var(--bg)",
    modalBorder: "var(--border)",
    modalText: "var(--fg)",
    modalTextDim: "var(--muted)",
    modalTextSecondary: "var(--muted)",
    profileAction: "var(--surface)",
    profileActionHover: "var(--accent)",
    profileForeground: "var(--bg)",
    selectedOptionBorder: "var(--accent)",
    standby: "var(--accent)",
  },
  fonts: {
    body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  },
  radii: {
    actionButton: "4px",
    connectButton: "4px",
    menuButton: "4px",
    modal: "8px",
    modalMobile: "8px",
  },
  shadows: {
    connectButton: "none",
    dialog: "0 4px 24px rgba(0, 0, 0, 0.3)",
    profileDetailsAction: "none",
    selectedOption: "0 2px 8px rgba(0, 0, 0, 0.2)",
    selectedWallet: "0 2px 8px rgba(0, 0, 0, 0.2)",
    walletLogo: "none",
  },
};

function ReferralCapture() {
  useReferralCapture();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={plotlinkTheme}
          modalSize="compact"
          appInfo={{
            appName: "PlotLink",
            disclaimer: ({ Text, Link }) => (
              <Text>
                By connecting, you agree to our{" "}
                <Link href="/terms">Terms</Link> and{" "}
                <Link href="/privacy">Privacy Policy</Link>.
              </Text>
            ),
          }}
        >
          <Suspense fallback={null}>
            <ReferralCapture />
          </Suspense>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
