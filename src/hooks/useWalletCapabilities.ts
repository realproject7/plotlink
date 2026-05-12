"use client";

import { useMemo } from "react";
import { useCapabilities } from "wagmi";
import { base } from "wagmi/chains";

export function useWalletCapabilities() {
  const { data: capabilities } = useCapabilities();

  const supportsBatching = useMemo(() => {
    const atomic = capabilities?.[base.id]?.atomic;
    return (
      atomic?.status === "ready" || atomic?.status === "supported"
    );
  }, [capabilities]);

  return { capabilities, supportsBatching };
}
