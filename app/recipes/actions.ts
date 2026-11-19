"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentMember } from "../../lib/auth/current-member.ts";
import { CategoryError } from "../../lib/recipes/categories.ts";
import { preparedTranslationsForSave } from "../../lib/recipes/import-job-store.ts";
import type {
  RecipeFormState,
  RecipeFormValues,
} from "../../lib/recipes/form-state.ts";
import {
  createRecipe,
  deleteRecipe,
  DuplicateRecipeError,
  updateRecipe,
} from "../../lib/recipes/service.ts";
import {
  type FieldErrors,
  validateRecipeDraft,
} from "../../lib/recipes/view-model.ts";

function valuesFromFormData(formData: FormData): RecipeFormValues {
  const text = (name: string) => String(formData.get(name) ?? "");
  return {
    title: text("title"),
    description: text("description"),
    sourceUrl: text("sourceUrl"),
    sourcePlatform: text("sourcePlatform"),
    imageUrl: text("imageUrl"),
    servings: text("servings"),
    prepMinutes: text("prepMinutes"),
    cookMinutes: text("cookMinutes"),
    cuisine: text("cuisine"),
    dishType: text("dishType"),
    ingredients: formData.getAll("ingredients").map(String),
    steps: formData.getAll("steps").map(String),
    notes: text("notes"),
  };
}

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function validate(values: RecipeFormValues) {
  return validateRecipeDraft({
    title: values.title,
    description: optional(values.description),
    sourceUrl: optional(values.sourceUrl),
    sourcePlatform: optional(values.sourcePlatform),
    imageUrl: optional(values.imageUrl),
    servings: optional(values.servings),
    prepMinutes: values.prepMinutes ? Number(values.prepMinutes) : undefined,
    cookMinutes: values.cookMinutes ? Number(values.cookMinutes) : undefined,
    cuisine: optional(values.cuisine),
    dishType: optional(values.dishType),
    ingredients: values.ingredients,
    steps: values.steps,
    notes: optional(values.notes),
  });
}

function invalidState(
  previous: RecipeFormState,
  values: RecipeFormValues,
  errors: FieldErrors,
): RecipeFormState {
  return { revision: previous.revision + 1, values, errors };
}

export async function createRecipeAction(
  previous: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const values = valuesFromFormData(formData);
  const current = await requireCurrentMember("/recipes/new");
  const validation = validate(values);
  if (!validation.success) return invalidState(previous, values, validation.errors);

  try {
    const jobId = String(formData.get("importJobId") ?? "");
    const prepared = jobId ? await preparedTranslationsForSave(jobId, validation.data, current.actor) : undefined;
    const recipe = await createRecipe(validation.data, current.actor, undefined, prepared);
    revalidatePath("/");
    redirect(`/recipes/${recipe.id}`);
  } catch (error) {
    if (error instanceof CategoryError) return invalidState(previous, values, { [error.field]: error.message });
    if (error instanceof DuplicateRecipeError) {
      return invalidState(previous, values, { sourceUrl: error.message });
    }
    throw error;
  }
}

export async function updateRecipeAction(
  id: string,
  previous: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const values = valuesFromFormData(formData);
  const current = await requireCurrentMember(`/recipes/${id}/edit`);
  const validation = validate(values);
  if (!validation.success) return invalidState(previous, values, validation.errors);

  try {
    await updateRecipe(id, validation.data, current.actor);
    revalidatePath("/");
    revalidatePath(`/recipes/${id}`);
    redirect(`/recipes/${id}`);
  } catch (error) {
    if (error instanceof CategoryError) return invalidState(previous, values, { [error.field]: error.message });
    if (error instanceof DuplicateRecipeError) {
      return invalidState(previous, values, { sourceUrl: error.message });
    }
    throw error;
  }
}

export async function deleteRecipeAction(id: string) {
  const current = await requireCurrentMember(`/recipes/${id}`);
  await deleteRecipe(id, current.actor);
  revalidatePath("/");
  redirect("/");
}
