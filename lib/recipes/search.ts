import type { RecipeRecord } from "./model.ts";
import { findCategory, type Category, type CategoryKind } from "./categories.ts";

export type RecipeSearchQuery = {
  text?: string;
  cuisine?: string;
  dishType?: string;
};

export function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export function matchesRecipeSearch(
  recipe: RecipeRecord,
  query: RecipeSearchQuery,
  categories: Category[] = [],
): boolean {
  const text = query.text?.trim().toLocaleLowerCase();
  const matchesText =
    !text ||
    recipe.title.toLocaleLowerCase().includes(text) ||
    recipe.ingredients.some((ingredient) =>
      ingredient.toLocaleLowerCase().includes(text),
    );

  const matchesCategory = (kind: CategoryKind) => !query[kind] ||
    (findCategory(categories, kind, recipe[kind])?.value ?? recipe[kind]) ===
    (findCategory(categories, kind, query[kind])?.value ?? query[kind]);
  return matchesText && matchesCategory("cuisine") && matchesCategory("dishType");
}
