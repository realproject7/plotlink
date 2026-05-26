"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback, useRef } from "react";

export function CoverLightbox({ src, alt }: { src: string; alt: string }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const open = useCallback(() => {
    setClosing(false);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setClosing(true);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, 150);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    if (!visible || closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, closing, close]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="absolute inset-0 cursor-pointer"
        aria-label="View full cover image"
      >
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      </button>

      {visible && (
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm ${closing ? "animate-[fadeOut_150ms_ease-in_forwards]" : "animate-[fadeIn_150ms_ease-out]"}`}
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close lightbox"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className={`max-h-[90vh] max-w-[90vw] rounded-md object-contain ${closing ? "animate-[scaleOut_150ms_ease-in_forwards]" : "animate-[scaleIn_150ms_ease-out]"}`}
          />
        </div>
      )}
    </>
  );
}
