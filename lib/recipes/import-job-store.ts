import { and, eq, gt, lte, or, sql } from "drizzle-orm";
import { videoImportJobs } from "../../db/schema.ts";
import { contentHash, parseTranslations } from "./content.ts";
import type { RecipeInput } from "./model.ts";
import type { getDb } from "../../db/index.ts";
import { requireEditor, requireMember, requireOwner, AccessNotAvailableError } from "../auth/permissions.ts";
import { parseRecipeInput } from "./model.ts";
import { normalizeSourceUrl } from "./source-url.ts";
import { videoPlatform } from "./video-platform.mjs";
import { ImportJobError, videoJobErrors, videoJobUpdateSchema, type VideoJob, type VideoJobClaim } from "./import-jobs.ts";
import type { RecipeActor } from "./service.ts";

type Database = ReturnType<typeof getDb>;
type Row = typeof videoImportJobs.$inferSelect;
async function database() { return (await import("../../db/index.ts")).getDb(); }
function snapshot(row: Row): VideoJob {
  const raw = row.status === "ready" ? JSON.parse(row.recipeJson!) : null;
  const recipe = raw ? parseRecipeInput(raw) : null;
  const translations = recipe && raw.translations ? parseTranslations(raw.translations, recipe) : undefined;
  return { id: row.id, url: row.sourceUrl, status: row.status, stage: row.stage, error: videoJobErrors.find((key) => key === row.error) ?? null, recipe, ...(translations ? { translations } : {}) };
}
function expired(now: Date) {
  return or(and(eq(videoImportJobs.status, "queued"), lte(videoImportJobs.expiresAt, now)), and(eq(videoImportJobs.status, "running"), lte(videoImportJobs.leaseUntil, now)));
}

export async function createVideoJob(id: string, sourceUrl: string, actor: RecipeActor, providedDb?: Database): Promise<VideoJob> {
  requireEditor(actor.role);
  const url = sourceUrl.trim();
  if (url.length > 2048 || !videoPlatform(url)) throw new ImportJobError("videoUnsupported");
  const db = providedDb ?? await database();
  const now = new Date();
  await db.insert(videoImportJobs).values({ id, createdBy: actor.userId, sourceUrl: url, status: "queued", stage: "connecting", createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 20 * 60_000) }).onConflictDoNothing();
  const row = await db.select().from(videoImportJobs).where(and(eq(videoImportJobs.id, id), eq(videoImportJobs.createdBy, actor.userId))).get();
  if (!row || normalizeSourceUrl(row.sourceUrl) !== normalizeSourceUrl(url)) throw new ImportJobError("queueFailed");
  return getVideoJob(id, actor, db);
}

export async function getVideoJob(id: string, actor: RecipeActor, providedDb?: Database): Promise<VideoJob> {
  requireMember(actor.role);
  const db = providedDb ?? await database();
  const scope = and(eq(videoImportJobs.id, id), eq(videoImportJobs.createdBy, actor.userId));
  const row = await db.select().from(videoImportJobs).where(scope).get();
  if (!row) throw new AccessNotAvailableError();
  const now = new Date();
  if (row.status === "queued" && row.expiresAt <= now || row.status === "running" && (!row.leaseUntil || row.leaseUntil <= now)) {
    await db.update(videoImportJobs).set({ status: "failed", error: row.status === "running" ? "workerDisconnected" : "queueExpired", leaseToken: null, leaseUntil: null, updatedAt: now }).where(and(scope, expired(now)));
    return snapshot((await db.select().from(videoImportJobs).where(scope).get())!);
  }
  return snapshot(row);
}

export async function claimVideoJob(actor: RecipeActor, providedDb?: Database): Promise<VideoJobClaim | null> {
  requireOwner(actor.role);
  const db = providedDb ?? await database();
  const now = new Date();
  await db.update(videoImportJobs).set({ status: "failed", error: sql`case when ${videoImportJobs.status} = 'running' then 'workerDisconnected' else 'queueExpired' end`, leaseToken: null, leaseUntil: null, updatedAt: now }).where(expired(now));
  const token = crypto.randomUUID();
  const row = await db.update(videoImportJobs).set({ status: "running", stage: "connecting", leaseToken: token, leaseUntil: new Date(now.getTime() + 120_000), updatedAt: now }).where(sql`${videoImportJobs.id} = (select id from video_import_jobs where status = 'queued' and expires_at > ${now.getTime()} order by created_at, id limit 1) and not exists (select 1 from video_import_jobs where status = 'running' and lease_until > ${now.getTime()}) and not exists (select 1 from recipe_translations where status = 'pending' and lease_token is not null and lease_until > ${now.getTime()})`).returning().get();
  return row ? { id: row.id, url: row.sourceUrl, token } : null;
}

export async function updateVideoJob(id: string, value: unknown, actor: RecipeActor, providedDb?: Database): Promise<void> {
  requireOwner(actor.role);
  const input = videoJobUpdateSchema.parse(value);
  const db = providedDb ?? await database();
  const now = new Date();
  const scope = and(eq(videoImportJobs.id, id), eq(videoImportJobs.status, "running"), eq(videoImportJobs.leaseToken, input.token), gt(videoImportJobs.leaseUntil, now));
  let values: Partial<typeof videoImportJobs.$inferInsert> = { updatedAt: now };
  if (input.action === "progress") values = { ...values, stage: input.stage, leaseUntil: new Date(now.getTime() + 120_000) };
  else if (input.action === "fail") values = { ...values, status: "failed", error: input.error, leaseToken: null, leaseUntil: null };
  else {
    const recipe = parseRecipeInput(input.recipe);
    const row = await db.select().from(videoImportJobs).where(scope).get();
    if (!row) throw new ImportJobError("workerDisconnected");
    if (!recipe.sourceUrl || normalizeSourceUrl(recipe.sourceUrl) !== normalizeSourceUrl(row.sourceUrl)) throw new ImportJobError("queueFailed");
    const translations = input.translations === undefined ? undefined : parseTranslations(input.translations, recipe);
    values = { ...values, status: "ready", stage: "ready", recipeJson: JSON.stringify({ ...recipe, ...(translations ? { translations } : {}) }), error: null, leaseToken: null, leaseUntil: null };
  }
  const changed = await db.update(videoImportJobs).set(values).where(scope).returning({ id: videoImportJobs.id }).get();
  if (!changed) throw new ImportJobError("workerDisconnected");
}

export async function preparedTranslationsForSave(id: string, recipe: RecipeInput, actor: RecipeActor, providedDb?: Database) {
  const job = await getVideoJob(id, actor, providedDb);
  // HTML form submission converts LF to CRLF without changing the recipe text.
  const formContent = (value: RecipeInput): RecipeInput => {
    const lines = (text: string) => text.replace(/\r\n?/g, "\n");
    return { ...value, title: lines(value.title), description: value.description == null ? null : lines(value.description), ingredients: value.ingredients.map(lines), steps: value.steps.map(lines), notes: value.notes == null ? null : lines(value.notes) };
  };
  if (job.status !== "ready" || !job.recipe || !job.translations || await contentHash(formContent(job.recipe)) !== await contentHash(formContent(recipe))) return undefined;
  return job.translations;
}
