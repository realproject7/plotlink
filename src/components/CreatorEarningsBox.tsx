"use client";

import { RESERVE_LABEL } from "../../lib/contracts/constants";
import { usePlotUsdPrice } from "../hooks/usePlotUsdPrice";
import { formatUsdValue } from "../../lib/usd-price";

export function CreatorEarningsBox({ earningsPlot }: { earningsPlot: number }) {
  const { data: plotUsd } = usePlotUsdPrice();
  const usdValue = plotUsd ? earningsPlot * plotUsd : null;

  if (earningsPlot === 0) return <div className="text-foreground text-sm font-bold">$0</div>;

  const plotLabel = `${formatTruncated(earningsPlot)} ${RESERVE_LABEL}`;

  return (
    <>
      <div className="text-foreground text-sm font-bold">
        {usdValue !== null ? formatUsdValue(usdValue) : plotLabel}
      </div>
      {usdValue !== null && (
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
