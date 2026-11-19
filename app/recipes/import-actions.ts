"use server";

import { requireCurrentMember } from "../../lib/auth/current-member.ts";
import { requireEditor } from "../../lib/auth/permissions.ts";
import { importRecipeUrl } from "../../lib/recipes/import-url.ts";
import type { RecipeInput } from "../../lib/recipes/model.ts";
import { listCategoryCatalog } from "../../lib/recipes/category-store.ts";
import { findCategory, type Category } from "../../lib/recipes/categories.ts";

export async function importRecipeAction(
  _previous: { url: string; recipe: RecipeInput | null; error: string | null; categories: Category[] },
  form: FormData,
): Promise<{ url: string; recipe: RecipeInput | null; error: string | null; categories: Category[] }> {
  const current = await requireCurrentMember("/");
  requireEditor(current.membership.role);
  const url = String(form.get("url") ?? "").trim();
  const categories = await listCategoryCatalog();
  if (url.length > 4096) return { url, recipe: null, categories, error: "链接太长，请复制原始食谱网页链接。" };
  try {
    const recipe = await importRecipeUrl(url);
    for (const kind of ["cuisine", "dishType"] as const) recipe[kind] = findCategory(categories, kind, recipe[kind])?.value ?? recipe[kind];
    return { url, recipe, categories, error: null };
  } catch (error) {
    const message = error instanceof Error && error.name !== "TimeoutError" && error.name !== "AbortError"
      ? error.message : "读取超时，请稍后重试或换一个公开食谱网页。";
    return { url, recipe: null, categories, error: message };
  }
}
