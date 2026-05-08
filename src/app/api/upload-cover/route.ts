import { NextRequest, NextResponse } from "next/server";
import { uploadBinaryWithRetry } from "../../../../lib/filebase";

const MAX_FILE_SIZE = 500 * 1024; // 500KB
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

const ALLOWED_TYPES: Record<string, number[]> = {
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF header
  "image/jpeg": [0xff, 0xd8, 0xff],
};

const ipRequestLog = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipRequestLog.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  ipRequestLog.set(ip, recent);
  return true;
}

function matchesMagicBytes(buffer: Uint8Array, expected: number[]): boolean {
  if (buffer.length < expected.length) return false;
  return expected.every((byte, i) => buffer[i] === byte);
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 5 uploads per minute." },
      { status: 429 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file in request" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024}KB.` },
        { status: 400 }
      );
    }

    const declaredType = file.type;
    if (!Object.keys(ALLOWED_TYPES).includes(declaredType)) {
      return NextResponse.json(
        { error: "Invalid file type. Only WebP and JPEG are accepted." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const expectedMagic = ALLOWED_TYPES[declaredType];
    if (!matchesMagicBytes(bytes, expectedMagic)) {
      return NextResponse.json(
        { error: "File content does not match declared type." },
        { status: 400 }
      );
    }

    const key = `plotlink/covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${declaredType === "image/webp" ? ".webp" : ".jpg"}`;

    const cid = await uploadBinaryWithRetry(
      Buffer.from(arrayBuffer),
      key,
      declaredType
    );

    return NextResponse.json({
      cid,
      url: `https://ipfs.filebase.io/ipfs/${cid}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
