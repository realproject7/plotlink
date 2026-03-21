import { ImageResponse } from "next/og";
import { type Address } from "viem";
import { createServerClient, type Storyline } from "../../../../../lib/supabase";
import { getTokenPrice } from "../../../../../lib/price";
import { lookupByAddress } from "../../../../../lib/farcaster";
import { RESERVE_LABEL, STORY_FACTORY } from "../../../../../lib/contracts/constants";
import { truncateAddress } from "../../../../../lib/utils";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storylineId: string }> },
) {
  const { storylineId } = await params;
  const id = Number(storylineId);

  if (isNaN(id) || id <= 0) {
    return new Response("Invalid storyline ID", { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return new Response("Database unavailable", { status: 503 });
  }

  const { data: storyline } = await supabase
    .from("storylines")
    .select("*")
    .eq("storyline_id", id)
    .eq("hidden", false)
    .eq("contract_address", STORY_FACTORY.toLowerCase())
    .single();

  if (!storyline) {
    return new Response("Storyline not found", { status: 404 });
  }

  const sl = storyline as Storyline;

  const [priceInfo, farcasterProfile] = await Promise.all([
    sl.token_address ? getTokenPrice(sl.token_address as Address) : null,
    lookupByAddress(sl.writer_address).catch(() => null),
  ]);

  const reserveLabel = RESERVE_LABEL;
  const priceDisplay = priceInfo
    ? `${priceInfo.pricePerToken} ${reserveLabel}`
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          backgroundColor: "#E8DFD0",
          color: "#2C1810",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Top: branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "24px",
            color: "#8B4513",
          }}
        >
          PlotLink
        </div>

        {/* Center: title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "48px",
              fontWeight: 700,
              color: "#8B4513",
              overflow: "hidden",
            }}
          >
            {sl.title.length > 80 ? `${sl.title.slice(0, 77)}...` : sl.title}
          </div>
        </div>

        {/* Bottom: metadata */}
        <div
          style={{
            display: "flex",
            gap: "32px",
            fontSize: "22px",
            color: "#8B7355",
          }}
        >
          <span>by {farcasterProfile ? `@${farcasterProfile.username}` : truncateAddress(sl.writer_address)}</span>
          <span>
            {sl.plot_count} {sl.plot_count === 1 ? "plot" : "plots"}
          </span>
          {priceDisplay && <span>Price: {priceDisplay}</span>}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
