import { ImageResponse } from "next/og";
import { type Address } from "viem";
import { createServerClient, type Storyline } from "../../../../../lib/supabase";
import { getTokenTVL } from "../../../../../lib/price";
import { getFarcasterProfile } from "../../../../../lib/actions";
import { RESERVE_LABEL, STORY_FACTORY } from "../../../../../lib/contracts/constants";
import { formatPrice } from "../../../../../lib/format";
import { truncateAddress } from "../../../../../lib/utils";
import { getPlotUsdPrice, formatUsdValue } from "../../../../../lib/usd-price";

export const runtime = "nodejs";

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(
      "https://fonts.googleapis.com/css2?family=Newsreader:wght@500&display=swap",
    );
    const css = await res.text();
    const match =
      css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]truetype['"]\)/) ??
      css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]woff['"]\)/);
    if (!match?.[1]) return null;
    const fontRes = await fetch(match[1]);
    return fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

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

  const [tvlInfo, plotUsd, farcasterProfile, fontData] = await Promise.all([
    sl.token_address ? getTokenTVL(sl.token_address as Address) : null,
    getPlotUsdPrice(),
    getFarcasterProfile(sl.writer_address).catch(() => null),
    loadFont(),
  ]);

  const reserveLabel = RESERVE_LABEL;
  const authorName = farcasterProfile
    ? `@${farcasterProfile.username}`
    : truncateAddress(sl.writer_address);
  const plotLabel = `${sl.plot_count} ${sl.plot_count === 1 ? "plot" : "plots"}`;
  const titleDisplay =
    sl.title.length > 50 ? `${sl.title.slice(0, 47)}...` : sl.title;

  // TVL display with USD
  let tvlDisplay: string | null = null;
  if (tvlInfo) {
    const tvlNum = parseFloat(tvlInfo.tvl);
    tvlDisplay = `TVL: ${formatPrice(tvlInfo.tvl)} ${reserveLabel}`;
    if (plotUsd && tvlNum > 0) {
      tvlDisplay += ` (${formatUsdValue(tvlNum * plotUsd)})`;
    }
  }

  type FallbackVariant = "A" | "B" | "C" | "D";
  const variants: FallbackVariant[] = ["A", "B", "C", "D"];
  const variant = variants[((id * 2654435761) >>> 0) % 4];

  const FALLBACK_BG: Record<FallbackVariant, string> = {
    A: "radial-gradient(ellipse at 30% 20%, #3a2e24, #261f19)",
    B: "repeating-linear-gradient(135deg, #2a2420 0px, #2a2420 8px, #332c26 8px, #332c26 16px)",
    C: "conic-gradient(from 180deg at 50% 50%, #2e3540, #2a2420, #2e3540)",
    D: "#302820",
  };

  const fonts = fontData
    ? [{ name: "Newsreader", data: fontData, weight: 500 as const }]
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#faf8f5",
          fontFamily: fontData ? "Newsreader" : "Georgia, serif",
        }}
      >
        {/* Cover card with deterministic fallback pattern */}
        <div
          style={{
            width: "380px",
            height: "520px",
            display: "flex",
            flexDirection: "column",
            background: FALLBACK_BG[variant],
            borderRadius: "12px",
            border: "1px solid #3a332c",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Accent strip at top */}
          <div
            style={{
              display: "flex",
              height: "3px",
              background: "linear-gradient(90deg, #b05c3a, #b05c3a80, transparent)",
            }}
          />

          {/* Top: genre tag */}
          <div
            style={{
              display: "flex",
              padding: "28px 28px 0",
            }}
          >
            {sl.genre ? (
              <div
                style={{
                  display: "flex",
                  fontSize: "12px",
                  color: "#b05c3a",
                  backgroundColor: "rgba(176, 92, 58, 0.12)",
                  borderRadius: "4px",
                  padding: "4px 12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontWeight: 500,
                }}
              >
                {sl.genre}
              </div>
            ) : (
              <div style={{ display: "flex" }} />
            )}
          </div>

          {/* Center: title */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              flex: 1,
              padding: "0 32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "1px",
                background: "rgba(176, 92, 58, 0.4)",
                marginBottom: "20px",
                display: "flex",
              }}
            />
            <div
              style={{
                fontSize: titleDisplay.length > 30 ? "30px" : "36px",
                fontWeight: 500,
                color: "#ede4d6",
                lineHeight: 1.3,
                display: "flex",
                textAlign: "center",
                justifyContent: "center",
                maxWidth: "340px",
              }}
            >
              {titleDisplay}
            </div>
            <div
              style={{
                width: "40px",
                height: "1px",
                background: "rgba(176, 92, 58, 0.4)",
                marginTop: "20px",
                display: "flex",
              }}
            />
          </div>

          {/* Bottom: stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "0 28px 28px",
              fontSize: "14px",
              color: "#8a7e70",
            }}
          >
            <div style={{ display: "flex" }}>{plotLabel}</div>
            {tvlDisplay && (
              <div style={{ display: "flex", fontWeight: 500, color: "#b05c3a" }}>
                {tvlDisplay}
              </div>
            )}
          </div>
        </div>

        {/* Below card: author + branding */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "380px",
            marginTop: "20px",
            fontSize: "15px",
            color: "#6a5e50",
          }}
        >
          <div style={{ display: "flex" }}>by {authorName}</div>
          <div style={{ display: "flex", color: "#4a4038" }}>plotlink.xyz</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
    },
  );
}
