"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import {
  validateContentLength,
  MIN_CONTENT_LENGTH,
  MAX_CONTENT_LENGTH,
} from "../../../lib/content";
import { usePublish, type PublishState } from "../../hooks/usePublish";
import { PublishRecovery } from "../../components/PublishRecovery";
import { storyFactoryAbi, storylineCreatedEvent } from "../../../lib/contracts/abi";
import { STORY_FACTORY } from "../../../lib/contracts/constants";
import { decodeEventLog, encodeEventTopics } from "viem";
import Link from "next/link";
import { ConnectWallet } from "../../components/ConnectWallet";
import { DropdownSelect } from "../../components/DropdownSelect";
import { GENRES, LANGUAGES } from "../../../lib/genres";

const genreOptions = [
  { value: "", label: "Select genre..." },
  ...GENRES.map((g) => ({ value: g, label: g })),
];
const languageOptions = LANGUAGES.map((l) => ({ value: l, label: l }));

const STORYLINE_CREATED_TOPIC = encodeEventTopics({
  abi: [storylineCreatedEvent],
  eventName: "StorylineCreated",
})[0];

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
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("English");
  const [content, setContent] = useState("");
  const hasDeadline = true; // mandatory 7-day deadline for all storylines

  const { state, error, receipt, execute, reset } = usePublish();
  const { valid, charCount } = validateContentLength(content);
  const titleValid = title.trim().length > 0;
  const genreValid = genre.length > 0;
  const canSubmit =
    state === "idle" || state === "error"
      ? titleValid && genreValid && valid
      : false;

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-4 px-6">
        <div className="glow-border rounded-lg border border-border px-8 py-10 text-center">
          <p className="text-lg font-bold text-foreground">Begin your story</p>
          <p className="mt-2 text-sm text-muted">
            Connect your wallet to create a storyline.
          </p>
          <div className="mt-4">
            <ConnectWallet />
          </div>
        </div>
      </div>
    );
  }

  if (state === "published") {
    // Decode storylineId from receipt logs
    let newStorylineId: number | null = null;
    if (receipt) {
      const log = receipt.logs.find((l) => l.topics[0] === STORYLINE_CREATED_TOPIC);
      if (log) {
        try {
          const decoded = decodeEventLog({
            abi: storyFactoryAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "StorylineCreated") {
            newStorylineId = Number(decoded.args.storylineId);
          }
        } catch { /* ignore decode errors */ }
      }
    }

    return (
      <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-6 px-6">
        <div className="glow-border rounded-lg border border-border px-8 py-10 text-center">
          <h1 className="text-2xl font-bold text-accent">
            Storyline created!
          </h1>
          <p className="mt-2 text-sm text-muted">
            Your story is now live on-chain.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {newStorylineId != null && (
              <Link
                href={`/story/${newStorylineId}`}
                className="border-accent text-accent hover:bg-accent hover:text-background rounded border px-4 py-2 text-sm transition-colors"
              >
                View your story
              </Link>
            )}
            <Link
              href="/"
              className="border-border text-muted hover:text-foreground rounded border px-4 py-2 text-sm transition-colors"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const busy = state !== "idle" && state !== "error";

  return (
    <div className="animate-in mx-auto max-w-2xl px-6 py-12">
      {/* Recovery banner for failed indexing */}
      <PublishRecovery />

      {/* Manuscript header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          <span className="text-accent">New</span> Storyline
        </h1>
        <p className="mt-1 text-xs text-muted">
          Open a fresh manuscript. Your words become tokens.
        </p>
      </div>

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
                gas: BigInt(16_000_000),
              }),
              metadata: { genre, language },
            });
        }}
        className="space-y-6"
      >
        {/* Title — large, prominent */}
        <div>
          <label className="mb-2 block text-sm text-foreground">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            placeholder="The title of your story..."
            className="w-full rounded border border-border bg-surface px-4 py-3 text-lg font-bold text-foreground placeholder:font-normal placeholder:text-muted/50 focus:border-accent-dim focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Genre + Language */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm text-foreground">Genre</label>
            <DropdownSelect
              value={genre}
              onChange={setGenre}
              options={genreOptions}
              placeholder="Select genre..."
              disabled={busy}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-foreground">
              Language
            </label>
            <DropdownSelect
              value={language}
              onChange={setLanguage}
              options={languageOptions}
              disabled={busy}
            />
          </div>
        </div>

        {/* Content — manuscript style */}
        <div>
          <label className="mb-2 block text-sm text-foreground">
            Opening Chapter
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={busy}
            rows={16}
            placeholder="Begin your genesis plot..."
            className="manuscript-lines w-full resize-y rounded border border-border bg-surface px-4 py-3 text-sm leading-[1.85] text-foreground placeholder:text-muted/50 focus:border-accent-dim focus:outline-none disabled:opacity-50"
          />
          <div className="mt-1 flex justify-between text-xs">
            <span
              className={
                content.length > 0 && !valid ? "text-error" : "text-muted"
              }
            >
              {charCount.toLocaleString()} / {MIN_CONTENT_LENGTH.toLocaleString()}
              &ndash;
              {MAX_CONTENT_LENGTH.toLocaleString()} chars
            </span>
          </div>
        </div>

        {/* Deadline info */}
        <p className="text-xs text-muted">
          All storylines have a 7-day deadline — the story sunsets if no new
          plot is added within 7 days.
        </p>

        {/* Status */}
        {state === "error" && (
          <div className="rounded border border-error/30 px-3 py-2 text-xs text-error">
            {error}
          </div>
        )}
        {busy && (
          <div className="glow-border rounded border border-border px-3 py-2 text-xs text-muted">
            {STATE_LABELS[state]}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || busy}
          className="w-full rounded border border-accent py-3 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-background disabled:opacity-50"
        >
          {busy ? STATE_LABELS[state] : "Publish Storyline"}
        </button>
      </form>
    </div>
  );
}
