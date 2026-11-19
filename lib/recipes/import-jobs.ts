import { z } from "zod";
import { importStages, type ImportStage } from "./import-progress.ts";
import type { RecipeInput } from "./model.ts";
import type { BilingualContent } from "./content.ts";

export const videoJobErrors = ["connectionError", "timeoutError", "interruptedError", "processingError", "helperUpdate", "videoUnavailable", "videoUnsupported", "videoTooLong", "noRecipeEvidence", "queueFailed", "queueExpired", "workerDisconnected", "translationFailed", "translationOffline"] as const;
export type VideoJobError = typeof videoJobErrors[number];
export type VideoJob = { id: string; url: string; status: "queued" | "running" | "ready" | "failed"; stage: ImportStage; error: VideoJobError | null; recipe: RecipeInput | null; translations?: BilingualContent };
export type VideoJobClaim = { id: string; url: string; token: string };
export const videoJobUpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("progress"), token: z.string().uuid(), stage: z.enum(importStages).refine((stage) => stage !== "ready") }),
  z.object({ action: z.literal("complete"), token: z.string().uuid(), recipe: z.unknown(), translations: z.unknown().optional() }),
  z.object({ action: z.literal("fail"), token: z.string().uuid(), error: z.enum(videoJobErrors) }),
]);
export class ImportJobError extends Error {
  readonly key: VideoJobError;
  constructor(key: VideoJobError) { super(key); this.key = key; }
}
