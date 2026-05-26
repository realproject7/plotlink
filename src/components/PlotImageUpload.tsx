"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";

interface UploadedImage {
  cid: string;
  url: string;
  alt: string;
}

interface PlotImageUploadProps {
  disabled?: boolean;
}

export function PlotImageUpload({ disabled }: PlotImageUploadProps) {
  const { isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
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
    if (file.size > 1024 * 1024) {
      setError("Max 1MB.");
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
      setImages((prev) => [...prev, { cid: data.cid, url: data.url, alt }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [isConnected, signMessageAsync]);

  function copyMarkdown(img: UploadedImage) {
    const md = `![${img.alt}](${img.url})`;
    navigator.clipboard.writeText(md);
    setCopied(img.cid);
    setTimeout(() => setCopied(null), 2000);
  }

  function removeImage(cid: string) {
    setImages((prev) => prev.filter((i) => i.cid !== cid));
  }

  return (
    <div className="mt-2">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={open}
          onChange={(e) => setOpen(e.target.checked)}
          disabled={disabled}
          className="h-3.5 w-3.5 rounded border-border accent-accent"
        />
        <span className="text-foreground text-xs">Add illustrations in the plot</span>
      </label>

      {open && (
        <div className="mt-2 space-y-2">
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

          <div
            onClick={() => !disabled && !uploading && isConnected && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files[0];
              if (file && !disabled && !uploading) handleFile(file);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded border border-dashed border-border px-4 py-4 transition-colors hover:border-accent ${
              disabled || uploading ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {uploading ? (
              <span className="text-muted text-xs">Uploading...</span>
            ) : !isConnected ? (
              <span className="text-muted text-xs">Connect wallet to upload</span>
            ) : (
              <span className="text-muted text-xs">Drop image here or click to browse</span>
            )}
          </div>
          <p className="text-muted text-[10px]">WebP or JPEG, max 1MB</p>

          {error && <p className="text-[11px] text-error">{error}</p>}

          {images.map((img) => {
            const md = `![${img.alt}](${img.url})`;
            return (
              <div key={img.cid} className="rounded border border-border bg-surface px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <img
                    src={img.url}
                    alt={img.alt}
                    className="h-[60px] w-[60px] shrink-0 rounded border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted mb-1 text-[10px]">
                      Copy the markdown below and paste it where you want the illustration to appear:
                    </p>
                    <div className="flex items-center gap-1.5">
                      <code className="block min-w-0 flex-1 truncate rounded bg-[var(--bg)] px-2 py-1 font-mono text-[10px] text-foreground">
                        {md}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyMarkdown(img)}
                        className="shrink-0 rounded border border-border px-2 py-1 text-[10px] font-medium text-muted transition-colors hover:border-accent hover:text-accent"
                      >
                        {copied === img.cid ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(img.cid)}
                    className="text-error hover:text-error/80 shrink-0 text-[11px] transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
