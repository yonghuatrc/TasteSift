"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./language-provider.tsx";
import { observeRecipeTranslation, translateSavedRecipe, TranslationClientError } from "../lib/recipes/translation-client.ts";
import type { TranslationSnapshot } from "../lib/recipes/translation-store.ts";

export function useRecipeTranslation(id: string | undefined, initial: TranslationSnapshot | undefined, canTranslate: boolean) {
  const { language } = useI18n();
  const [snapshot, setSnapshot] = useState(initial);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<TranslationClientError["key"] | null>(null);
  const active = useRef<AbortController | null>(null);
  async function generate(retry: boolean, signal: AbortSignal) {
    if (!id || !initial) return;
    setWorking(true); setError(null);
    try { const result = await translateSavedRecipe(id, initial.sourceHash, { retry, signal }); if (!signal.aborted) setSnapshot(result); }
    catch (error) { if (!signal.aborted) setError(error instanceof TranslationClientError ? error.key : "translationFailed"); }
    finally { if (!signal.aborted) setWorking(false); }
  }
  useEffect(() => {
    active.current?.abort(); active.current = new AbortController();
    setSnapshot(initial); setError(null); setWorking(false);
    return () => active.current?.abort();
  }, [id, initial?.sourceHash]);
  useEffect(() => {
    if (!id || !initial) return;
    if (initial.status === "ready") { setSnapshot(initial); setError(null); return; }
    const controller = new AbortController();
    void observeRecipeTranslation(id, (next) => {
      if (next.sourceHash !== initial.sourceHash) { setError("translationStale"); return; }
      setSnapshot(next); setError(null);
    }, controller.signal).catch(() => {});
    return () => controller.abort();
  }, [id, initial?.sourceHash, initial?.status]);
  const ready = snapshot?.status === "ready" && snapshot.sourceHash === initial?.sourceHash;
  return {
    content: ready ? snapshot.translations[language] : null,
    status: ready ? "translationReady" as const : working ? "translationWorking" as const : error ?? (snapshot?.status === "pending" ? "translationPending" as const : snapshot?.status === "failed" ? "translationFailed" as const : "translationMissing" as const),
    retry: () => { if (!working && canTranslate) { active.current ??= new AbortController(); void generate(true, active.current.signal); } },
  };
}

export function TranslationShelfStatus({ incomplete }: { incomplete: { id: string; status: TranslationSnapshot["status"]; sourceHash: string }[] }) {
  const { t } = useI18n(); const router = useRouter(); const key = JSON.stringify(incomplete);
  useEffect(() => {
    const controller = new AbortController();
    const states = JSON.parse(key) as typeof incomplete;
    for (const previous of states) void observeRecipeTranslation(previous.id, (next) => {
      if (next.status !== previous.status || next.sourceHash !== previous.sourceHash) router.refresh();
    }, controller.signal).catch(() => {});
    return () => controller.abort();
  }, [key, router]);
  return incomplete.length ? <div className="mt-6 rounded-2xl bg-[#edf4ee] p-4 text-sm leading-6 text-[#345344]" role="status">{incomplete.some((state) => state.status === "pending") ? t("translationWorking") : t("translationShelfIncomplete")}</div> : null;
}

export function RecipeTranslationNotice({ status, canTranslate, onRetry }: { status: ReturnType<typeof useRecipeTranslation>["status"]; canTranslate: boolean; onRetry: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  return <div className="mb-5 rounded-2xl border border-[#d6e3da] bg-[#edf4ee] p-4 text-sm leading-6 text-[#345344]" role="status">
    <p>{t(status)}</p>
    {status === "translationWorking" && <span className="mt-2 block h-1 w-1/3 animate-pulse rounded bg-[#5b8a6b]" aria-hidden="true" />}
    {status === "translationPending" ? <button className="mt-2 min-h-11 font-semibold underline" type="button" onClick={() => router.refresh()}>{t("refresh")}</button> : canTranslate && status !== "translationWorking" && status !== "translationReady" && <button className="mt-2 min-h-11 font-semibold underline" type="button" onClick={onRetry}>{t("retryTranslation")}</button>}
  </div>;
}
