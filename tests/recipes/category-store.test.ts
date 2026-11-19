import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase as database } from "../helpers/sqlite-d1.ts";
import { createCategory, listCategoryCatalog } from "../../lib/recipes/category-store.ts";
import { findCategory } from "../../lib/recipes/categories.ts";
const owner = { userId: "owner", role: "owner" as const };

test("reusing a legacy category persists both submitted language aliases", async (t) => {
  const { db, sqlite } = database(t);
  sqlite.exec("INSERT INTO members(user_id,email,role) VALUES ('owner','owner@example.test','owner'); INSERT INTO recipes(id,title,cuisine,ingredients_json,steps_json,created_by) VALUES ('one','Rice','Thai','[\"rice\"]','[\"cook\"]','owner')");
  const first = await createCategory({ kind: "cuisine", labelZh: "泰国菜", labelEn: "Thai" }, owner, db);
  assert.equal(findCategory(await listCategoryCatalog(db), "cuisine", "泰国菜")?.value, first.value);
  const second = await createCategory({ kind: "cuisine", labelZh: "泰国菜", labelEn: "Thailand" }, owner, db);
  assert.equal(second.value, first.value);
  assert.equal(findCategory(await listCategoryCatalog(db), "cuisine", "Thailand")?.value, first.value);
});

test("concurrent names sharing an alias persist all names on one category", async (t) => {
  const { db, sqlite } = database(t);
  const [first, second] = await Promise.all([
    createCategory({ kind: "cuisine", labelZh: "娘惹菜", labelEn: "Nyonya" }, owner, db),
    createCategory({ kind: "cuisine", labelZh: "娘惹料理", labelEn: "Nyonya" }, owner, db),
  ]);
  assert.equal(first.value, second.value);
  const catalog = await listCategoryCatalog(db);
  assert.equal(findCategory(catalog, "cuisine", "娘惹菜")?.value, first.value);
  assert.equal(findCategory(catalog, "cuisine", "娘惹料理")?.value, first.value);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM recipe_categories").get()?.count, 1);
});

test("adding an alias to a built-in category does not duplicate its dropdown entry", async (t) => {
  const { db } = database(t);
  await createCategory({ kind: "cuisine", labelZh: "西餐", labelEn: "European" }, owner, db);
  const catalog = await listCategoryCatalog(db);
  assert.equal(findCategory(catalog, "cuisine", "European")?.value, "Western");
  assert.equal(catalog.filter((category) => category.kind === "cuisine" && category.value === "Western").length, 1);
});

test("the same legacy name in cuisine and dish type gets distinct persistent records", async (t) => {
  const { db, sqlite } = database(t);
  sqlite.exec("INSERT INTO members(user_id,email,role) VALUES ('owner','owner@example.test','owner'); INSERT INTO recipes(id,title,cuisine,dish_type,ingredients_json,steps_json,created_by) VALUES ('one','Rice','素食料理','素食料理','[\"rice\"]','[\"cook\"]','owner')");
  const cuisine = await createCategory({ kind: "cuisine", labelZh: "素食料理", labelEn: "Vegetarian" }, owner, db);
  const dishType = await createCategory({ kind: "dishType", labelZh: "素食料理", labelEn: "Vegetarian" }, owner, db);
  assert.notEqual(cuisine.value, dishType.value);
  const catalog = await listCategoryCatalog(db);
  assert.equal(findCategory(catalog, "cuisine", "Vegetarian")?.value, cuisine.value);
  assert.equal(findCategory(catalog, "dishType", "Vegetarian")?.value, dishType.value);
});
