// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("viem", () => ({
  recoverMessageAddress: vi.fn(),
}));

vi.mock("../../../../lib/filebase", () => ({
  uploadBinaryWithRetry: vi.fn(),
}));

import { POST } from "./route";
import { recoverMessageAddress } from "viem";
import { uploadBinaryWithRetry } from "../../../../lib/filebase";
import { NextRequest } from "next/server";

const mockedRecover = vi.mocked(recoverMessageAddress);
const mockedUpload = vi.mocked(uploadBinaryWithRetry);

// Valid JPEG magic bytes
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(100).fill(0)]);
// Valid WebP magic bytes
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, ...new Array(100).fill(0),
]);

function makeRequest(formData: FormData): NextRequest {
  const req = new NextRequest("http://localhost/api/upload-plot-images", {
    method: "POST",
    body: formData,
  });
  return req;
}

function makeSignedFormData(opts: {
  files?: { name: string; type: string; content: Uint8Array }[];
}) {
  const fd = new FormData();
  const ts = Date.now();
  fd.set("message", `PlotLink: Upload plot images\nTimestamp: ${ts}`);
  fd.set("signature", "0xfakesig");
  if (opts.files) {
    for (const f of opts.files) {
      fd.append("files", new File([f.content], f.name, { type: f.type }));
    }
  }
  return fd;
}

let walletCounter = 0;
function uniqueWallet(): `0x${string}` {
  walletCounter++;
  return `0x${walletCounter.toString().padStart(40, "0")}`;
}

describe("POST /api/upload-plot-images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRecover.mockImplementation(async () => uniqueWallet());
    mockedUpload.mockResolvedValue("QmFakeCid123456789012345678901234567890123456");
  });

  it("rejects missing signature", async () => {
    const fd = new FormData();
    fd.append("files", new File([JPEG_BYTES], "img.jpg", { type: "image/jpeg" }));
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(401);
  });

  it("rejects when no files provided", async () => {
    const fd = makeSignedFormData({ files: [] });
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/No files/);
  });

  it("rejects more than 20 files", async () => {
    const files = Array.from({ length: 21 }, (_, i) => ({
      name: `img${i}.jpg`,
      type: "image/jpeg",
      content: JPEG_BYTES,
    }));
    const fd = makeSignedFormData({ files });
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Too many files/);
  });

  it("returns per-file error for invalid mime type", async () => {
    const fd = makeSignedFormData({
      files: [
        { name: "good.jpg", type: "image/jpeg", content: JPEG_BYTES },
        { name: "bad.png", type: "image/png", content: new Uint8Array(100) },
      ],
    });
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results[0].cid).toBeDefined();
    expect(json.results[1].error).toMatch(/Invalid file type/);
  });

  it("returns per-file error for magic byte mismatch", async () => {
    const fd = makeSignedFormData({
      files: [
        { name: "fake.jpg", type: "image/jpeg", content: new Uint8Array(100) },
      ],
    });
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results[0].error).toMatch(/does not match/);
  });

  it("uploads valid files and returns ordered results", async () => {
    const fd = makeSignedFormData({
      files: [
        { name: "a.jpg", type: "image/jpeg", content: JPEG_BYTES },
        { name: "b.webp", type: "image/webp", content: WEBP_BYTES },
      ],
    });
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toHaveLength(2);
    expect(json.results[0].index).toBe(0);
    expect(json.results[0].cid).toBeDefined();
    expect(json.results[0].mimeType).toBe("image/jpeg");
    expect(json.results[0].sizeBytes).toBeGreaterThan(0);
    expect(json.results[1].index).toBe(1);
    expect(json.results[1].mimeType).toBe("image/webp");
  });

  it("rate limits at 3 batch requests per minute", async () => {
    const fixedWallet: `0x${string}` = "0xRATELIMITTEST000000000000000000000000000";
    mockedRecover.mockResolvedValue(fixedWallet);
    for (let i = 0; i < 3; i++) {
      const fd = makeSignedFormData({
        files: [{ name: "img.jpg", type: "image/jpeg", content: JPEG_BYTES }],
      });
      const res = await POST(makeRequest(fd));
      expect(res.status).toBe(200);
    }
    const fd = makeSignedFormData({
      files: [{ name: "img.jpg", type: "image/jpeg", content: JPEG_BYTES }],
    });
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(429);
  });
});
