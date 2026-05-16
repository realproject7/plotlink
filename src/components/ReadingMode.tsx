"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { StoryContent } from "./StoryContent";
import { usePlatformDetection } from "../hooks/usePlatformDetection";

interface Chapter {
  plotIndex: number;
  title: string;
  content: string | null;
}

interface ReadingModeProps {
  storylineId: number;
  storylineTitle: string;
  chapters: Chapter[];
  initialChapterIndex: number;
  contentType?: string;
  onClose: () => void;
}

type FontSize = "small" | "medium" | "large";
type LineHeight = "compact" | "normal" | "relaxed";

const FONT_SIZE_CONFIG: Record<FontSize, { mobile: string; desktop: string; label: string }> = {
  small:  { mobile: "16px", desktop: "17px", label: "A–" },
  medium: { mobile: "18px", desktop: "20px", label: "A" },
  large:  { mobile: "21px", desktop: "24px", label: "A+" },
};

const LINE_HEIGHT_CONFIG: Record<LineHeight, { value: string; label: string }> = {
  compact: { value: "1.55", label: "Compact" },
  normal:  { value: "1.75", label: "Normal" },
  relaxed: { value: "2.0",  label: "Relaxed" },
};

const FONT_SIZES: FontSize[] = ["small", "medium", "large"];
const LINE_HEIGHTS: LineHeight[] = ["compact", "normal", "relaxed"];

function usePersistedState<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return fallback;
    return (localStorage.getItem(key) as T) || fallback;
  });
  const set = useCallback((v: T) => {
    setValue(v);
    localStorage.setItem(key, v);
  }, [key]);
  return [value, set];
}

export function ReadingMode({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  storylineId,
  storylineTitle,
  chapters,
  initialChapterIndex,
  contentType,
  onClose,
}: ReadingModeProps) {
  const [currentIdx, setCurrentIdx] = useState(initialChapterIndex);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [flipDir, setFlipDir] = useState<"left" | "right" | null>(null);
  const [outgoingIdx, setOutgoingIdx] = useState<number | null>(null);
  const [outgoingScroll, setOutgoingScroll] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const flipping = useRef(false);
  const { isMiniApp } = usePlatformDetection();

  const [fontSize, setFontSize] = usePersistedState<FontSize>("plotlink-reading-font-size", "medium");
  const [lineHeight, setLineHeight] = usePersistedState<LineHeight>("plotlink-reading-line-height", "normal");

  const chapter = chapters[currentIdx];
  const outgoingChapter = outgoingIdx !== null ? chapters[outgoingIdx] : null;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < chapters.length - 1;

  const scrollToTop = useCallback(() => {
    contentRef.current?.scrollTo(0, 0);
  }, []);

  const navigate = useCallback((idx: number, dir: "left" | "right" | null) => {
    if (flipping.current) return;
    flipping.current = true;
    const scrollOffset = contentRef.current?.scrollTop ?? 0;
    setOutgoingScroll(scrollOffset);
    if (stackRef.current) {
      stackRef.current.style.minHeight = `${stackRef.current.offsetHeight}px`;
    }
    setOutgoingIdx(currentIdx);
    setFlipDir(dir);
    setCurrentIdx(idx);
    scrollToTop();
    setTimeout(() => {
      if (stackRef.current) {
        stackRef.current.style.minHeight = "";
      }
      setOutgoingIdx(null);
      setFlipDir(null);
      flipping.current = false;
    }, 500);
  }, [currentIdx, scrollToTop]);

  const goPrev = useCallback(() => {
    if (hasPrev) navigate(currentIdx - 1, "right");
  }, [hasPrev, currentIdx, navigate]);

  const goNext = useCallback(() => {
    if (hasNext) navigate(currentIdx + 1, "left");
  }, [hasNext, currentIdx, navigate]);

  const goToChapter = useCallback((idx: number) => {
    setShowToc(false);
    navigate(idx, idx > currentIdx ? "left" : "right");
  }, [currentIdx, navigate]);

  // Esc to close, arrow keys for navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSettings) setShowSettings(false);
        else if (showToc) setShowToc(false);
        else onClose();
      }
      if (e.key === "ArrowLeft" && hasPrev) goPrev();
      if (e.key === "ArrowRight" && hasNext) goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, hasPrev, hasNext, goPrev, goNext, showToc, showSettings]);

  // Lock body scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const fsConfig = FONT_SIZE_CONFIG[fontSize];
  const lhConfig = LINE_HEIGHT_CONFIG[lineHeight];

  const readingStyle: React.CSSProperties = {
    fontFamily: "var(--font-prose, var(--font-display, Georgia, serif))",
    lineHeight: lhConfig.value,
  };

  const readingCss = `
    .reading-prose { font-size: ${fsConfig.mobile}; }
    .reading-prose .story-markdown { line-height: inherit; }
    @media (min-width: 640px) { .reading-prose { font-size: ${fsConfig.desktop}; } }
  `;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="min-w-0 flex-1">
          <p className="text-muted truncate text-xs">{storylineTitle}</p>
          <p className="text-foreground truncate text-sm font-medium">
            {chapter?.title || `Chapter ${chapter?.plotIndex ?? 0}`}
          </p>
        </div>
        <div className="ml-4 flex items-center gap-3">
          <span className="text-muted text-[11px]">
            {currentIdx + 1} / {chapters.length}
          </span>
          <button
            onClick={() => { setShowSettings(!showSettings); setShowToc(false); }}
            className={`text-lg transition-colors ${showSettings ? "text-accent" : "text-muted hover:text-foreground"}`}
            title="Reading settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground text-lg transition-colors"
            title="Exit reading mode (Esc)"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          className="flex flex-wrap items-center gap-4 px-4 py-2.5 sm:px-6"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {/* Font size */}
          <div className="flex items-center gap-2">
            <span className="text-muted text-[11px]">Size</span>
            <div className="flex rounded border border-[var(--border)]">
              {FONT_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    fontSize === s
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:text-foreground"
                  } ${s !== "small" ? "border-l border-[var(--border)]" : ""}`}
                >
                  {FONT_SIZE_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Line height */}
          <div className="flex items-center gap-2">
            <span className="text-muted text-[11px]">Spacing</span>
            <div className="flex rounded border border-[var(--border)]">
              {LINE_HEIGHTS.map((h) => (
                <button
                  key={h}
                  onClick={() => setLineHeight(h)}
                  className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    lineHeight === h
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:text-foreground"
                  } ${h !== "compact" ? "border-l border-[var(--border)]" : ""}`}
                >
                  {LINE_HEIGHT_CONFIG[h].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content area */}
      <div
        ref={contentRef}
        className="page-flip-container flex-1 overflow-y-auto overflow-x-hidden"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          const dy = e.changedTouches[0].clientY - touchStartY.current;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0) goNext();
            else goPrev();
          }
        }}
      >
        <div ref={stackRef} className="page-flip-stack">
          {/* Incoming page (underneath) */}
          <div className={`page-flip-page ${outgoingIdx !== null ? "page-incoming" : ""}`}>
            <div className="mx-auto max-w-[720px] px-6 py-8 sm:px-8 sm:py-12">
              <style>{readingCss}</style>
              <div style={readingStyle} className="reading-prose">
                {chapter?.content ? (
                  <StoryContent content={chapter.content} contentType={contentType} />
                ) : (
                  <p className="text-muted text-sm italic">Content unavailable</p>
                )}
              </div>
            </div>
          </div>

          {/* Outgoing page (on top, flipping away at its old scroll offset) */}
          {outgoingChapter && flipDir && (
            <div
              className={`page-flip-page page-outgoing ${
                flipDir === "left" ? "page-flip-out-left" : "page-flip-out-right"
              }`}
              style={{
                background: "var(--bg)",
                top: `-${outgoingScroll}px`,
              }}
            >
              <div className="mx-auto max-w-[720px] px-6 py-8 sm:px-8 sm:py-12">
                <div style={readingStyle} className="reading-prose">
                  {outgoingChapter.content ? (
                    <StoryContent content={outgoingChapter.content} contentType={contentType} />
                  ) : (
                    <p className="text-muted text-sm italic">Content unavailable</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <nav
        className={`flex items-center justify-between px-4 pt-3 ${isMiniApp ? "pb-8" : "pb-[calc(0.75rem+env(safe-area-inset-bottom))]"} sm:px-6`}
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {hasPrev ? (
          <button
            onClick={goPrev}
            className="text-muted hover:text-accent rounded px-3 py-2 text-xs font-medium transition-colors"
          >
            &larr; Prev
          </button>
        ) : (
          <span className="w-16" />
        )}

        <button
          onClick={() => setShowToc(!showToc)}
          className="text-muted hover:text-accent rounded px-3 py-2 text-xs font-medium transition-colors"
        >
          Contents
        </button>

        {hasNext ? (
          <button
            onClick={goNext}
            className="text-muted hover:text-accent rounded px-3 py-2 text-xs font-medium transition-colors"
          >
            Next &rarr;
          </button>
        ) : (
          <span className="w-16" />
        )}
      </nav>

      {/* Table of Contents overlay */}
      {showToc && (
        <div
          className="fixed inset-0 z-60 flex items-end justify-center sm:items-center"
          onClick={() => setShowToc(false)}
        >
          <div
            className="border-border w-full max-w-md rounded-t-lg border sm:rounded-lg"
            style={{ background: "var(--bg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-foreground text-sm font-medium">Table of Contents</h3>
              <button
                onClick={() => setShowToc(false)}
                className="text-muted hover:text-foreground transition-colors"
              >
                &times;
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {chapters.map((ch, idx) => (
                <button
                  key={ch.plotIndex}
                  onClick={() => goToChapter(idx)}
                  className={`w-full rounded px-3 py-2 text-left text-xs transition-colors ${
                    idx === currentIdx
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-foreground hover:bg-accent/5"
                  }`}
                >
                  <span className="text-muted mr-2">
                    {ch.plotIndex === 0 ? "G" : ch.plotIndex}.
                  </span>
                  {ch.title || (ch.plotIndex === 0 ? "Genesis" : `Chapter ${ch.plotIndex}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Button to enter reading mode. Place near story content.
 */
export function ReadingModeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="border-border text-muted hover:text-accent hover:border-accent flex items-center gap-1.5 rounded border px-3 py-1.5 text-[11px] font-medium transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
      Reading Mode
    </button>
  );
}
