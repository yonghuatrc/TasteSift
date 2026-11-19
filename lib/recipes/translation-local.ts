import { parseTranslations, recipeContent, type BilingualContent } from "./content.ts";
import type { RecipeInput } from "./model.ts";
import { TranslationClientError } from "./translation-client.ts";

export async function translateRecipeOnMac(recipe: RecipeInput, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<BilingualContent> {
  try {
    const deadline = AbortSignal.timeout(6 * 60_000);
    const response = await fetcher("http://127.0.0.1:18788/translate-recipe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: recipeContent(recipe) }), signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
    if (!response.ok) throw new TranslationClientError("translationFailed");
    const result = await response.json() as { translations?: unknown };
    return parseTranslations(result.translations, recipe);
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof TranslationClientError) throw error;
    throw new TranslationClientError(error instanceof TypeError ? "translationOffline" : "translationFailed");
  }
}
