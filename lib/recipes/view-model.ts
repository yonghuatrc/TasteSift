import { ZodError } from "zod";

import { can } from "../auth/permissions.ts";
import type { Role } from "../auth/roles.ts";
import { parseRecipeInput, type RecipeInput } from "./model.ts";

const UNKNOWN = "Unknown";

export function recipeViewModel(recipe: RecipeInput) {
  return {
    ...recipe,
    servings: recipe.servings || UNKNOWN,
    prepTime:
      recipe.prepMinutes == null ? UNKNOWN : `${recipe.prepMinutes} min`,
    cookTime:
      recipe.cookMinutes == null ? UNKNOWN : `${recipe.cookMinutes} min`,
    cuisine: recipe.cuisine || UNKNOWN,
    dishType: recipe.dishType || UNKNOWN,
    ingredients: [...recipe.ingredients],
    steps: [...recipe.steps],
  };
}

export function controlsForRole(role: Role) {
  return {
    canCreate: can(role, "create"),
    canEdit: can(role, "update"),
    canDelete: can(role, "delete"),
    canManageFamily: can(role, "manage_members"),
  };
}

export type FieldErrors = Record<string, string>;

export function validateRecipeDraft(
  value: unknown,
):
  | { success: true; data: RecipeInput }
  | { success: false; errors: FieldErrors } {
  try {
    return { success: true, data: parseRecipeInput(value) };
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;

    const errors: FieldErrors = {};
    for (const issue of error.issues) {
      const field = issue.path.join(".");
      if (field && !errors[field]) errors[field] = issue.message;
    }
    return { success: false, errors };
  }
}
