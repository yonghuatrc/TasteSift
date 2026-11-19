"use client";

import { useI18n } from "./language-provider.tsx";
import type { ImportStage } from "../lib/recipes/import-progress.ts";

export function ImportProgress({ stage, remote = false, waitingMac = false }: { stage: ImportStage; remote?: boolean; waitingMac?: boolean }) {
  const { t } = useI18n();
  const label = t(waitingMac ? "waitingMac" : stage);
  return <div className="mt-5 rounded-2xl border border-[#cbded1] bg-white/75 p-5" role="status" aria-live="polite">
    <div className="flex items-center gap-3"><span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#c5d7cb] border-t-[#24533d] motion-reduce:animate-none" aria-hidden="true" /><span className="font-semibold text-[#24533d]">{label}</span></div>
    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e0ebe3]" role="progressbar" aria-label={label} aria-valuetext={label}><span className="block h-full w-1/3 animate-pulse rounded-full bg-[#5b8a6b] motion-reduce:animate-none" /></div>
    <p className="mt-3 text-sm leading-6 text-[#68756d]">{t(remote ? waitingMac ? "waitingMacHelp" : "remoteProcessingHelp" : stage === "connecting" ? "permissionHelp" : "processingHelp")}</p>
  </div>;
}
