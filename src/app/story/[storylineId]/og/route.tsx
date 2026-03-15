import { ImageResponse } from "next/og";
import { createServerClient, type Storyline } from "../../../../../lib/supabase";
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
    .single();

  if (!storyline) {
    return new Response("Storyline not found", { status: 404 });
  }

  const sl = storyline as Storyline;

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
          backgroundColor: "#0a0a0a",
          color: "#e0e0e0",
          fontFamily: "monospace",
        }}
      >
        {/* Top: branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "24px",
            color: "#00ff88",
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
              color: "#00ff88",
              lineClamp: 3,
              overflow: "hidden",
            }}
          >
            {sl.title}
          </div>
        </div>

        {/* Bottom: metadata */}
        <div
          style={{
            display: "flex",
            gap: "32px",
            fontSize: "22px",
            color: "#737373",
          }}
        >
          <span>by {truncateAddress(sl.writer_address)}</span>
          <span>
            {sl.plot_count} {sl.plot_count === 1 ? "plot" : "plots"}
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    },
  );
}
