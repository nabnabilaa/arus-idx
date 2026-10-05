"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_HORIZON, PUBLISHED } from "./published";
import type { Horizon } from "./types";

type Ctx = {
  horizon: Horizon;
  setHorizon: (h: Horizon) => void;
  watchlist: string[];
  toggleWatch: (s: string) => void;
  isWatched: (s: string) => boolean;
};

const PrefsContext = createContext<Ctx>({
  horizon: DEFAULT_HORIZON,
  setHorizon: () => {},
  watchlist: [],
  toggleWatch: () => {},
  isWatched: () => false,
});

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [horizon, setH] = useState<Horizon>(DEFAULT_HORIZON);
  const [watchlist, setW] = useState<string[]>([]);

  useEffect(() => {
    const h = read<number>("arus.horizon", DEFAULT_HORIZON);
    // saved preferences live in localStorage, readable only after mount on a static site
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setH(PUBLISHED.includes(h as Horizon) ? (h as Horizon) : DEFAULT_HORIZON);
    setW(read<string[]>("arus.watchlist", []));
  }, []);

  const setHorizon = useCallback((h: Horizon) => {
    setH(h);
    write("arus.horizon", h);
  }, []);

  const toggleWatch = useCallback((s: string) => {
    setW((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
      write("arus.watchlist", next);
      return next;
    });
  }, []);

  const isWatched = useCallback((s: string) => watchlist.includes(s), [watchlist]);

  return <PrefsContext.Provider value={{ horizon, setHorizon, watchlist, toggleWatch, isWatched }}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  return useContext(PrefsContext);
}
