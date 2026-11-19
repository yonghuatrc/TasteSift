"use client";
import Link from "next/link";
import { useI18n } from "./language-provider.tsx";

export function SiteHeader() {
  const { language, setLanguage, t } = useI18n();
  return <header className="sticky top-0 z-40 border-b border-[#dce5df]/90 bg-[#f7f5ef]/90 backdrop-blur-xl">
    <div className="mx-auto flex min-h-18 max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-8">
      <Link className="flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-3 focus-visible:outline-[#e56b55]" href="/">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#24533d] text-lg text-white">✦</span>
        <span><span className="block font-serif text-xl font-semibold leading-none text-[#173d2d]">TasteSift</span><span className="hidden text-[10px] font-semibold tracking-[0.12em] text-[#7c877f] sm:block">{t("tagline")}</span></span>
      </Link>
      <nav className="flex items-center gap-2" aria-label={t("myRecipes")}>
        <Link className="nav-link" href="/">{t("myRecipes")}</Link>
        <button className="min-h-11 rounded-full border border-[#d6e3da] px-3 text-sm font-semibold text-[#24533d]" onClick={() => setLanguage(language === "zh" ? "en" : "zh")} type="button" aria-label={language === "zh" ? "Switch to English" : "切换为中文"}>{language === "zh" ? "English" : "中文"}</button>
      </nav>
    </div>
  </header>;
}
