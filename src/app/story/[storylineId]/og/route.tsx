import { ImageResponse } from "next/og";
import { type Address } from "viem";
import { createServerClient, type Storyline } from "../../../../../lib/supabase";
import { getTokenPrice } from "../../../../../lib/price";
import { lookupByAddress } from "../../../../../lib/farcaster";
import { RESERVE_LABEL, STORY_FACTORY } from "../../../../../lib/contracts/constants";
import { formatPrice } from "../../../../../lib/format";
import { truncateAddress } from "../../../../../lib/utils";

export const runtime = "edge";

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    // Fetch with no User-Agent → Google returns TTF (truetype) format
    // ImageResponse supports ttf/otf/woff but NOT woff2
    const res = await fetch(
      "https://fonts.googleapis.com/css2?family=Lora:wght@700&display=swap",
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

  const [priceInfo, farcasterProfile, fontData] = await Promise.all([
    sl.token_address ? getTokenPrice(sl.token_address as Address) : null,
    lookupByAddress(sl.writer_address).catch(() => null),
    loadFont(),
  ]);

  const reserveLabel = RESERVE_LABEL;
  const priceDisplay = priceInfo
    ? `${formatPrice(priceInfo.pricePerToken)} ${reserveLabel}`
    : null;
  const authorName = farcasterProfile
    ? `@${farcasterProfile.username}`
    : truncateAddress(sl.writer_address);
  const plotLabel = sl.plot_count === 1 ? "plot" : "plots";
  const titleDisplay =
    sl.title.length > 70 ? `${sl.title.slice(0, 67)}...` : sl.title;

  const fonts = fontData
    ? [{ name: "Lora", data: fontData, weight: 700 as const }]
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#DDD3C2",
          padding: "32px",
          fontFamily: fontData ? "Lora" : "Georgia, serif",
        }}
      >
        {/* Notebook page */}
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#F5F0E8",
            borderRadius: "8px",
            padding: "0",
            boxShadow: "4px 4px 16px rgba(44, 24, 16, 0.15)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Red margin line */}
          <div
            style={{
              position: "absolute",
              left: "80px",
              top: "0",
              bottom: "0",
              width: "2px",
              backgroundColor: "hsl(350, 35%, 88%)",
              display: "flex",
            }}
          />

          {/* Ruled lines */}
          <div
            style={{
              position: "absolute",
              top: "0",
              left: "0",
              right: "0",
              bottom: "0",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              paddingTop: "56px",
              gap: "0",
            }}
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: "100%",
                  height: "34px",
                  borderBottom: "1px solid hsl(234, 25%, 93%)",
                  display: "flex",
                }}
              />
            ))}
          </div>

          {/* Content overlay */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              padding: "48px 56px 40px 104px",
              position: "relative",
            }}
          >
            {/* Top: PlotLink branding */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#8B4513",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                PlotLink
              </div>
              {sl.genre && (
                <div
                  style={{
                    fontSize: "16px",
                    color: "#8B7355",
                    border: "1px solid #D4C5B0",
                    borderRadius: "4px",
                    padding: "4px 12px",
                    display: "flex",
                  }}
                >
                  {sl.genre}
                </div>
              )}
            </div>

            {/* Center: Story title */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                flex: "1",
                justifyContent: "center",
                paddingRight: "24px",
              }}
            >
              <div
                style={{
                  fontSize: titleDisplay.length > 40 ? "42px" : "52px",
                  fontWeight: 700,
                  color: "#2C1810",
                  lineHeight: 1.2,
                  display: "flex",
                }}
              >
                {titleDisplay}
              </div>
              <div
                style={{
                  fontSize: "24px",
                  color: "#8B7355",
                  display: "flex",
                }}
              >
                by {authorName}
              </div>
            </div>

            {/* Bottom: metadata bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "2px solid #D4C5B0",
                paddingTop: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "32px",
                  fontSize: "20px",
                  color: "#8B7355",
                }}
              >
                <span style={{ display: "flex" }}>
                  {sl.plot_count} {plotLabel}
                </span>
                {priceDisplay && (
                  <span style={{ display: "flex", color: "#8B4513", fontWeight: 700 }}>
                    {priceDisplay}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "16px",
                  color: "#D4C5B0",
                  display: "flex",
                }}
              >
                plotlink.xyz
              </div>
            </div>
          </div>
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
