import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { buildCategoryCatalog } from "../../lib/recipes/categories.ts";

import type { Role } from "../../lib/auth/roles.ts";
import type { RecipeInput, RecipeRecord } from "../../lib/recipes/model.ts";
import {
  createRecipe,
  deleteRecipe,
  getRecipe,
  updateRecipe,
  DuplicateRecipeError,
} from "../../lib/recipes/service.ts";
import {
  fromRecipeRow,
  toRecipeRow,
  type RecipeRepository,
  type RecipeRow,
} from "../../lib/recipes/repository.ts";

const input: RecipeInput = {
  title: "Noodles",
  sourceUrl: "https://example.com/recipe?utm_source=test&id=7",
  ingredients: ["noodles", "egg"],
  steps: ["Boil", "Serve"],
};

const actor = (role: Role | null, userId = "user-1") => ({ role, userId });

class FakeRepository implements RecipeRepository {
  async listCategories() { return buildCategoryCatalog([], [...this.records.values()]); }
  records = new Map<string, RecipeRecord>();
  calls = 0;

  async list() {
    this.calls += 1;
    return [...this.records.values()];
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

test("owners and editors can create and update recipes", async () => {
  for (const role of ["owner", "editor"] as const) {
    const repository = new FakeRepository();
    const created = await createRecipe(input, actor(role), repository);
    const updated = await updateRecipe(
      created.id,
      { ...input, title: `${role} noodles` },
      actor(role),
      repository,
    );

    assert.equal(updated.title, `${role} noodles`);
    assert.equal(updated.createdBy, "user-1");
  }
});

test("viewers cannot create or update recipes", async () => {
  const repository = new FakeRepository();
  await assert.rejects(() => createRecipe(input, actor("viewer"), repository), /not available/i);
  await assert.rejects(() => updateRecipe("hidden", input, actor("viewer"), repository), /not available/i);
});

test("only an owner can delete", async () => {
  const repository = new FakeRepository();
  const created = await createRecipe(input, actor("owner"), repository);

  await assert.rejects(() => deleteRecipe(created.id, actor("editor"), repository), /not available/i);
  assert.equal(await deleteRecipe(created.id, actor("owner"), repository), true);
});

test("rejects duplicate normalized source URLs", async () => {
  const repository = new FakeRepository();
  await createRecipe(input, actor("owner"), repository);

  await assert.rejects(
    () =>
      createRecipe(
        { ...input, sourceUrl: "https://EXAMPLE.com/recipe?id=7#steps" },
        actor("editor"),
        repository,
      ),
    /already exists/i,
  );
});

test("rejects a missing member before looking up private data", async () => {
  const repository = new FakeRepository();

  await assert.rejects(() => getRecipe("private-id", actor(null), repository), /not available/i);
  assert.equal(repository.calls, 0);
});

test("repository serialization preserves ingredient and step order", () => {
  const record: RecipeRecord = {
    ...input,
    id: "recipe-1",
    normalizedSourceUrl: "https://example.com/recipe?id=7",
    createdBy: "owner",
    createdAt: new Date(1),
    updatedAt: new Date(2),
  };

  const row = toRecipeRow(record);
  assert.deepEqual(fromRecipeRow(row as RecipeRow).ingredients, ["noodles", "egg"]);
  assert.deepEqual(fromRecipeRow(row as RecipeRow).steps, ["Boil", "Serve"]);
});

test("concurrent equivalent-source saves create one row and a recoverable duplicate error", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("CREATE TABLE recipes (id TEXT PRIMARY KEY, normalized_source_url TEXT UNIQUE)");
  const repository = new FakeRepository();
  // Both concurrent requests observe the pre-insert state; SQLite owns the race.
  repository.findByNormalizedSource = async () => null;
  repository.insert = async (record) => {
    database.prepare("INSERT INTO recipes VALUES (?, ?)").run(record.id, record.normalizedSourceUrl);
    return record;
  };
  try {
    const results = await Promise.allSettled([
      createRecipe(input, actor("owner"), repository),
      createRecipe({ ...input, sourceUrl: "https://EXAMPLE.com/recipe?id=7#steps" }, actor("owner"), repository),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected" && rejected.reason instanceof DuplicateRecipeError);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM recipes").get()?.count, 1);
  } finally { database.close(); }
});

test("update maps D1 source uniqueness conflicts while leaving other failures intact", async () => {
  const repository = new FakeRepository();
  const created = await createRecipe(input, actor("owner"), repository);
  repository.findByNormalizedSource = async () => null;
  repository.update = async () => {
    throw new Error("Failed query", { cause: new Error("D1_ERROR: UNIQUE constraint failed: recipes.normalized_source_url: SQLITE_CONSTRAINT") });
  };
  await assert.rejects(() => updateRecipe(created.id, input, actor("owner"), repository), DuplicateRecipeError);
  repository.update = async () => { throw new Error("Database unavailable"); };
  await assert.rejects(() => updateRecipe(created.id, input, actor("owner"), repository), /Database unavailable/);
});
