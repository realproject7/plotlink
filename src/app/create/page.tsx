"use client";

import { Suspense, useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  validateContentLength,
  MIN_CONTENT_LENGTH,
  MAX_CONTENT_LENGTH,
} from "../../../lib/content";
import { usePublish, type PublishState } from "../../hooks/usePublish";
import { useChainPlot } from "../../hooks/useChainPlot";
import { usePublishIntent } from "../../hooks/usePublishIntent";
import { RecoveryBanner } from "../../components/RecoveryBanner";
import { storyFactoryAbi, storylineCreatedEvent } from "../../../lib/contracts/abi";
import { STORY_FACTORY } from "../../../lib/contracts/constants";
import { supabase, type Storyline } from "../../../lib/supabase";
import { decodeEventLog, encodeEventTopics } from "viem";
import Link from "next/link";
import { ConnectWallet } from "../../components/ConnectWallet";
import { DropdownSelect } from "../../components/DropdownSelect";
import { Select } from "../../components/Select";
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

type Tab = "new" | "chain";

async function fetchWriterStorylines(address: string): Promise<Storyline[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("storylines")
    .select("*")
    .eq("writer_address", address.toLowerCase())
    .eq("hidden", false)
    .eq("sunset", false)
    .eq("contract_address", STORY_FACTORY.toLowerCase())
    .order("block_timestamp", { ascending: false })
    .returns<Storyline[]>();
  return data ?? [];
}

export default function CreatePageWrapper() {
  return (
    <Suspense>
      <CreatePage />
    </Suspense>
  );
}

function CreatePage() {
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();

  // Tab selection from query params
  const initialTab: Tab =
    searchParams.get("tab") === "chain" || searchParams.get("storyline")
      ? "chain"
      : "new";
  const [tab, setTab] = useState<Tab>(initialTab);

  // ---- New Storyline state ----
  const [newTitle, setNewTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("English");
  const [newContent, setNewContent] = useState("");
  const hasDeadline = true;

  const { state: newState, error: newError, receipt, execute } = usePublish();
  const {
    pendingIntent: newPendingIntent,
    saveIntent: newSaveIntent,
    persistTxHash: newPersistTxHash,
    clearIntent: newClearIntent,
    attemptRetry: newAttemptRetry,
  } = usePublishIntent();
  const { valid: newValid, charCount: newCharCount } = validateContentLength(newContent);
  const newTitleValid = newTitle.trim().length > 0;
  const newGenreValid = genre.length > 0;
  const newCanSubmit =
    newState === "idle" || newState === "error"
      ? newTitleValid && newGenreValid && newValid
      : false;
  const newBusy = newState !== "idle" && newState !== "error";

  // ---- Chain Plot state ----
  const prefillStoryline = searchParams.get("storyline");
  const [chainStorylineId, setChainStorylineId] = useState<number | null>(
    prefillStoryline ? Number(prefillStoryline) : null,
  );
  const [chainTitle, setChainTitle] = useState("");
  const [chainContent, setChainContent] = useState("");

  const { data: storylines = [], isLoading: loadingStorylines } = useQuery({
    queryKey: ["writer-active-storylines", address],
    queryFn: () => fetchWriterStorylines(address!),
    enabled: isConnected && !!address,
  });

  const {
    pendingIntent: chainPendingIntent,
    saveIntent: chainSaveIntent,
    persistTxHash: chainPersistTxHash,
    clearIntent: chainClearIntent,
    attemptRetry: chainAttemptRetry,
  } = usePublishIntent();
  const {
    state: chainState,
    error: chainError,
    chainPlot,
    reset: chainReset,
  } = useChainPlot({
    onIntentSave: chainSaveIntent,
    onTxConfirmed: chainPersistTxHash,
    onIndexed: chainClearIntent,
  });
  const { valid: chainValid, charCount: chainCharCount } = validateContentLength(chainContent);
  const chainTitleValid = chainTitle.trim().length > 0;
  const chainCanSubmit =
    (chainState === "idle" || chainState === "error") &&
    chainStorylineId !== null &&
    chainTitleValid &&
    chainValid;
  const chainBusy = chainState !== "idle" && chainState !== "error";

  // Prefill storyline from query param when storylines load
  useEffect(() => {
    if (prefillStoryline && storylines.length > 0) {
      const id = Number(prefillStoryline);
      if (storylines.some((s) => s.storyline_id === id)) {
        setChainStorylineId(id);
      }
    }
  }, [prefillStoryline, storylines]);

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted text-sm">
          Connect your wallet to create or chain a plot.
        </p>
        <ConnectWallet />
      </div>
    );
  }

  // ---- New Storyline published state ----
  if (tab === "new" && newState === "published") {
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
        <h1 className="text-accent text-2xl font-bold">Storyline created!</h1>
        <div className="flex gap-3">
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
    );
  }

  // ---- Chain Plot published state ----
  if (tab === "chain" && chainState === "published") {
    return (
      <div className="flex min-h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-6 px-6">
        <h1 className="text-accent text-2xl font-bold">Plot chained!</h1>
        <div className="flex gap-3">
          {chainStorylineId && (
            <Link
              href={`/story/${chainStorylineId}`}
              className="border-border text-muted hover:text-foreground rounded border px-4 py-2 text-sm transition-colors"
            >
              View story
            </Link>
          )}
          <button
            onClick={chainReset}
            className="border-accent text-accent hover:bg-accent hover:text-background rounded border px-4 py-2 text-sm transition-colors"
          >
            Chain another
          </button>
        </div>
      </div>
    );
  }

  const noStoryline = chainStorylineId === null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-accent text-2xl font-bold tracking-tight">Create</h1>

      {/* Tab bar */}
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setTab("new")}
          className={`rounded border px-3 py-1 text-xs font-medium transition-colors ${
            tab === "new"
              ? "border-accent text-accent"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          New
        </button>
        <button
          onClick={() => setTab("chain")}
          className={`rounded border px-3 py-1 text-xs font-medium transition-colors ${
            tab === "chain"
              ? "border-accent text-accent"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          Add Plot
        </button>
      </div>

      {/* ---- New Storyline Tab ---- */}
      {tab === "new" && (
        <>
          {newPendingIntent && (
            <div className="mt-6">
              <RecoveryBanner
                intent={newPendingIntent}
                onRetry={newAttemptRetry}
                onDismiss={newClearIntent}
              />
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newCanSubmit)
                execute({
                  content: newContent,
                  uploadKeyPrefix: "plotlink/genesis",
                  indexerRoute: "/api/index/storyline",
                  buildWriteCall: (cid, contentHash) => ({
                    address: STORY_FACTORY,
                    abi: storyFactoryAbi as unknown as [],
                    functionName: "createStoryline",
                    args: [newTitle.trim(), cid, contentHash, hasDeadline],
                    gas: BigInt(16_000_000),
                  }),
                  metadata: { genre, language },
                  onIntentSave: newSaveIntent,
                  onTxConfirmed: newPersistTxHash,
                  onIndexed: newClearIntent,
                });
            }}
            className="mt-6 space-y-6"
          >
            <div>
              <label className="text-foreground mb-2 block text-sm">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                disabled={newBusy}
                placeholder="Enter storyline title"
                className="border-border bg-surface text-foreground placeholder:text-muted w-full rounded border px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-foreground mb-2 block text-sm">Genre</label>
                <DropdownSelect
                  value={genre}
                  onChange={setGenre}
                  options={genreOptions}
                  placeholder="Select genre..."
                  disabled={newBusy}
                />
              </div>
              <div>
                <label className="text-foreground mb-2 block text-sm">Language</label>
                <DropdownSelect
                  value={language}
                  onChange={setLanguage}
                  options={languageOptions}
                  disabled={newBusy}
                />
              </div>
            </div>

            <div>
              <label className="text-foreground mb-2 block text-sm">Opening Chapter</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                disabled={newBusy}
                rows={12}
                placeholder="Write the genesis plot (500\u201310,000 characters)"
                className="border-border bg-surface text-foreground placeholder:text-muted w-full resize-y rounded border px-3 py-2 text-sm leading-relaxed focus:border-accent focus:outline-none disabled:opacity-50"
              />
              <div className="mt-1 flex justify-between text-xs">
                <span className={newContent.length > 0 && !newValid ? "text-error" : "text-muted"}>
                  {newCharCount.toLocaleString()} / {MIN_CONTENT_LENGTH.toLocaleString()}&ndash;
                  {MAX_CONTENT_LENGTH.toLocaleString()} chars
                </span>
              </div>
            </div>

            <p className="text-muted text-xs">
              All storylines have a 7-day deadline &mdash; the story sunsets if no new plot is added within 7 days.
            </p>

            {newState === "error" && (
              <div className="border-error/30 text-error rounded border px-3 py-2 text-xs">
                {newError}
              </div>
            )}
            {newBusy && (
              <div className="border-border text-muted rounded border px-3 py-2 text-xs">
                {STATE_LABELS[newState]}
              </div>
            )}

            <button
              type="submit"
              disabled={!newCanSubmit || newBusy}
              className="border-accent text-accent hover:bg-accent hover:text-background w-full rounded border py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {newBusy ? STATE_LABELS[newState] : "Publish Storyline"}
            </button>
          </form>
        </>
      )}

      {/* ---- Add Plot Tab ---- */}
      {tab === "chain" && (
        <>
          {chainPendingIntent && (
            <div className="mt-6">
              <RecoveryBanner
                intent={chainPendingIntent}
                onRetry={chainAttemptRetry}
                onDismiss={chainClearIntent}
              />
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (chainCanSubmit) chainPlot(chainStorylineId, chainContent, chainTitle);
            }}
            className="mt-6 space-y-6"
          >
            <div>
              <label className="text-foreground mb-2 block text-sm">Storyline</label>
              {loadingStorylines ? (
                <p className="text-muted text-sm">Loading storylines...</p>
              ) : storylines.length === 0 ? (
                <p className="text-muted text-sm">
                  No active storylines.{" "}
                  <button
                    type="button"
                    onClick={() => setTab("new")}
                    className="text-accent hover:underline"
                  >
                    Create one
                  </button>
                </p>
              ) : (
                <Select
                  value={chainStorylineId != null ? String(chainStorylineId) : ""}
                  onChange={(v) => setChainStorylineId(v ? Number(v) : null)}
                  disabled={chainBusy}
                  placeholder="Select a storyline"
                  options={storylines.map((s) => ({
                    value: String(s.storyline_id),
                    label: `${s.title} (${s.plot_count} ${s.plot_count === 1 ? "plot" : "plots"})`,
                  }))}
                />
              )}
            </div>

            <div>
              <label className="text-foreground mb-2 block text-sm">Chapter Title</label>
              <input
                type="text"
                value={chainTitle}
                onChange={(e) => setChainTitle(e.target.value.slice(0, 100))}
                disabled={chainBusy || noStoryline}
                placeholder={noStoryline ? "Select a storyline first" : "e.g. The Silent Storm"}
                maxLength={100}
                className="border-border bg-surface text-foreground placeholder:text-muted w-full rounded border px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
              />
              <div className="mt-1 flex justify-between text-xs">
                {!chainTitleValid && chainContent.length > 0 ? (
                  <span className="text-error">Title is required</span>
                ) : (
                  <span />
                )}
                <span className="text-muted">{chainTitle.length} / 100 chars</span>
              </div>
            </div>

            <div>
              <label className="text-foreground mb-2 block text-sm">Next Chapter</label>
              <textarea
                value={chainContent}
                onChange={(e) => setChainContent(e.target.value)}
                disabled={chainBusy || noStoryline}
                rows={12}
                placeholder={noStoryline ? "Select a storyline above to chain a plot" : "Write the next plot (500\u201310,000 characters)"}
                className="border-border bg-surface text-foreground placeholder:text-muted w-full resize-y rounded border px-3 py-2 text-sm leading-relaxed focus:border-accent focus:outline-none disabled:opacity-50"
              />
              <div className="mt-1 text-xs">
                <span className={chainContent.length > 0 && !chainValid ? "text-error" : "text-muted"}>
                  {chainCharCount.toLocaleString()} / {MIN_CONTENT_LENGTH.toLocaleString()}&ndash;
                  {MAX_CONTENT_LENGTH.toLocaleString()} chars
                </span>
              </div>
            </div>

            {chainState === "error" && (
              <div className="border-error/30 text-error rounded border px-3 py-2 text-xs">
                {chainError}
              </div>
            )}
            {chainBusy && (
              <div className="border-border text-muted rounded border px-3 py-2 text-xs">
                {STATE_LABELS[chainState]}
              </div>
            )}

            <button
              type="submit"
              disabled={!chainCanSubmit || chainBusy}
              className="border-accent text-accent hover:bg-accent hover:text-background w-full rounded border py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {chainBusy ? STATE_LABELS[chainState] : "Chain Plot"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
