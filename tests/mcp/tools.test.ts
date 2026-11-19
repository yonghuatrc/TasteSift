import assert from "node:assert/strict";
import test from "node:test";
import { buildCategoryCatalog } from "../../lib/recipes/categories.ts";

import type { Role } from "../../lib/auth/roles.ts";
import type { RecipeRecord } from "../../lib/recipes/model.ts";
import type { RecipeRepository } from "../../lib/recipes/repository.ts";
import { matchesRecipeSearch } from "../../lib/recipes/search.ts";
import { executeTasteSiftTool } from "../../lib/mcp/tools.ts";

const actor = (role: Role | null) => ({ userId: "user-1", role });

class FakeRepository implements RecipeRepository {
  async listCategories() { return buildCategoryCatalog([], [...this.records.values()]); }
  records = new Map<string, RecipeRecord>();
  calls = 0;

  async list(query = {}) {
    this.calls += 1;
    return [...this.records.values()].filter((recipe) => matchesRecipeSearch(recipe, query));
  }
  async get(id: string) {
    this.calls += 1;
    return this.records.get(id) ?? null;
  }
  async findByNormalizedSource(url: string) {
    this.calls += 1;
    return [...this.records.values()].find((recipe) => recipe.normalizedSourceUrl === url) ?? null;
  }
  async insert(recipe: RecipeRecord) {
    this.calls += 1;
    this.records.set(recipe.id, recipe);
    return recipe;
  }
  async update(recipe: RecipeRecord) {
    this.calls += 1;
    this.records.set(recipe.id, recipe);
    return recipe;
  }
  async delete(id: string) {
    this.calls += 1;
    return this.records.delete(id);
  }
}

const recipeArguments = {
  title: "Satay",
  sourceUrl: "https://example.com/satay?utm_source=video",
  cuisine: "Malay",
  dishType: "Main",
  ingredients: ["chicken", "peanut sauce"],
  steps: ["Grill the chicken", "Serve with sauce"],
};

test("authenticated members can search recipes", async () => {
  const repository = new FakeRepository();
  await executeTasteSiftTool("save_recipe", recipeArguments, actor("owner"), repository);

  const result = await executeTasteSiftTool(
    "search_recipes",
    { query: "peanut" },
    actor("viewer"),
    repository,
  );
  assert.match(result.content[0].text, /Satay/);
});

test("owners and editors can save approved recipes", async () => {
  for (const role of ["owner", "editor"] as const) {
    const result = await executeTasteSiftTool(
      "save_recipe",
      { ...recipeArguments, title: `${role} Satay`, sourceUrl: `https://example.com/${role}` },
      actor(role),
      new FakeRepository(),
    );
    assert.match(result.content[0].text, new RegExp(`${role} Satay`, "i"));
  }
});

test("viewers cannot save recipes", async () => {
  await assert.rejects(
    () => executeTasteSiftTool("save_recipe", recipeArguments, actor("viewer"), new FakeRepository()),
    /not available/i,
  );
});

test("duplicate sources return the existing recipe reference", async () => {
  const repository = new FakeRepository();
  const first = await executeTasteSiftTool("save_recipe", recipeArguments, actor("owner"), repository);
  const duplicate = await executeTasteSiftTool(
    "save_recipe",
    { ...recipeArguments, title: "Duplicate Satay", sourceUrl: "https://EXAMPLE.com/satay#method" },
    actor("editor"),
    repository,
  );

  assert.match(first.content[0].text, /Satay/);
  assert.match(duplicate.content[0].text, /already exists/i);
  assert.match(duplicate.content[0].text, /Satay/);
});

test("a missing membership reveals no private data", async () => {
  const repository = new FakeRepository();
  await assert.rejects(
    () => executeTasteSiftTool("search_recipes", {}, actor(null), repository),
    /not available/i,
  );
  assert.equal(repository.calls, 0);
});
