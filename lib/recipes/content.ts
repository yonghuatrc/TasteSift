import { z } from "zod";
import type { RecipeInput, RecipeRecord } from "./model.ts";

const text = z.string().trim().min(1);
const contentSchema = z.object({ title: text, description: text.nullable(), ingredients: z.array(text).min(1), steps: z.array(text).min(1), notes: text.nullable() }).strict();
export type RecipeContent = z.infer<typeof contentSchema>;
export type BilingualContent = { zh: RecipeContent; en: RecipeContent };
export type RecipeWithTranslations = RecipeRecord & { translations?: BilingualContent };

export function recipeContent(recipe: RecipeInput): RecipeContent {
  return { title: recipe.title, description: recipe.description ?? null, ingredients: [...recipe.ingredients], steps: [...recipe.steps], notes: recipe.notes ?? null };
}

export async function contentHash(recipe: RecipeInput): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(recipeContent(recipe)));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseTranslations(value: unknown, source: RecipeInput): BilingualContent {
  const result = z.object({ zh: contentSchema, en: contentSchema }).strict().parse(value);
  for (const translated of [result.zh, result.en]) {
    if (translated.ingredients.length !== source.ingredients.length || translated.steps.length !== source.steps.length) throw new Error("Translation changed ingredient or step count");
    for (const field of ["description", "notes"] as const) if ((source[field] == null) !== (translated[field] === null)) throw new Error("Translation changed source content presence");
  }
  return result;
}
