import { and, asc, eq, gt, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import type { getDb } from "../../db/index.ts";
import { recipeTranslations, recipes as recipeTable } from "../../db/schema.ts";
import { requireEditor, requireOwner } from "../auth/permissions.ts";
import type { RecipeActor } from "./service.ts";
import type { RecipeInput, RecipeRecord } from "./model.ts";
import { contentHash, recipeContent, parseTranslations, type BilingualContent } from "./content.ts";

type Database = ReturnType<typeof getDb>;
type SourceRecipe = RecipeInput & { id: string };
export type TranslationSnapshot = { status: "ready"; sourceHash: string; translations: BilingualContent } | { status: "missing" | "pending" | "failed"; sourceHash: string };
export type TranslationClaim = TranslationSnapshot | { status: "claimed"; sourceHash: string; token: string; content: ReturnType<typeof recipeContent> };
export type QueuedTranslationClaim = { recipeId: string; sourceHash: string; token: string; content: ReturnType<typeof recipeContent> };
async function database() { return (await import("../../db/index.ts")).getDb(); }

// Compare source text inside the same write statement. JSON items are compared
// by index/value so legacy whitespace or escaped Unicode does not change meaning.
function currentContentMatches(recipe: SourceRecipe) {
  return sql`exists (select 1 from ${recipeTable} where ${recipeTable.id} = ${recipe.id}
    and ${recipeTable.title} = ${recipe.title}
    and ${recipeTable.description} is ${recipe.description ?? null}
    and ${recipeTable.notes} is ${recipe.notes ?? null}
    and json_array_length(${recipeTable.ingredientsJson}) = ${recipe.ingredients.length}
    and not exists (select key, value from json_each(${recipeTable.ingredientsJson}) except select key, value from json_each(${JSON.stringify(recipe.ingredients)}))
    and json_array_length(${recipeTable.stepsJson}) = ${recipe.steps.length}
    and not exists (select key, value from json_each(${recipeTable.stepsJson}) except select key, value from json_each(${JSON.stringify(recipe.steps)})))`;
}

export async function translationSnapshot(recipe: SourceRecipe, providedDb?: Database): Promise<TranslationSnapshot> {
  const db = providedDb ?? await database();
  const sourceHash = await contentHash(recipe);
  const row = await db.select().from(recipeTranslations).where(eq(recipeTranslations.recipeId, recipe.id)).get();
  return snapshotFromRow(recipe, row, sourceHash);
}

function snapshotFromRow(recipe: SourceRecipe, row: typeof recipeTranslations.$inferSelect | undefined, sourceHash: string): TranslationSnapshot {
  if (!row || row.sourceHash !== sourceHash) return { status: "missing", sourceHash };
  if (row.status === "pending" && (row.leaseToken ? !row.leaseUntil || row.leaseUntil.getTime() <= Date.now() : row.updatedAt.getTime() <= Date.now() - 20 * 60_000)) return { status: "failed", sourceHash };
  if (row.status === "ready") {
    try { return { status: "ready", sourceHash, translations: parseTranslations({ zh: JSON.parse(row.zhJson!), en: JSON.parse(row.enJson!) }, recipe) }; }
    catch { return { status: "failed", sourceHash }; }
  }
  return { status: row.status, sourceHash };
}

export async function translationValues(recipe: SourceRecipe, prepared?: BilingualContent) {
  const translations = prepared ? parseTranslations(prepared, recipe) : undefined;
  return { recipeId: recipe.id, sourceHash: await contentHash(recipe), status: translations ? "ready" as const : "pending" as const, zhJson: translations ? JSON.stringify(translations.zh) : null, enJson: translations ? JSON.stringify(translations.en) : null, leaseToken: null, leaseUntil: null, updatedAt: new Date() };
}

export function queuedTranslationUpdate(values: Awaited<ReturnType<typeof translationValues>>) {
  const active = sql`${recipeTranslations.status} = 'pending' and ${recipeTranslations.leaseToken} is not null and ${recipeTranslations.leaseUntil} > ${Date.now()}`;
  return { ...values, leaseToken: sql<string | null>`case when ${active} then ${recipeTranslations.leaseToken} else null end`, leaseUntil: sql<Date | null>`case when ${active} then ${recipeTranslations.leaseUntil} else null end` };
}

export async function enqueueTranslation(recipe: SourceRecipe, actor: RecipeActor, retry = false, providedDb?: Database): Promise<TranslationSnapshot> {
  requireEditor(actor.role);
  const db = providedDb ?? await database();
  const values = await translationValues(recipe);
  const now = new Date();
  await db.insert(recipeTranslations).select(sql`select ${values.recipeId}, ${values.sourceHash}, 'pending', null, null, null, null, ${values.updatedAt.getTime()} where ${currentContentMatches(recipe)}`).onConflictDoUpdate({ target: recipeTranslations.recipeId, set: queuedTranslationUpdate(values), setWhere: or(ne(recipeTranslations.sourceHash, values.sourceHash), retry ? or(eq(recipeTranslations.status, "failed"), and(eq(recipeTranslations.status, "pending"), or(lte(recipeTranslations.leaseUntil, now), and(isNull(recipeTranslations.leaseToken), lte(recipeTranslations.updatedAt, new Date(now.getTime() - 20 * 60_000)))))) : undefined) });
  return translationSnapshot(recipe, db);
}

export async function claimTranslation(recipe: SourceRecipe, actor: RecipeActor, retry = false, providedDb?: Database): Promise<TranslationClaim> {
  requireEditor(actor.role);
  const db = providedDb ?? await database();
  const sourceHash = await contentHash(recipe);
  const token = crypto.randomUUID();
  const now = new Date();
  const pending = { sourceHash, status: "pending" as const, zhJson: null, enJson: null, leaseToken: token, leaseUntil: new Date(now.getTime() + 120_000), updatedAt: now };
  const available = sql`not exists (select 1 from video_import_jobs where status = 'running' and lease_until > ${now.getTime()}) and not exists (select 1 from recipe_translations where status = 'pending' and lease_token is not null and lease_until > ${now.getTime()} and (recipe_id != ${recipe.id} or source_hash = ${sourceHash}))`;
  const row = await db.insert(recipeTranslations).select(sql`select ${recipe.id}, ${sourceHash}, 'pending', null, null, ${token}, ${pending.leaseUntil.getTime()}, ${now.getTime()} where ${currentContentMatches(recipe)} and ${available}`).onConflictDoUpdate({
    target: recipeTranslations.recipeId, set: pending,
    setWhere: or(ne(recipeTranslations.sourceHash, sourceHash), and(eq(recipeTranslations.status, "pending"), or(isNull(recipeTranslations.leaseToken), lt(recipeTranslations.leaseUntil, now))), retry ? eq(recipeTranslations.status, "failed") : undefined),
  }).returning().get();
  if (row) return { status: "claimed", sourceHash, token, content: recipeContent(recipe) };
  const current = await db.get<{ matches: number }>(sql`select ${currentContentMatches(recipe)} as matches`);
  if (!current?.matches) throw new Error("Recipe content changed; stale claim rejected");
  return translationSnapshot(recipe, db);
}

export async function claimNextTranslation(actor: RecipeActor, providedDb?: Database): Promise<QueuedTranslationClaim | null> {
  requireOwner(actor.role);
  const db = providedDb ?? await database();
  const row = await db.select({ id: recipeTable.id, title: recipeTable.title, description: recipeTable.description, ingredientsJson: recipeTable.ingredientsJson, stepsJson: recipeTable.stepsJson, notes: recipeTable.notes }).from(recipeTranslations).innerJoin(recipeTable, eq(recipeTranslations.recipeId, recipeTable.id)).where(and(eq(recipeTranslations.status, "pending"), isNull(recipeTranslations.leaseToken), gt(recipeTranslations.updatedAt, new Date(Date.now() - 20 * 60_000)))).orderBy(asc(recipeTranslations.updatedAt)).limit(1).get();
  if (!row) return null;
  const recipe = { id: row.id, title: row.title, description: row.description, ingredients: JSON.parse(row.ingredientsJson) as string[], steps: JSON.parse(row.stepsJson) as string[], notes: row.notes };
  try {
    const claim = await claimTranslation(recipe, actor, false, db);
    return claim.status === "claimed" ? { recipeId: recipe.id, sourceHash: claim.sourceHash, token: claim.token, content: claim.content } : null;
  } catch (error) { if (error instanceof Error && /changed|stale/i.test(error.message)) return null; throw error; }
}

export async function renewTranslation(recipe: SourceRecipe, actor: RecipeActor, value: { sourceHash: string; token: string }, providedDb?: Database) {
  requireOwner(actor.role);
  if (await contentHash(recipe) !== value.sourceHash) throw new Error("Recipe changed; stale translation rejected");
  const db = providedDb ?? await database(); const now = new Date();
  const row = await db.update(recipeTranslations).set({ leaseUntil: new Date(now.getTime() + 120_000), updatedAt: now }).where(and(eq(recipeTranslations.recipeId, recipe.id), eq(recipeTranslations.status, "pending"), eq(recipeTranslations.sourceHash, value.sourceHash), eq(recipeTranslations.leaseToken, value.token), gt(recipeTranslations.leaseUntil, now), currentContentMatches(recipe))).returning({ id: recipeTranslations.recipeId }).get();
  if (!row) throw new Error("Translation claim changed; stale heartbeat rejected");
}

export async function completeTranslation(recipe: SourceRecipe, actor: RecipeActor, value: { sourceHash: string; token: string; translations: unknown }, providedDb?: Database): Promise<TranslationSnapshot> {
  requireEditor(actor.role);
  if (await contentHash(recipe) !== value.sourceHash) throw new Error("Recipe content changed; stale translation rejected");
  const translations = parseTranslations(value.translations, recipe);
  const db = providedDb ?? await database();
  const row = await db.update(recipeTranslations).set({ status: "ready", zhJson: JSON.stringify(translations.zh), enJson: JSON.stringify(translations.en), leaseToken: null, leaseUntil: null, updatedAt: new Date() }).where(and(eq(recipeTranslations.recipeId, recipe.id), eq(recipeTranslations.sourceHash, value.sourceHash), eq(recipeTranslations.leaseToken, value.token), eq(recipeTranslations.status, "pending"), gt(recipeTranslations.leaseUntil, new Date()), currentContentMatches(recipe))).returning({ id: recipeTranslations.recipeId }).get();
  if (!row) throw new Error("Translation claim changed; stale result rejected");
  return { status: "ready", sourceHash: value.sourceHash, translations };
}

export async function failTranslation(recipeId: string, actor: RecipeActor, value: { sourceHash: string; token: string }, providedDb?: Database) {
  requireEditor(actor.role);
  const db = providedDb ?? await database();
  await db.update(recipeTranslations).set({ status: sql`case when ${recipeTranslations.sourceHash} = ${value.sourceHash} then 'failed' else 'pending' end`, leaseToken: null, leaseUntil: null, updatedAt: new Date() }).where(and(eq(recipeTranslations.recipeId, recipeId), eq(recipeTranslations.status, "pending"), eq(recipeTranslations.leaseToken, value.token)));
}

export async function listReadyTranslations(recipes: RecipeRecord[], providedDb?: Database): Promise<Record<string, BilingualContent>> {
  const snapshots = await listTranslationSnapshots(recipes, providedDb);
  return Object.fromEntries(Object.entries(snapshots).flatMap(([id, snapshot]) => snapshot.status === "ready" ? [[id, snapshot.translations]] : []));
}

export async function listTranslationSnapshots(recipes: RecipeRecord[], providedDb?: Database): Promise<Record<string, TranslationSnapshot>> {
  const db = providedDb ?? await database();
  const rows = await db.select().from(recipeTranslations);
  const saved = new Map(rows.map((row) => [row.recipeId, row]));
  const result: Record<string, TranslationSnapshot> = {};
  await Promise.all(recipes.map(async (recipe) => {
    const row = saved.get(recipe.id);
    result[recipe.id] = snapshotFromRow(recipe, row, await contentHash(recipe));
  }));
  return result;
}
