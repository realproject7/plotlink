"use client";

import { useState, useEffect, useCallback } from "react";

const NSFW_KEY = "plotlink_nsfw";
const NSFW_EVENT = "plotlink:nsfw-change";

export function useNsfwPreference() {
  const [showNsfw, setShowNsfw] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(NSFW_KEY) === "1";
  });

  useEffect(() => {
    const handler = () => {
      setShowNsfw(localStorage.getItem(NSFW_KEY) === "1");
    };
    window.addEventListener(NSFW_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(NSFW_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setNsfw = useCallback((value: boolean) => {
    localStorage.setItem(NSFW_KEY, value ? "1" : "0");
    window.dispatchEvent(new Event(NSFW_EVENT));
  }, []);

  return [showNsfw, setNsfw] as const;
}
