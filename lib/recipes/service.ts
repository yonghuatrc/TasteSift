import { requireEditor, requireMember, requireOwner } from "../auth/permissions.ts";
import type { Role } from "../auth/roles.ts";
import { parseRecipeInput, type RecipeInput, type RecipeRecord } from "./model.ts";
import {
  createD1RecipeRepository,
  type RecipeRepository,
} from "./repository.ts";
import type { RecipeSearchQuery } from "./search.ts";
import { normalizeSourceUrl } from "./source-url.ts";
import { resolveRecipeCategories } from "./categories.ts";
import { parseTranslations, type BilingualContent } from "./content.ts";

export type RecipeActor = {
  userId: string;
  role: Role | null;
};

export class RecipeNotFoundError extends Error {
  readonly status = 404;

  constructor() {
    super("Resource not available");
    this.name = "RecipeNotFoundError";
  }
}

export class DuplicateRecipeError extends Error {
  readonly status = 409;

  constructor() {
    super("A recipe from this source already exists");
    this.name = "DuplicateRecipeError";
  }
}

function recipeWriteError(error: unknown): never {
  // D1/Drizzle may wrap the SQLite constraint in Error.cause. Only translate
  // this exact constraint; unrelated database failures must remain failures.
  let cause: unknown = error;
  for (let depth = 0; depth < 5 && cause instanceof Error; depth++) {
    if (/UNIQUE constraint failed: recipes\.normalized_source_url\b/.test(cause.message)) {
      throw new DuplicateRecipeError();
    }
    cause = cause.cause;
  }
  throw error;
}

export async function listRecipes(
  query: RecipeSearchQuery,
  actor: RecipeActor,
  repository: RecipeRepository = createD1RecipeRepository(),
): Promise<RecipeRecord[]> {
  requireMember(actor.role);
  return repository.list(query);
}

export async function getRecipe(
  id: string,
  actor: RecipeActor,
  repository: RecipeRepository = createD1RecipeRepository(),
): Promise<RecipeRecord> {
  requireMember(actor.role);
  const recipe = await repository.get(id);
  if (!recipe) throw new RecipeNotFoundError();
  return recipe;
}

export async function findDuplicateSource(
  sourceUrl: string,
  actor: RecipeActor,
  repository: RecipeRepository = createD1RecipeRepository(),
): Promise<RecipeRecord | null> {
  requireMember(actor.role);
  return repository.findByNormalizedSource(normalizeSourceUrl(sourceUrl));
}

export async function createRecipe(
  value: RecipeInput,
  actor: RecipeActor,
  repository: RecipeRepository = createD1RecipeRepository(),
  prepared?: BilingualContent,
): Promise<RecipeRecord> {
  requireEditor(actor.role);
  const input = resolveRecipeCategories(parseRecipeInput(value), await repository.listCategories());
  const normalizedSourceUrl = input.sourceUrl
    ? normalizeSourceUrl(input.sourceUrl)
    : null;

  if (
    normalizedSourceUrl &&
    (await repository.findByNormalizedSource(normalizedSourceUrl))
  ) {
    throw new DuplicateRecipeError();
  }

  const now = new Date();
  return repository.insert({
    ...input,
    id: crypto.randomUUID(),
    normalizedSourceUrl,
    createdBy: actor.userId,
    createdAt: now,
    updatedAt: now,
  }, prepared ? parseTranslations(prepared, input) : undefined).catch(recipeWriteError);
}

export async function updateRecipe(
  id: string,
  value: RecipeInput,
  actor: RecipeActor,
  repository: RecipeRepository = createD1RecipeRepository(),
): Promise<RecipeRecord> {
  requireEditor(actor.role);
  const input = resolveRecipeCategories(parseRecipeInput(value), await repository.listCategories());
  const existing = await repository.get(id);
  if (!existing) throw new RecipeNotFoundError();

  const normalizedSourceUrl = input.sourceUrl
    ? normalizeSourceUrl(input.sourceUrl)
    : null;
  const duplicate = normalizedSourceUrl
    ? await repository.findByNormalizedSource(normalizedSourceUrl)
    : null;
  if (duplicate && duplicate.id !== id) throw new DuplicateRecipeError();

  return repository.update({
    ...input,
    id,
    normalizedSourceUrl,
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    updatedAt: new Date(),
  }).catch(recipeWriteError);
}

export async function deleteRecipe(
  id: string,
  actor: RecipeActor,
  repository: RecipeRepository = createD1RecipeRepository(),
): Promise<boolean> {
  requireOwner(actor.role);
  return repository.delete(id);
}
