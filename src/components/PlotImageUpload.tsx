"use client";

import { useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

interface PlotImageUploadProps {
  onInsert: (markdown: string) => void;
  disabled?: boolean;
}

export function PlotImageUpload({ onInsert, disabled }: PlotImageUploadProps) {
  const { isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!isConnected) {
      setError("Connect wallet to upload.");
      return;
    }
    const allowed = ["image/webp", "image/jpeg"];
    if (!allowed.includes(file.type)) {
      setError("Only WebP and JPEG accepted.");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Max 500KB.");
      return;
    }

    setUploading(true);
    try {
      const timestamp = Date.now();
      const message = `PlotLink: Upload plot image\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("message", message);
      formData.append("signature", signature);

      const res = await fetch("/api/upload-plot-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      onInsert(`\n![${alt}](${data.url})\n`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/webp,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading || !isConnected}
        className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        {uploading ? "Uploading…" : "Image"}
      </button>
      {error && <span className="text-[10px] text-error">{error}</span>}
    </div>
  );
}
