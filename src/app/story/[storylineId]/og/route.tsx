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
      "https://fonts.googleapis.com/css2?family=Lora:wght@400;700&display=swap",
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
    sl.title.length > 60 ? `${sl.title.slice(0, 57)}...` : sl.title;

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
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#DDD3C2",
          padding: "40px 60px",
          fontFamily: fontData ? "Lora" : "Georgia, serif",
        }}
      >
        {/* Left: Moleskine notebook cover */}
        <div
          style={{
            width: "370px",
            height: "530px",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#F5EFE6",
            borderRadius: "5px 15px 15px 5px",
            border: "1px solid #D4C5B0",
            boxShadow:
              "4px 6px 20px rgba(44, 24, 16, 0.18), 1px 1px 4px rgba(44, 24, 16, 0.08)",
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {/* Elastic band */}
          <div
            style={{
              position: "absolute",
              top: "-1px",
              bottom: "-1px",
              right: "22px",
              width: "8px",
              borderRadius: "2px",
              background: "rgba(139, 69, 19, 0.18)",
              display: "flex",
            }}
          />

          {/* Ruled lines background */}
          <div
            style={{
              position: "absolute",
              top: "0",
              left: "0",
              right: "0",
              bottom: "0",
              display: "flex",
              flexDirection: "column",
              paddingTop: "28px",
            }}
          >
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: "100%",
                  height: "28px",
                  borderBottom: "1px solid rgba(232, 223, 208, 0.6)",
                  display: "flex",
                }}
              />
            ))}
          </div>

          {/* Content inside notebook: title + author */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              flex: 1,
              padding: "40px 32px",
              position: "relative",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: titleDisplay.length > 35 ? "32px" : "38px",
                fontWeight: 700,
                color: "#8B4513",
                lineHeight: 1.25,
                display: "flex",
                textAlign: "center",
                justifyContent: "center",
                maxWidth: "290px",
              }}
            >
              {titleDisplay}
            </div>
            <div
              style={{
                fontSize: "18px",
                color: "#8B7355",
                marginTop: "20px",
                display: "flex",
              }}
            >
              by {authorName}
            </div>
          </div>
        </div>

        {/* Right: Metadata on dark background */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "530px",
            marginLeft: "56px",
            flex: 1,
            maxWidth: "580px",
          }}
        >
          {/* Top: PlotLink branding */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "28px",
                fontWeight: 700,
                color: "#8B4513",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              PlotLink
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "16px",
                color: "#8B7355",
                letterSpacing: "0.03em",
              }}
            >
              Tokenised collaborative fiction
            </div>
          </div>

          {/* Middle: genre + stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {sl.genre ? (
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  fontSize: "16px",
                  color: "#8B7355",
                  border: "1.5px solid #C4B59E",
                  borderRadius: "4px",
                  padding: "6px 16px",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {sl.genre}
              </div>
            ) : (
              <div style={{ display: "flex" }} />
            )}
            <div
              style={{
                display: "flex",
                gap: "28px",
                fontSize: "22px",
                color: "#6B5B47",
              }}
            >
              <span style={{ display: "flex" }}>
                {sl.plot_count} {plotLabel}
              </span>
              {priceDisplay && (
                <span
                  style={{
                    display: "flex",
                    color: "#8B4513",
                    fontWeight: 700,
                  }}
                >
                  {priceDisplay}
                </span>
              )}
            </div>
          </div>

          {/* Bottom: domain */}
          <div
            style={{
              display: "flex",
              fontSize: "18px",
              color: "#A89880",
            }}
          >
            plotlink.xyz
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
