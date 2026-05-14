"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { browserClient } from "../../lib/rpc";
import { mcv2BondAbi } from "../../lib/price";
import { MCV2_BOND, PLOT_TOKEN, RESERVE_LABEL } from "../../lib/contracts/constants";
import { usePlotUsdPrice } from "../hooks/usePlotUsdPrice";
import { formatUsdValue } from "../../lib/usd-price";

interface CreatorEarningsBoxProps {
  earningsPlot: number;
  writerAddress: Address;
}

export function CreatorEarningsBox({ earningsPlot, writerAddress }: CreatorEarningsBoxProps) {
  const { data: plotUsd } = usePlotUsdPrice();
  const usdValue = plotUsd ? earningsPlot * plotUsd : null;

  // Wallet-wide unclaimed (contract doesn't expose per-story unclaimed)
  const { data: unclaimed } = useQuery({
    queryKey: ["unclaimed-royalties", writerAddress],
    queryFn: async () => {
      const [balance] = await browserClient.readContract({
        address: MCV2_BOND,
        abi: mcv2BondAbi,
        functionName: "getRoyaltyInfo",
        args: [writerAddress, PLOT_TOKEN],
      });
      return balance;
    },
    refetchInterval: 30_000,
  });

  const unclaimedFloat = unclaimed ? parseFloat(formatUnits(unclaimed, 18)) : 0;
  const unclaimedUsd = plotUsd && unclaimedFloat > 0 ? formatUsdValue(unclaimedFloat * plotUsd) : null;

  const plotLabel = earningsPlot > 0 ? `${formatTruncated(earningsPlot)} ${RESERVE_LABEL}` : null;

  return (
    <>
      <div className="text-foreground text-sm font-bold">
        {earningsPlot === 0 ? "$0" : usdValue !== null ? formatUsdValue(usdValue) : plotLabel}
      </div>
      {earningsPlot > 0 && usdValue !== null && (
        <div className="text-muted text-[10px]">{plotLabel}</div>
      )}
      {unclaimedFloat > 0 && (
        <div className="text-muted text-[10px]">
          {unclaimedUsd ?? `${formatTruncated(unclaimedFloat)} ${RESERVE_LABEL}`} unclaimed (all stories)
        </div>
      )}
    </>
  );
}

function formatTruncated(value: number, digits = 4): string {
  if (value === 0) return "0";
  const str = String(value);
  const dot = str.indexOf(".");
  if (dot === -1 || str.length - dot - 1 <= digits) return str;
  return str.slice(0, dot + 1 + digits).replace(/0+$/, "").replace(/\.$/, "");
}
