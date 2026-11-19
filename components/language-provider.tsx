"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { translate, type Language, type TranslationKey } from "../lib/i18n.ts";

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
} | null>(null);

export function LanguageProvider({ initialLanguage, children }: { initialLanguage: Language; children: React.ReactNode }) {
  const [language, setLanguageState] = useState(initialLanguage);
  const router = useRouter();
  useEffect(() => { document.documentElement.lang = language === "zh" ? "zh-Hans" : "en"; }, [language]);
  function setLanguage(next: Language) {
    setLanguageState(next);
    document.cookie = `tastesift-language=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.refresh();
  }
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is required");
  return { ...context, t: (key: TranslationKey, values?: Record<string, string | number>) => translate(context.language, key, values) };
}
