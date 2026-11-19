import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { buildCategoryCatalog, categoryLabel, findCategory, resolveRecipeCategories, existingCategoryForNames } from "../../lib/recipes/categories.ts";

test("Chinese and English category aliases reuse one stable category", () => {
  const catalog = buildCategoryCatalog([], [{ cuisine: " Western ", dishType: "Main" }]);
  assert.equal(findCategory(catalog, "cuisine", "西餐")?.value, "Western");
  assert.equal(findCategory(catalog, "cuisine", "ｗｅｓｔｅｒｎ")?.value, "Western");
  assert.equal(findCategory(catalog, "dishType", "主菜")?.value, "Mains");
  assert.equal(catalog.filter((item) => item.kind === "cuisine" && item.value === "Western").length, 1);
  assert.ok(findCategory(catalog, "cuisine", "西餐")?.aliases.includes(" Western "));
});

test("legacy category values survive and custom bilingual names match", () => {
  const catalog = buildCategoryCatalog([{ value: "custom-1", kind: "cuisine", labelZh: "娘惹菜", labelEn: "Nyonya", aliases: [] }], [{ cuisine: "Family special" }]);
  assert.equal(findCategory(catalog, "cuisine", "nyonya")?.value, "custom-1");
  assert.equal(findCategory(catalog, "cuisine", "Family special")?.value, "Family special");
});

test("legacy vegetarian labels display in English in both category kinds", () => {
  const catalog = buildCategoryCatalog([], [{ cuisine: "素食料理", dishType: "素食料理" }]);
  for (const kind of ["cuisine", "dishType"] as const) {
    assert.equal(categoryLabel(catalog, kind, "素食料理", "en"), "Vegetarian");
    assert.equal(categoryLabel(catalog, kind, "素食料理", "zh"), "素食料理");
    assert.equal(findCategory(catalog, kind, "Vegetarian")?.value, "素食料理");
  }
});

test("a save reuses known categories but refuses unconfirmed suggestions", () => {
  const catalog = buildCategoryCatalog();
  const recipe = { title: "饭", ingredients: ["米"], steps: ["煮"], cuisine: "Chinese", dishType: "Main" };
  assert.deepEqual(resolveRecipeCategories(recipe, catalog), { ...recipe, cuisine: "中餐", dishType: "Mains" });
  assert.throws(() => resolveRecipeCategories({ ...recipe, cuisine: "New imaginary category" }, catalog), /cuisine/);
});

test("new names reuse existing aliases and cannot combine two existing categories", () => {
  const catalog = buildCategoryCatalog();
  assert.equal(existingCategoryForNames(catalog, "cuisine", "西餐", " western ")?.value, "Western");
  assert.throws(() => existingCategoryForNames(catalog, "cuisine", "中餐", "Western"), /different categories/);
});

test("the database rejects duplicate aliases within a kind but permits the other kind", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(readFileSync(new URL("../../drizzle/0001_cuddly_warpath.sql", import.meta.url), "utf8"));
    db.prepare("INSERT INTO recipe_categories VALUES (?, ?, ?, ?)").run("one", "cuisine", "娘惹菜", "Nyonya");
    db.prepare("INSERT INTO recipe_categories VALUES (?, ?, ?, ?)").run("two", "cuisine", "娘惹料理", "Nyonya dishes");
    db.prepare("INSERT INTO category_aliases VALUES (?, ?, ?)").run("cuisine", "nyonya", "one");
    assert.throws(() => db.prepare("INSERT INTO category_aliases VALUES (?, ?, ?)").run("cuisine", "nyonya", "two"), /UNIQUE/);
    db.prepare("INSERT INTO category_aliases VALUES (?, ?, ?)").run("dishType", "nyonya", "two");
    assert.equal(db.prepare("SELECT count(*) AS count FROM category_aliases").get()?.count, 2);
  } finally { db.close(); }
});
