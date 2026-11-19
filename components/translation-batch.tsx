"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./language-provider.tsx";
import { translateSavedRecipe } from "../lib/recipes/translation-client.ts";

export function TranslationBatch({ recipes }: { recipes: { id: string; title: string; sourceHash: string }[] }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [current, setCurrent] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function run() {
    if (busy) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setDone(0); setFailed(0);
    for (const recipe of recipes) {
      if (controller.signal.aborted) break;
      setCurrent(recipe.title);
      try { await translateSavedRecipe(recipe.id, recipe.sourceHash, { retry: true, signal: controller.signal }); }
      catch { if (!controller.signal.aborted) setFailed((count) => count + 1); }
      if (!controller.signal.aborted) setDone((count) => count + 1);
    }
    if (!controller.signal.aborted) { setBusy(false); setCurrent(""); }
  }
  return <section className="content-panel mt-8 space-y-4">
    <h2 className="section-title">{t("backfillTranslations")}</h2>
    <p className="text-sm leading-6 text-[#68756d]">{t("batchTranslationHelp")}</p>
    <button className="button-primary" type="button" disabled={busy || !recipes.length} onClick={run}>{t(busy ? "translationWorking" : "backfillTranslations")}</button>
    <p role="status" className="text-sm leading-6 text-[#345344]">{t("batchTranslationProgress", { done, total: recipes.length, failed })}{current && ` · ${current}`}</p>
  </section>;
}
