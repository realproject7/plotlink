import { NextRequest, NextResponse } from "next/server";
import { recoverMessageAddress } from "viem";
import { uploadBinaryWithRetry } from "../../../../lib/filebase";

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_FILES_PER_BATCH = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

const ALLOWED_MIME_TYPES = new Set(["image/webp", "image/jpeg"]);

const walletBatchLog = new Map<string, number[]>();

function checkRateLimit(wallet: string): boolean {
  const now = Date.now();
  const timestamps = walletBatchLog.get(wallet) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  walletBatchLog.set(wallet, recent);
  return true;
}

function validateMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 &&
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  }
  return false;
}

interface FileResult {
  index: number;
  cid?: string;
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const rawMessage = formData.get("message");
    const signature = formData.get("signature");

    if (typeof rawMessage !== "string" || typeof signature !== "string") {
      return NextResponse.json(
        { error: "Missing wallet signature. Please connect your wallet and try again." },
        { status: 401 }
      );
    }

    const message = rawMessage.replace(/\r\n/g, "\n");

    const timestampMatch = message.match(/Timestamp:\s*(\d+)/);
    if (!timestampMatch) {
      return NextResponse.json(
        { error: "Invalid message format." },
        { status: 401 }
      );
    }

    const timestamp = Number(timestampMatch[1]);
    const expectedMessage = `PlotLink: Upload plot images\nTimestamp: ${timestamp}`;
    if (message !== expectedMessage) {
      return NextResponse.json(
        { error: "Invalid message format." },
        { status: 401 }
      );
    }

    const age = Date.now() - timestamp;
    if (age > SIGNATURE_MAX_AGE_MS || age < -30_000) {
      return NextResponse.json(
        { error: "Signature expired. Please try again." },
        { status: 401 }
      );
    }

    const signer = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });
    const walletKey = signer.toLowerCase();

    if (!checkRateLimit(walletKey)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 3 batch uploads per minute." },
        { status: 429 }
      );
    }

    const files: File[] = [];
    const indexedFiles: { index: number; file: File }[] = [];
    for (const [key, value] of formData.entries()) {
      if (!(value instanceof File)) continue;
      if (key === "files" || key === "files[]") {
        files.push(value);
      } else {
        const m = key.match(/^file[_\[]?(\d+)\]?$/);
        if (m) {
          indexedFiles.push({ index: Number(m[1]), file: value });
        }
      }
    }
    if (indexedFiles.length > 0) {
      indexedFiles.sort((a, b) => a.index - b.index);
      for (const { file } of indexedFiles) {
        files.push(file);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES_PER_BATCH) {
      return NextResponse.json(
        { error: `Too many files. Maximum ${MAX_FILES_PER_BATCH} per batch.` },
        { status: 400 }
      );
    }

    const results: FileResult[] = await Promise.all(
      files.map(async (file, index): Promise<FileResult> => {
        if (file.size > MAX_FILE_SIZE) {
          return { index, error: "File too large. Maximum size is 1MB." };
        }

        const declaredType = file.type;
        if (!ALLOWED_MIME_TYPES.has(declaredType)) {
          return { index, error: "Invalid file type. Only WebP and JPEG are accepted." };
        }

        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        if (!validateMagicBytes(bytes, declaredType)) {
          return { index, error: "File content does not match declared type." };
        }

        try {
          const ext = declaredType === "image/webp" ? ".webp" : ".jpg";
          const key = `plotlink/plot-images/${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}${ext}`;

          const cid = await uploadBinaryWithRetry(
            Buffer.from(arrayBuffer),
            key,
            declaredType
          );

          return {
            index,
            cid,
            url: `https://ipfs.filebase.io/ipfs/${cid}`,
            mimeType: declaredType,
            sizeBytes: bytes.length,
          };
        } catch {
          return { index, error: "Upload failed" };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
