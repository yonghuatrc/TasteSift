import { z } from "zod";

import { requireEditor } from "../auth/permissions.ts";
import { parseRecipeInput } from "../recipes/model.ts";
import type { RecipeRepository } from "../recipes/repository.ts";
import { createD1RecipeRepository } from "../recipes/repository.ts";
import {
  createRecipe,
  listRecipes,
  type RecipeActor,
} from "../recipes/service.ts";
import { normalizeSourceUrl } from "../recipes/source-url.ts";
import type { ToolResult } from "./protocol.ts";

const searchArguments = z.object({
  query: z.string().optional(),
  cuisine: z.string().optional(),
  dishType: z.string().optional(),
});

function textResult(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
  };
}

export async function executeTasteSiftTool(
  name: string,
  args: Record<string, unknown>,
  actor: RecipeActor,
  repository: RecipeRepository = createD1RecipeRepository(),
): Promise<ToolResult> {
  if (name === "search_recipes") {
    const query = searchArguments.parse(args);
    const recipes = await listRecipes(
      { text: query.query, cuisine: query.cuisine, dishType: query.dishType },
      actor,
      repository,
    );
    return textResult({
      recipes: recipes.map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        cuisine: recipe.cuisine ?? null,
        dishType: recipe.dishType ?? null,
        ingredients: recipe.ingredients,
      })),
    });
  }

  if (name === "save_recipe") {
    requireEditor(actor.role);
    const input = parseRecipeInput(args);
    const sourceUrl = input.sourceUrl;
    if (sourceUrl) {
      const duplicate = await repository.findByNormalizedSource(
        normalizeSourceUrl(sourceUrl),
      );
      if (duplicate) {
        return textResult({
          status: "duplicate",
          message: "A recipe from this source already exists",
          recipe: { id: duplicate.id, title: duplicate.title },
        });
      }
    }

    const recipe = await createRecipe(input, actor, repository);
    return textResult({
      status: "saved",
      recipe: { id: recipe.id, title: recipe.title },
    });
  }

  throw new Error("Unknown tool");
}
