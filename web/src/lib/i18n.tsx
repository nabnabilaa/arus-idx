"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "id" | "en";
export type Bi = { id: string; en: string };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; tx: (b: Bi) => string };

const LangContext = createContext<Ctx>({ lang: "id", setLang: () => {}, tx: (b) => b.id });

const KEY = "arus.lang";

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "en" || saved === "id") setLangState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }, []);

  const tx = useCallback((b: Bi) => b[lang], [lang]);

  return <LangContext.Provider value={{ lang, setLang, tx }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** Inline bilingual text: <T id="..." en="..." /> */
export function T({ id, en }: Bi) {
  const { lang } = useLang();
  return <>{lang === "id" ? id : en}</>;
}
