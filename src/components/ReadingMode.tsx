"use client";

import { useEffect, useState, useCallback } from "react";
import { StoryContent } from "./StoryContent";

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
  onClose: () => void;
}

export function ReadingMode({
  storylineId,
  storylineTitle,
  chapters,
  initialChapterIndex,
  onClose,
}: ReadingModeProps) {
  const [currentIdx, setCurrentIdx] = useState(initialChapterIndex);
  const [showToc, setShowToc] = useState(false);

  const chapter = chapters[currentIdx];
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < chapters.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) {
      setCurrentIdx((i) => i - 1);
      window.scrollTo(0, 0);
    }
  }, [hasPrev]);

  const goNext = useCallback(() => {
    if (hasNext) {
      setCurrentIdx((i) => i + 1);
      window.scrollTo(0, 0);
    }
  }, [hasNext]);

  const goToChapter = useCallback((idx: number) => {
    setCurrentIdx(idx);
    setShowToc(false);
    window.scrollTo(0, 0);
  }, []);

  // Esc to close, arrow keys for navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showToc) setShowToc(false);
        else onClose();
      }
      if (e.key === "ArrowLeft" && hasPrev) goPrev();
      if (e.key === "ArrowRight" && hasNext) goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, hasPrev, hasNext, goPrev, goNext, showToc]);

  // Lock body scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--paper-bg, #F5F0E8)" }}>
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
            onClick={onClose}
            className="text-muted hover:text-foreground text-lg transition-colors"
            title="Exit reading mode (Esc)"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-6 py-8 sm:px-8 sm:py-12">
          {chapter?.content ? (
            <StoryContent content={chapter.content} />
          ) : (
            <p className="text-muted text-sm italic">Content unavailable</p>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <nav
        className="flex items-center justify-between px-4 py-3 sm:px-6"
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
            style={{ background: "var(--paper-bg, #F5F0E8)" }}
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
      className="border-border text-muted hover:text-accent hover:border-accent rounded border px-3 py-1.5 text-[11px] font-medium transition-colors"
    >
      Reading Mode
    </button>
  );
}
