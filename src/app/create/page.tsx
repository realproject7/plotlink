"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import {
  validateContentLength,
  MIN_CONTENT_LENGTH,
  MAX_CONTENT_LENGTH,
} from "../../../lib/content";
import { usePublish, type PublishState } from "../../hooks/usePublish";
import { storyFactoryAbi } from "../../../lib/contracts/abi";
import { STORY_FACTORY } from "../../../lib/contracts/constants";
import Link from "next/link";

const STATE_LABELS: Record<PublishState, string> = {
  idle: "",
  uploading: "Uploading to IPFS...",
  confirming: "Confirm in wallet...",
  pending: "Publishing to Base...",
  indexing: "Indexing...",
  published: "Published!",
  error: "Error",
};

export default function CreateStorylinePage() {
  const { isConnected } = useAccount();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hasDeadline, setHasDeadline] = useState(false);

  const { state, error, execute, reset } = usePublish();
  const { valid, charCount } = validateContentLength(content);
  const titleValid = title.trim().length > 0;
  const canSubmit =
    state === "idle" || state === "error"
      ? titleValid && valid
      : false;

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted text-sm">
          Connect your wallet to create a storyline.
        </p>
      </div>
    );
  }

  if (state === "published") {
    return (
      <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-6 px-6">
        <h1 className="text-accent text-2xl font-bold">Storyline created!</h1>
        <div className="flex gap-3">
          <Link
            href="/discover"
            className="border-border text-muted hover:text-foreground rounded border px-4 py-2 text-sm transition-colors"
          >
            Discover
          </Link>
          <button
            onClick={reset}
            className="border-accent text-accent hover:bg-accent hover:text-background rounded border px-4 py-2 text-sm transition-colors"
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  const busy = state !== "idle" && state !== "error";

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-accent text-2xl font-bold tracking-tight">
        Create Storyline
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit)
            execute({
              content,
              uploadKeyPrefix: "plotlink/genesis",
              indexerRoute: "/api/index/storyline",
              buildWriteCall: (cid, contentHash) => ({
                address: STORY_FACTORY,
                abi: storyFactoryAbi as unknown as [],
                functionName: "createStoryline",
                args: [title.trim(), cid, contentHash, hasDeadline],
              }),
            });
        }}
        className="mt-8 space-y-6"
      >
        {/* Title */}
        <div>
          <label className="text-foreground mb-2 block text-sm">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            placeholder="Enter storyline title"
            className="border-border bg-surface text-foreground placeholder:text-muted w-full rounded border px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Content */}
        <div>
          <label className="text-foreground mb-2 block text-sm">
            Opening Chapter
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={busy}
            rows={12}
            placeholder="Write the genesis plot (500–10,000 characters)"
            className="border-border bg-surface text-foreground placeholder:text-muted w-full resize-y rounded border px-3 py-2 text-sm leading-relaxed focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <div className="mt-1 flex justify-between text-xs">
            <span
              className={
                content.length > 0 && !valid ? "text-error" : "text-muted"
              }
            >
              {charCount.toLocaleString()} / {MIN_CONTENT_LENGTH.toLocaleString()}–
              {MAX_CONTENT_LENGTH.toLocaleString()} chars
            </span>
          </div>
        </div>

        {/* Deadline toggle */}
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={hasDeadline}
            onChange={(e) => setHasDeadline(e.target.checked)}
            disabled={busy}
            className="accent-accent h-4 w-4"
          />
          <span className="text-foreground text-sm">
            Enable 72h deadline
          </span>
          <span className="text-muted text-xs">
            Story sunsets if no new plot within 72 hours
          </span>
        </label>

        {/* Status */}
        {state === "error" && (
          <div className="border-error/30 text-error rounded border px-3 py-2 text-xs">
            {error}
          </div>
        )}
        {busy && (
          <div className="border-border text-muted rounded border px-3 py-2 text-xs">
            {STATE_LABELS[state]}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || busy}
          className="border-accent text-accent hover:bg-accent hover:text-background w-full rounded border py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {busy ? STATE_LABELS[state] : "Publish Storyline"}
        </button>
      </form>
    </div>
  );
}
