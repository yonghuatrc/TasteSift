import { and, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";

import { recipes, recipeTranslations } from "../../db/schema.ts";
import type { getDb } from "../../db/index.ts";
import type { BilingualContent } from "./content.ts";
import { queuedTranslationUpdate, translationValues } from "./translation-store.ts";
import type { RecipeRecord } from "./model.ts";
import { escapeLikePattern, type RecipeSearchQuery } from "./search.ts";
import { findCategory, type Category } from "./categories.ts";

export type RecipeRow = typeof recipes.$inferSelect;
type RecipeInsert = typeof recipes.$inferInsert;

export interface RecipeRepository {
  listCategories(): Promise<Category[]>;
  list(query?: RecipeSearchQuery): Promise<RecipeRecord[]>;
  get(id: string): Promise<RecipeRecord | null>;
  findByNormalizedSource(url: string): Promise<RecipeRecord | null>;
  insert(recipe: RecipeRecord, prepared?: BilingualContent): Promise<RecipeRecord>;
  update(recipe: RecipeRecord): Promise<RecipeRecord>;
  delete(id: string): Promise<boolean>;
}

export function toRecipeRow(recipe: RecipeRecord): RecipeInsert {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description ?? null,
    sourceUrl: recipe.sourceUrl ?? null,
    normalizedSourceUrl: recipe.normalizedSourceUrl,
    sourcePlatform: recipe.sourcePlatform ?? null,
    imageUrl: recipe.imageUrl ?? null,
    servings: recipe.servings ?? null,
    prepMinutes: recipe.prepMinutes ?? null,
    cookMinutes: recipe.cookMinutes ?? null,
    cuisine: recipe.cuisine ?? null,
    dishType: recipe.dishType ?? null,
    ingredientsJson: JSON.stringify(recipe.ingredients),
    stepsJson: JSON.stringify(recipe.steps),
    notes: recipe.notes ?? null,
    createdBy: recipe.createdBy,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  };
}

export function fromRecipeRow(row: RecipeRow): RecipeRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sourceUrl: row.sourceUrl,
    normalizedSourceUrl: row.normalizedSourceUrl,
    sourcePlatform: row.sourcePlatform,
    imageUrl: row.imageUrl,
    servings: row.servings,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    cuisine: row.cuisine,
    dishType: row.dishType,
    ingredients: JSON.parse(row.ingredientsJson) as string[],
    steps: JSON.parse(row.stepsJson) as string[],
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createD1RecipeRepository(providedDb?: ReturnType<typeof getDb>): RecipeRepository {
  async function listCategories() { const { listCategoryCatalog } = await import("./category-store.ts"); return listCategoryCatalog(providedDb); }
  async function database() {
    if (providedDb) return providedDb;
    const { getDb } = await import("../../db/index.ts");
    return getDb();
  }

  return {
    listCategories,
    async list(query = {}) {
      const db = await database();
      const conditions: SQL[] = [];
      const text = query.text?.trim();

      if (text) {
        const pattern = `%${escapeLikePattern(text)}%`;
        conditions.push(
          or(
            sql`${recipes.title} LIKE ${pattern} ESCAPE '\\'`,
            sql`${recipes.ingredientsJson} LIKE ${pattern} ESCAPE '\\'`,
          ) as SQL,
        );
      }
      const catalog = query.cuisine || query.dishType ? await listCategories() : [];
      for (const kind of ["cuisine", "dishType"] as const) if (query[kind]) {
        const category = findCategory(catalog, kind, query[kind]);
        const values = category ? [...new Set([category.value, category.labelZh, category.labelEn, ...category.aliases])] : [query[kind]!];
        conditions.push(inArray(recipes[kind], values));
      }

      const rows = await db
        .select()
        .from(recipes)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(recipes.updatedAt));
      return rows.map(fromRecipeRow);
    },

    async get(id) {
      const db = await database();
      const row = await db.query.recipes.findFirst({ where: eq(recipes.id, id) });
      return row ? fromRecipeRow(row) : null;
    },

    async findByNormalizedSource(url) {
      const db = await database();
      const row = await db.query.recipes.findFirst({
        where: eq(recipes.normalizedSourceUrl, url),
      });
      return row ? fromRecipeRow(row) : null;
    },

    async insert(recipe, prepared) {
      const db = await database();
      const cache = await translationValues(recipe, prepared);
      await db.batch([db.insert(recipes).values(toRecipeRow(recipe)), db.insert(recipeTranslations).values(cache)]);
      return recipe;
    },

    async update(recipe) {
      const db = await database();
      const { id, ...values } = toRecipeRow(recipe);
      const cache = await translationValues(recipe);
      await db.batch([db.update(recipes).set(values).where(eq(recipes.id, id)), db.insert(recipeTranslations).values(cache).onConflictDoUpdate({ target: recipeTranslations.recipeId, set: queuedTranslationUpdate(cache), setWhere: ne(recipeTranslations.sourceHash, cache.sourceHash) })]);
      return recipe;
    },

    async delete(id) {
      const db = await database();
      const deleted = await db
        .delete(recipes)
        .where(eq(recipes.id, id))
        .returning({ id: recipes.id });
      return deleted.length > 0;
    },
  };
}
