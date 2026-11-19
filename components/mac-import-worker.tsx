"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./language-provider.tsx";
import { ImportProgress } from "./import-progress.tsx";
import { checkMacHelper, importVideoOnMac, LocalImportError } from "../lib/recipes/import-local.ts";
import { ImportJobError } from "../lib/recipes/import-jobs.ts";
import type { MacTask } from "../lib/mac-tasks.ts";
import { translateRecipeOnMac } from "../lib/recipes/translation-local.ts";
import { checkTranslationResponse, TranslationClientError } from "../lib/recipes/translation-client.ts";
import type { RecipeInput } from "../lib/recipes/model.ts";
import type { BilingualContent } from "../lib/recipes/content.ts";
import { readVideoImportResponse, waitForNextPoll } from "../lib/recipes/import-remote.ts";
import type { ImportStage } from "../lib/recipes/import-progress.ts";
import type { Category } from "../lib/recipes/categories.ts";
import type { TranslationKey } from "../lib/i18n.ts";
import { videoPlatform } from "../lib/recipes/video-platform.mjs";

export function MacImportWorker() {
  const { t } = useI18n();
  const active = useRef<AbortController | null>(null);
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [current, setCurrent] = useState("");
  const [translating, setTranslating] = useState(false);
  const [stage, setStage] = useState<ImportStage>("connecting");
  const [completed, setCompleted] = useState(0);
  const [error, setError] = useState<TranslationKey | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function run() {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setRunning(true); setConnected(false); setError(null);
    try {
      await checkMacHelper(fetch, controller.signal); setConnected(true);
      while (!controller.signal.aborted) {
        const response = await readVideoImportResponse(await fetch("/api/mac-tasks/claim", { method: "POST", signal: controller.signal }));
        const { job } = await response.json() as { job: MacTask | null };
        if (!job) { await waitForNextPoll(controller.signal); continue; }
        setCurrent(job.kind === "video" ? videoPlatform(job.url) || "" : job.content.title); setStage("connecting"); setTranslating(job.kind === "translation");
        const jobController = new AbortController();
        const signal = AbortSignal.any([controller.signal, jobController.signal]);
        const patch = async (body: { action: "progress" | "complete" | "fail"; stage?: ImportStage; recipe?: RecipeInput; translations?: BilingualContent; error?: string }, keepalive = false) => {
          const endpoint = job.kind === "video" ? `/api/video-imports/${job.id}` : `/api/recipes/${job.id}/translations`;
          const payload = job.kind === "video" ? { ...body, token: job.token } : { token: job.token, sourceHash: job.sourceHash, ...(body.action === "complete" ? { translations: body.translations } : { progress: body.action === "progress" }) };
          const result = await fetch(endpoint, { method: job.kind === "translation" && body.action === "complete" ? "PUT" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), keepalive, signal: keepalive ? AbortSignal.timeout(10_000) : controller.signal });
          if (job.kind === "video") await readVideoImportResponse(result); else await checkTranslationResponse(result);
        };
        let latestStage: ImportStage = "connecting";
        let writes = Promise.resolve();
        let progressError: unknown;
        const report = (next: ImportStage) => {
          if (next === "ready") return;
          latestStage = next; setStage(next);
          writes = writes.then(() => patch({ action: "progress", stage: next })).catch((problem) => { progressError = problem; jobController.abort(); });
        };
        const heartbeat = setInterval(() => report(latestStage), 20_000);
        try {
          let recipe: RecipeInput | undefined; let translations: BilingualContent | undefined;
          if (job.kind === "video") {
            const catalogResponse = await readVideoImportResponse(await fetch("/api/categories", { signal }));
            const catalog = await catalogResponse.json() as { categories: Category[] };
            recipe = await importVideoOnMac(job.url, report, fetch, catalog.categories, signal);
            report("organizing"); setTranslating(true);
            translations = await translateRecipeOnMac(recipe, signal);
          } else {
            report("organizing");
            translations = await translateRecipeOnMac(job.content, signal);
          }
          clearInterval(heartbeat); await writes;
          if (progressError) throw progressError;
          await patch({ action: "complete", recipe, translations });
          setCompleted((count) => count + 1); setError(null);
        } catch (problem) {
          clearInterval(heartbeat); await writes;
          const key = controller.signal.aborted ? "workerDisconnected" : problem instanceof ImportJobError || problem instanceof LocalImportError || problem instanceof TranslationClientError ? problem.key : "processingError";
          await patch({ action: "fail", error: key }, true).catch(() => {});
          if (!controller.signal.aborted) setError(key);
          if (progressError && !(progressError instanceof TranslationClientError && progressError.key === "translationStale") || key === "connectionError" || key === "helperUpdate" || key === "translationOffline") throw problem;
        } finally { clearInterval(heartbeat); setCurrent(""); setTranslating(false); }
      }
    } catch (problem) {
      if (!controller.signal.aborted) setError(problem instanceof ImportJobError || problem instanceof LocalImportError || problem instanceof TranslationClientError ? problem.key : "queueFailed");
    } finally { active.current = null; setRunning(false); setConnected(false); setCurrent(""); }
  }

  return <section className="content-panel mt-6 space-y-4">
    <p className="font-semibold text-[#24533d]" role="status">{t(running ? connected ? "workerEnabled" : "connecting" : "workerStopped")}</p>
    <p className="text-sm leading-6 text-[#68756d]">{t("workerKeepOpen")}</p>
    <div className="flex flex-wrap gap-3"><button type="button" className="button-primary" disabled={running} onClick={() => void run()}>{t("startWorker")}</button><button type="button" className="button-secondary" disabled={!running} onClick={() => active.current?.abort()}>{t("stopWorker")}</button></div>
    {running && (!connected || current) && <><p className="text-sm">{current}</p>{translating ? <p role="status" className="text-sm">{t("translationWorking")}</p> : <ImportProgress stage={stage} />}</>}
    {running && connected && !current && <p className="text-sm text-[#68756d]">{t("workerWaiting")}</p>}
    <p className="text-sm">{t("workerCompleted", { count: completed })}</p>
    {error && <p className="field-error" role="alert">{t(error)}</p>}
  </section>;
}
