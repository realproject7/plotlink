import { ImageResponse } from "next/og";
import { type Address } from "viem";
import { createServerClient, type Storyline } from "../../../../../lib/supabase";
import { getTokenTVL } from "../../../../../lib/price";
import { getFarcasterProfile } from "../../../../../lib/actions";
import { RESERVE_LABEL, STORY_FACTORY } from "../../../../../lib/contracts/constants";
import { formatPrice } from "../../../../../lib/format";
import { truncateAddress } from "../../../../../lib/utils";
import { getPlotUsdPrice, formatUsdValue } from "../../../../../lib/usd-price";
import { getCoverUrl } from "../../../../../lib/cover";

export const runtime = "nodejs";

// oklch → hex translations for Satori (oklch not supported)
const FALLBACK_HEX = {
  A: { bg: "linear-gradient(160deg, #ede5d9 0%, #e4d9cc 100%)", accent: "rgba(180,140,110,0.15)" },
  B: { bg: "linear-gradient(170deg, #dce8df 0%, #cddcd4 100%)", accent: "rgba(100,160,130,0.12)" },
  C: { bg: "linear-gradient(180deg, #e0dce8 0%, #d3cde0 100%)", accent: "rgba(130,110,170,0.10)" },
  D: { bg: "linear-gradient(175deg, #ede5d9 0%, #e2d5c5 100%)", accent: "rgba(180,140,100,0.12)" },
} as const;
type FallbackVariant = keyof typeof FALLBACK_HEX;

const BADGE_COLORS = {
  genre: { bg: "rgba(0,0,0,0.55)", text: "rgba(255,255,255,0.9)" },
  ai: { bg: "rgba(90,50,160,0.7)", text: "rgba(255,255,255,0.9)" },
  status: { bg: "rgba(0,0,0,0.45)", text: "rgba(255,255,255,0.85)" },
  nsfw: { bg: "rgba(200,50,50,0.7)", text: "rgba(255,255,255,0.9)" },
  cartoon: { bg: "rgba(50,120,180,0.6)", text: "rgba(255,255,255,0.9)" },
};

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch("https://fonts.googleapis.com/css2?family=Newsreader:wght@500&display=swap");
    const css = await res.text();
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]truetype['"]\)/) ?? css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]woff['"]\)/);
    if (!match?.[1]) return null;
    return (await fetch(match[1])).arrayBuffer();
  } catch { return null; }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storylineId: string }> },
) {
  const { storylineId } = await params;
  const id = Number(storylineId);
  if (isNaN(id) || id <= 0) return new Response("Invalid storyline ID", { status: 400 });

  const supabase = createServerClient();
  if (!supabase) return new Response("Database unavailable", { status: 503 });

  const { data: storyline } = await supabase
    .from("storylines").select("*")
    .eq("storyline_id", id).eq("hidden", false)
    .eq("contract_address", STORY_FACTORY.toLowerCase()).single();

  if (!storyline) return new Response("Storyline not found", { status: 404 });
  const sl = storyline as Storyline;

  const [tvlInfo, plotUsd, fcProfile, fontData] = await Promise.all([
    sl.token_address ? getTokenTVL(sl.token_address as Address) : null,
    getPlotUsdPrice(),
    getFarcasterProfile(sl.writer_address).catch(() => null),
    loadFont(),
  ]);

  const titleDisplay = sl.title.length > 60 ? `${sl.title.slice(0, 57)}...` : sl.title;
  const isAi = sl.writer_type === 1;
  const authorName = isAi ? "P7 AI Writer" : (fcProfile ? `@${fcProfile.username}` : truncateAddress(sl.writer_address));
  const status = sl.sunset ? "Complete" : "Ongoing";
  const coverUrl = getCoverUrl(sl.cover_cid);
  const variants: FallbackVariant[] = ["A", "B", "C", "D"];
  const variant = variants[((id * 2654435761) >>> 0) % 4];

  let tvlUsd = "";
  let tvlPlot = "";
  if (tvlInfo) {
    const tvlNum = parseFloat(tvlInfo.tvl);
    if (plotUsd && tvlNum > 0) tvlUsd = formatUsdValue(tvlNum * plotUsd);
    const k = tvlNum >= 1000 ? `${(tvlNum / 1000).toFixed(1)}k` : tvlNum.toFixed(1);
    tvlPlot = `${k} ${RESERVE_LABEL}`;
  }

  const fonts = fontData ? [{ name: "Newsreader", data: fontData, weight: 500 as const }] : [];

  const badgeStyle = (colors: { bg: string; text: string }) => ({
    display: "flex" as const,
    fontSize: "11px",
    fontWeight: 600,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: "4px",
    padding: "3px 8px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  });

  const badges = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
      {sl.genre && <span style={badgeStyle(BADGE_COLORS.genre)}>{sl.genre}</span>}
      {isAi && <span style={badgeStyle(BADGE_COLORS.ai)}>AI Writer</span>}
      <span style={badgeStyle(BADGE_COLORS.status)}>{status}</span>
      {sl.content_type === "cartoon" && <span style={badgeStyle(BADGE_COLORS.cartoon)}>Cartoon</span>}
      {sl.is_nsfw && <span style={badgeStyle(BADGE_COLORS.nsfw)}>18+</span>}
    </div>
  );

  const coverSection = coverUrl ? (
    <div style={{ width: "460px", height: "100%", display: "flex", position: "relative", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coverUrl} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", top: "16px", left: "16px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {sl.genre && <span style={badgeStyle(BADGE_COLORS.genre)}>{sl.genre}</span>}
        {isAi && <span style={badgeStyle(BADGE_COLORS.ai)}>AI Writer</span>}
        <span style={badgeStyle(BADGE_COLORS.status)}>{status}</span>
      </div>
    </div>
  ) : (
    <div style={{ width: "460px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: FALLBACK_HEX[variant].bg, position: "relative" }}>
      <div style={{ position: "absolute", top: "16px", left: "16px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {sl.genre && <span style={badgeStyle(BADGE_COLORS.genre)}>{sl.genre}</span>}
        {isAi && <span style={badgeStyle(BADGE_COLORS.ai)}>AI Writer</span>}
        <span style={badgeStyle(BADGE_COLORS.status)}>{status}</span>
      </div>
      <div style={{ width: "50px", height: "1px", background: "rgba(0,0,0,0.15)", display: "flex" }} />
      <div style={{ fontSize: "28px", fontWeight: 500, color: "#4a4038", marginTop: "16px", textAlign: "center", padding: "0 32px", display: "flex", maxWidth: "400px" }}>
        {titleDisplay}
      </div>
      <div style={{ width: "50px", height: "1px", background: "rgba(0,0,0,0.15)", marginTop: "16px", display: "flex" }} />
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: "#faf8f5", fontFamily: fontData ? "Newsreader" : "Georgia, serif" }}>
        {coverSection}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 48px 48px 40px" }}>
          {coverUrl && badges}

          <div style={{ fontSize: titleDisplay.length > 35 ? "32px" : "38px", fontWeight: 500, color: "#1a1a1a", lineHeight: 1.25, display: "flex", marginBottom: "12px" }}>
            {titleDisplay}
          </div>

          <div style={{ display: "flex", fontSize: "16px", color: "#8a7e70", marginBottom: "20px" }}>
            by {authorName}
          </div>

          <div style={{ display: "flex", fontSize: "14px", color: "#8a7e70", marginBottom: "8px" }}>
            {sl.plot_count} {sl.plot_count === 1 ? "plot" : "plots"}
          </div>

          {tvlUsd && (
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", fontSize: "16px" }}>
              <span style={{ color: "#c04030", fontWeight: 600 }}>TVL: {tvlUsd}</span>
              {tvlPlot && <span style={{ color: "#8a7e70", fontSize: "13px" }}>({tvlPlot})</span>}
            </div>
          )}

          <div style={{ display: "flex", marginTop: "auto", fontSize: "13px", color: "#a09080" }}>
            plotlink.xyz
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    },
  );
}
