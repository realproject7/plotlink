"use client";

import { useState, useRef, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useRouter } from "next/navigation";
import { DropdownSelect } from "./DropdownSelect";
import { GENRES, LANGUAGES } from "../../lib/genres";
import { getCoverUrl } from "../../lib/cover";

const genreOptions = [
  { value: "", label: "Select genre..." },
  ...GENRES.map((g) => ({ value: g, label: g })),
];
const languageOptions = LANGUAGES.map((l) => ({ value: l, label: l }));

interface StoryEditPanelProps {
  storylineId: number;
  writerAddress: string;
  currentGenre: string | null;
  currentLanguage: string | null;
  currentCoverCid: string | null;
  currentIsNsfw: boolean;
}

export function StoryEditPanel({
  storylineId,
  writerAddress,
  currentGenre,
  currentLanguage,
  currentCoverCid,
  currentIsNsfw,
}: StoryEditPanelProps) {
  const { address } = useAccount();
  const router = useRouter();
  const { signMessageAsync } = useSignMessage();

  const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS?.toLowerCase();
  const isAuthor = address?.toLowerCase() === writerAddress.toLowerCase();
  const isAdmin = !!(ADMIN_WALLET && address?.toLowerCase() === ADMIN_WALLET);
  const canEdit = isAuthor || isAdmin;
  const [editing, setEditing] = useState(false);
  const [genre, setGenre] = useState(currentGenre ?? "");
  const [language, setLanguage] = useState(currentLanguage ?? "English");
  const [coverCid, setCoverCid] = useState<string | null>(currentCoverCid);
  const [isNsfw, setIsNsfw] = useState(currentIsNsfw);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverSelect = useCallback(async (file: File) => {
    setCoverError(null);
    if (!["image/webp", "image/jpeg"].includes(file.type)) {
      setCoverError("Only WebP and JPEG files are accepted.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setCoverError("File too large. Maximum size is 1MB.");
      return;
    }
    setCoverUploading(true);
    try {
      const timestamp = Date.now();
      const message = `PlotLink: Upload cover image\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("message", message);
      formData.append("signature", signature);
      const res = await fetch("/api/upload-cover", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setCoverCid(data.cid);
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setCoverUploading(false);
    }
  }, [signMessageAsync]);

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const timestamp = Date.now();
      const message = `PlotLink: Update storyline #${storylineId}\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      const body: Record<string, unknown> = {
        storylineId,
        signature,
        message,
      };
      if (genre !== (currentGenre ?? "")) body.genre = genre || null;
      if (language !== (currentLanguage ?? "English")) body.language = language;
      if (coverCid !== currentCoverCid) body.coverCid = coverCid;
      if (isNsfw !== currentIsNsfw) body.isNsfw = isNsfw;

      const res = await fetch("/api/storyline/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      setSaveSuccess(true);
      setTimeout(() => {
        setEditing(false);
        setSaveSuccess(false);
        router.refresh();
      }, 1000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setGenre(currentGenre ?? "");
    setLanguage(currentLanguage ?? "English");
    setCoverCid(currentCoverCid);
    setIsNsfw(currentIsNsfw);
    setCoverError(null);
    setSaveError(null);
    setEditing(false);
  };

  if (!canEdit) return null;

  if (!editing) {
    return (
      <div className="mt-4">
        <button
          onClick={() => setEditing(true)}
          className="border-border text-muted hover:text-foreground hover:border-foreground/30 rounded border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          Edit Details
        </button>
      </div>
    );
  }

  const coverUrl = coverCid ? getCoverUrl(coverCid) : null;

  return (
    <div className="mt-4 rounded-[var(--card-radius)] border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Edit Story Details</h3>
        <button onClick={handleCancel} className="text-muted hover:text-foreground text-xs transition-colors">
          Cancel
        </button>
      </div>

      {/* Cover Image */}
      <div>
        <label className="text-foreground mb-1 block text-xs font-medium">Cover Image</label>
        <p className="text-muted mb-1 text-[10px]">WebP or JPEG, max 1MB. Recommended: 600×900px (2:3 portrait).</p>
        <p className="text-muted mb-2 text-[9px]">
          PlotLink may replace or remove cover images that violate our Terms or do not meet quality guidelines.
        </p>
        {coverUrl ? (
          <div className="flex items-start gap-3">
            <div className="relative h-[90px] w-[60px] shrink-0 overflow-hidden rounded border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-muted break-all text-[9px] font-mono">{coverCid}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverUploading || saving}
                  className="text-accent text-[11px] transition-colors hover:opacity-80 disabled:opacity-50"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => { setCoverCid(null); setCoverError(null); if (coverInputRef.current) coverInputRef.current.value = ""; }}
                  disabled={saving}
                  className="text-error text-[11px] transition-colors hover:opacity-80 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={coverUploading || saving}
            className="flex w-full items-center justify-center rounded border border-dashed border-border px-4 py-4 text-xs text-muted transition-colors hover:border-accent disabled:opacity-50"
          >
            {coverUploading ? "Uploading..." : "Upload cover image"}
          </button>
        )}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/webp,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleCoverSelect(file);
          }}
        />
        {coverError && <p className="text-error mt-1 text-[10px]">{coverError}</p>}
      </div>

      {/* Genre & Language */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-foreground mb-1 block text-xs font-medium">Genre</label>
          <DropdownSelect
            value={genre}
            onChange={setGenre}
            options={genreOptions}
            placeholder="Select genre..."
            disabled={saving}
          />
        </div>
        <div>
          <label className="text-foreground mb-1 block text-xs font-medium">Language</label>
          <DropdownSelect
            value={language}
            onChange={setLanguage}
            options={languageOptions}
            disabled={saving}
          />
        </div>
      </div>

      {/* NSFW Toggle */}
      <div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isNsfw}
            onChange={(e) => setIsNsfw(e.target.checked)}
            disabled={saving}
            className="h-3.5 w-3.5 rounded border-border accent-accent"
          />
          <span className="text-foreground text-xs">This story contains adult content (18+)</span>
        </label>
        {isNsfw && (
          <p className="text-muted mt-1 ml-5.5 text-[10px]">
            Adult content will be hidden from the default browse view.
          </p>
        )}
      </div>

      {/* Error / Success */}
      {saveError && (
        <div className="border-error/30 text-error rounded border px-3 py-2 text-[11px]">{saveError}</div>
      )}
      {saveSuccess && (
        <div className="border-accent/30 text-accent rounded border px-3 py-2 text-[11px]">Updated successfully!</div>
      )}

      {/* Save */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || coverUploading}
          className="border-accent text-accent hover:bg-accent hover:text-background rounded border px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "Signing..." : "Save Changes"}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="border-border text-muted hover:text-foreground rounded border px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
