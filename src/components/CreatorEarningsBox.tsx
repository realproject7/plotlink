"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { browserClient } from "../../lib/rpc";
import { mcv2BondAbi } from "../../lib/price";
import { MCV2_BOND, PLOT_TOKEN, RESERVE_LABEL } from "../../lib/contracts/constants";
import { usePlotUsdPrice } from "../hooks/usePlotUsdPrice";
import { formatUsdValue } from "../../lib/usd-price";

export function CreatorEarningsBox({ writerAddress }: { writerAddress: Address }) {
  const { data: plotUsd } = usePlotUsdPrice();

  const { data: royaltyInfo } = useQuery({
    queryKey: ["creator-earnings", writerAddress],
    queryFn: async () => {
      const [unclaimed, claimed] = await browserClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "getRoyaltyInfo",
        args: [writerAddress, PLOT_TOKEN],
      });
      return { unclaimed, claimed, total: unclaimed + claimed };
    },
    refetchInterval: 30_000,
  });

  const total = royaltyInfo?.total ?? BigInt(0);
  const totalFloat = parseFloat(formatUnits(total, 18));
  const usdValue = plotUsd ? totalFloat * plotUsd : null;

  const displayValue = total === BigInt(0)
    ? "$0"
    : usdValue !== null
      ? formatUsdValue(usdValue)
      : `${formatTruncated(total)} ${RESERVE_LABEL}`;

  return (
    <>
      <div className="text-foreground text-sm font-bold">{displayValue}</div>
      {total > BigInt(0) && usdValue !== null && (
        <div className="text-muted text-[10px]">{formatTruncated(total)} {RESERVE_LABEL}</div>
      )}
    </>
  );
}

function formatTruncated(value: bigint, decimals = 18, digits = 4): string {
  const raw = formatUnits(value, decimals);
  const dot = raw.indexOf(".");
  if (dot === -1 || raw.length - dot - 1 <= digits) return raw;
  const truncated = raw.slice(0, dot + 1 + digits).replace(/0+$/, "").replace(/\.$/, "");
  return truncated === "0" && value > BigInt(0) ? raw.slice(0, dot + 1 + digits) : truncated;
}
