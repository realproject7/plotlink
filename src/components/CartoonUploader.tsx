"use client";

import { useState, useRef, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { CartoonPanel } from "../../lib/cartoon-markdown";

const MAX_FILES = 20;
const MAX_FILE_SIZE = 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/webp", "image/jpeg"]);

interface CartoonUploaderProps {
  panels: CartoonPanel[];
  onChange: (panels: CartoonPanel[]) => void;
  disabled?: boolean;
}

export function CartoonUploader({ panels, onChange, disabled }: CartoonUploaderProps) {
  const { isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragSourceIndex = useRef<number | null>(null);

  const uploadFiles = useCallback(async (files: File[]) => {
    setError(null);
    if (!isConnected) {
      setError("Connect your wallet to upload images.");
      return;
    }

    const remaining = MAX_FILES - panels.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_FILES} images per cartoon.`);
      return;
    }

    const batch = files.slice(0, remaining);
    for (const file of batch) {
      if (!ALLOWED_TYPES.has(file.type)) {
        setError("Only WebP and JPEG files are accepted.");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError("Each file must be under 1MB.");
        return;
      }
    }

    setUploading(true);
    try {
      const timestamp = Date.now();
      const message = `PlotLink: Upload plot images\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      const formData = new FormData();
      formData.append("message", message);
      formData.append("signature", signature);
      for (const file of batch) {
        formData.append("files", file);
      }

      const res = await fetch("/api/upload-plot-images", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const newPanels: CartoonPanel[] = [];
      for (const result of data.results) {
        if (result.error) {
          setError(`File ${result.index + 1}: ${result.error}`);
        } else {
          newPanels.push({
            cid: result.cid,
            url: result.url,
            alt: batch[result.index]?.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || "",
            label: "",
          });
        }
      }

      if (newPanels.length > 0) {
        onChange([...panels, ...newPanels]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [isConnected, signMessageAsync, panels, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || uploading) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadFiles(files);
  }, [disabled, uploading, uploadFiles]);

  const handleRemove = (index: number) => {
    onChange(panels.filter((_, i) => i !== index));
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const updated = [...panels];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChange(updated);
  };

  const handlePanelUpdate = (index: number, field: "alt" | "label", value: string) => {
    const updated = [...panels];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded border border-dashed border-border px-4 py-6 transition-colors hover:border-accent ${
          disabled || uploading ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {uploading ? (
          <span className="text-muted text-xs">Uploading...</span>
        ) : (
          <>
            <span className="text-muted text-xs">
              Drop images here or click to browse ({panels.length}/{MAX_FILES})
            </span>
            <span className="text-muted text-[10px]">WebP or JPEG, max 1MB each</span>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/webp,image/jpeg"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) uploadFiles(files);
          e.target.value = "";
        }}
      />

      {error && <p className="text-error text-[11px]">{error}</p>}

      {panels.length > 0 && (
        <div className="space-y-2">
          {panels.map((panel, index) => (
            <div
              key={`${panel.cid}-${index}`}
              draggable={!disabled}
              onDragStart={() => { dragSourceIndex.current = index; }}
              onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverIndex(null);
                if (dragSourceIndex.current !== null) {
                  handleReorder(dragSourceIndex.current, index);
                  dragSourceIndex.current = null;
                }
              }}
              className={`flex items-start gap-3 rounded border px-3 py-2 transition-colors ${
                dragOverIndex === index ? "border-accent bg-accent/5" : "border-border"
              }`}
            >
              <div className="flex flex-col items-center gap-1 pt-1">
                <span className="text-muted text-[10px] font-mono cursor-grab active:cursor-grabbing">⋮⋮</span>
                <span className="text-muted text-[10px] font-mono">{index + 1}</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={panel.url}
                alt={panel.alt}
                className="h-16 w-16 shrink-0 rounded object-cover border border-border"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <input
                  type="text"
                  value={panel.label}
                  onChange={(e) => handlePanelUpdate(index, "label", e.target.value)}
                  disabled={disabled}
                  placeholder="Scene label (optional)"
                  className="w-full border-border bg-surface text-foreground placeholder:text-muted rounded border px-2 py-1 text-[11px] focus:border-accent focus:outline-none disabled:opacity-50"
                />
                <input
                  type="text"
                  value={panel.alt}
                  onChange={(e) => handlePanelUpdate(index, "alt", e.target.value)}
                  disabled={disabled}
                  placeholder="Alt text (optional)"
                  className="w-full border-border bg-surface text-foreground placeholder:text-muted rounded border px-2 py-1 text-[11px] focus:border-accent focus:outline-none disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                className="text-error hover:text-error/80 shrink-0 text-xs transition-colors disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
