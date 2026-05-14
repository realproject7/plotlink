"use client";

import { RESERVE_LABEL } from "../../lib/contracts/constants";
import { usePlotUsdPrice } from "../hooks/usePlotUsdPrice";
import { formatUsdValue } from "../../lib/usd-price";

interface CreatorEarningsBoxProps {
  earningsPlot: number;
}

export function CreatorEarningsBox({ earningsPlot }: CreatorEarningsBoxProps) {
  const { data: plotUsd } = usePlotUsdPrice();
  const usdValue = plotUsd ? earningsPlot * plotUsd : null;
  const plotLabel = earningsPlot > 0 ? `${formatTruncated(earningsPlot)} ${RESERVE_LABEL}` : null;

  return (
    <>
      <div className="text-foreground text-sm font-bold">
        {earningsPlot === 0 ? "$0" : usdValue !== null ? formatUsdValue(usdValue) : plotLabel}
      </div>
      {earningsPlot > 0 && usdValue !== null && (
        <div className="text-muted text-[10px]">{plotLabel}</div>
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
