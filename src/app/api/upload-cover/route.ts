import { NextRequest, NextResponse } from "next/server";
import { uploadBinaryWithRetry } from "../../../../lib/filebase";

const MAX_FILE_SIZE = 500 * 1024; // 500KB
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

const ALLOWED_MIME_TYPES = new Set(["image/webp", "image/jpeg"]);

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

function validateMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 &&
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    // RIFF at bytes 0-3, WEBP at bytes 8-11
    return buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  }
  return false;
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
    if (!ALLOWED_MIME_TYPES.has(declaredType)) {
      return NextResponse.json(
        { error: "Invalid file type. Only WebP and JPEG are accepted." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (!validateMagicBytes(bytes, declaredType)) {
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
