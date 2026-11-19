import { eq } from "drizzle-orm";
import { z } from "zod";
import type { getDb } from "../../db/index.ts";
import { categoryAliases, recipeCategories, recipes } from "../../db/schema.ts";
import { requireEditor } from "../auth/permissions.ts";
import type { RecipeActor } from "./service.ts";
import { buildCategoryCatalog, categoryKey, existingCategoryForNames, isBuiltInCategory, type Category } from "./categories.ts";

type CategoryDatabase = ReturnType<typeof getDb>;
async function database() { return (await import("../../db/index.ts")).getDb(); }

export async function listCategoryCatalog(providedDb?: CategoryDatabase): Promise<Category[]> {
  const db = providedDb ?? await database();
  const [stored, aliases, existing] = await Promise.all([
    db.select().from(recipeCategories), db.select().from(categoryAliases),
    db.selectDistinct({ cuisine: recipes.cuisine, dishType: recipes.dishType }).from(recipes),
  ]);
  return buildCategoryCatalog(stored.map((row) => ({ value: row.id, kind: row.kind, labelZh: row.labelZh, labelEn: row.labelEn, aliases: aliases.filter((alias) => alias.categoryId === row.id && alias.kind === row.kind).map((alias) => alias.normalizedName) })), existing);
}

const categoryName = z.string().trim().min(1).max(60).refine((value) => categoryKey(value).length > 0);
const categoryInput = z.object({ kind: z.enum(["cuisine", "dishType"]), labelZh: categoryName, labelEn: categoryName });

function aliasCollision(error: unknown): boolean {
  let cause = error;
  for (let depth = 0; depth < 5 && cause instanceof Error; depth++, cause = cause.cause) {
    if (/UNIQUE constraint failed: category_aliases\.kind, category_aliases\.normalized_name/.test(cause.message)) return true;
  }
  return false;
}

export async function createCategory(value: unknown, actor: RecipeActor, providedDb?: CategoryDatabase): Promise<Category> {
  requireEditor(actor.role);
  const input = categoryInput.parse(value);
  const db = providedDb ?? await database();
  for (let attempt = 0; attempt < 3; attempt++) {
    const previous = existingCategoryForNames(await listCategoryCatalog(db), input.kind, input.labelZh, input.labelEn);
    const persisted = previous ? await db.select().from(recipeCategories).where(eq(recipeCategories.id, previous.value)).get() : undefined;
    const legacy = previous && previous.labelZh === previous.value && previous.labelEn === previous.value;
    const category: Category = previous
      ? { ...previous, value: persisted?.kind === input.kind || isBuiltInCategory(previous) ? previous.value : crypto.randomUUID(), aliases: [...previous.aliases, previous.value], labelZh: legacy ? input.labelZh : previous.labelZh, labelEn: legacy ? input.labelEn : previous.labelEn }
      : { value: crypto.randomUUID(), ...input, aliases: [] };
    const aliases = [...new Set([category.value, category.labelZh, category.labelEn, ...category.aliases, input.labelZh, input.labelEn].map(categoryKey))];
    const stored = await db.select().from(categoryAliases).where(eq(categoryAliases.kind, input.kind));
    // Another request may have claimed a name since the catalog was read.
    if (aliases.some((name) => stored.some((alias) => alias.normalizedName === name && alias.categoryId !== category.value))) continue;
    const missing = aliases.filter((name) => !stored.some((alias) => alias.normalizedName === name));
    try {
      await db.batch([
        db.insert(recipeCategories).values({ id: category.value, kind: category.kind, labelZh: category.labelZh, labelEn: category.labelEn }).onConflictDoUpdate({ target: recipeCategories.id, set: { labelZh: category.labelZh, labelEn: category.labelEn } }),
        ...missing.map((normalizedName) => db.insert(categoryAliases).values({ kind: input.kind, normalizedName, categoryId: category.value })),
      ]);
      return { ...category, aliases };
    } catch (error) {
      // Roll back the entire batch, reload the winner and attach remaining names.
      if (!aliasCollision(error) || attempt === 2) throw error;
    }
  }
  throw new Error("Category names changed concurrently; please retry");
}
