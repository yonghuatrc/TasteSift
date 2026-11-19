import type { RecipeInput } from "./model.ts";
import type { FieldErrors } from "./view-model.ts";

export type RecipeFormValues = {
  title: string;
  description: string;
  sourceUrl: string;
  sourcePlatform: string;
  imageUrl: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  cuisine: string;
  dishType: string;
  ingredients: string[];
  steps: string[];
  notes: string;
};

export type RecipeFormState = {
  revision: number;
  values: RecipeFormValues;
  errors: FieldErrors;
};

export const emptyRecipeForm: RecipeFormValues = {
  title: "",
  description: "",
  sourceUrl: "",
  sourcePlatform: "",
  imageUrl: "",
  servings: "",
  prepMinutes: "",
  cookMinutes: "",
  cuisine: "",
  dishType: "",
  ingredients: [""],
  steps: [""],
  notes: "",
};

export function recipeFormValues(recipe: RecipeInput): RecipeFormValues {
  return {
    title: recipe.title,
    description: recipe.description ?? "",
    sourceUrl: recipe.sourceUrl ?? "",
    sourcePlatform: recipe.sourcePlatform ?? "",
    imageUrl: recipe.imageUrl ?? "",
    servings: recipe.servings ?? "",
    prepMinutes: recipe.prepMinutes?.toString() ?? "",
    cookMinutes: recipe.cookMinutes?.toString() ?? "",
    cuisine: recipe.cuisine ?? "",
    dishType: recipe.dishType ?? "",
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    notes: recipe.notes ?? "",
  };
}
