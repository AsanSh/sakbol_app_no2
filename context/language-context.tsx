"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Lang } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void } | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ru");
  useEffect(() => {
    const raw = localStorage.getItem("sakbol-lang");
    if (raw === "ru" || raw === "kg") setLang(raw);
  }, []);
  useEffect(() => {
    localStorage.setItem("sakbol-lang", lang);
  }, [lang]);
  const v = useMemo(() => ({ lang, setLang }), [lang]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useLanguage() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLanguage inside LanguageProvider");
  return c;
}
