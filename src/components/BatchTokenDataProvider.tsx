"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Address } from "viem";
import { getBatchTokenData, type BatchTokenEntry } from "../../lib/price";
import { browserClient } from "../../lib/rpc";

type BatchTokenDataMap = Map<string, BatchTokenEntry>;

const BatchTokenDataContext = createContext<BatchTokenDataMap>(new Map());

export function useBatchTokenData(tokenAddress: string): BatchTokenEntry | undefined {
  const map = useContext(BatchTokenDataContext);
  return map.get(tokenAddress.toLowerCase());
}

/**
 * Fetches price + TVL for all provided token addresses in a single
 * multicall RPC request and provides the data via context.
 */
export function BatchTokenDataProvider({
  tokenAddresses,
  children,
}: {
  tokenAddresses: Address[];
  children: ReactNode;
}) {
  const { data } = useQuery({
    queryKey: ["batch-token-data", tokenAddresses.join(",")],
    queryFn: () => getBatchTokenData(tokenAddresses, browserClient),
    staleTime: 60000,
    enabled: tokenAddresses.length > 0,
  });

  return (
    <BatchTokenDataContext.Provider value={data ?? new Map()}>
      {children}
    </BatchTokenDataContext.Provider>
  );
}
