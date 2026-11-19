import assert from "node:assert/strict";
import test from "node:test";

import { escapeLikePattern, matchesRecipeSearch } from "../../lib/recipes/search.ts";
import type { RecipeRecord } from "../../lib/recipes/model.ts";
import { buildCategoryCatalog } from "../../lib/recipes/categories.ts";

const recipes: RecipeRecord[] = [
  {
    id: "1",
    title: "Dennis's 100% Noodles",
    cuisine: "Chinese",
    dishType: "Main",
    ingredients: ["egg_noodles", "spring onion"],
    steps: ["Boil noodles"],
    normalizedSourceUrl: null,
    createdBy: "owner",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "2",
    title: "海南鸡饭",
    cuisine: "Singaporean",
    dishType: "Main",
    ingredients: ["鸡", "姜", "米饭"],
    steps: ["煮鸡"],
    normalizedSourceUrl: null,
    createdBy: "owner",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
];

test("matches title and ingredient text literally", () => {
  assert.equal(matchesRecipeSearch(recipes[0], { text: "Dennis's" }), true);
  assert.equal(matchesRecipeSearch(recipes[0], { text: "egg_noodles" }), true);
  assert.equal(matchesRecipeSearch(recipes[0], { text: "100%" }), true);
  assert.equal(matchesRecipeSearch(recipes[0], { text: "100X" }), false);
});

test("supports Chinese search text", () => {
  assert.equal(matchesRecipeSearch(recipes[1], { text: "海南" }), true);
  assert.equal(matchesRecipeSearch(recipes[1], { text: "米饭" }), true);
});

test("partial recipe names and ingredient text match without a full name", () => {
  const ribs = { ...recipes[1], title: "干蒸排骨", ingredients: ["排骨", "豆豉"] };
  assert.equal(matchesRecipeSearch(ribs, { text: "干蒸" }), true);
  assert.equal(matchesRecipeSearch(ribs, { text: "豆豉" }), true);
  assert.equal(matchesRecipeSearch(ribs, { text: "  干蒸  " }), true);
  assert.equal(matchesRecipeSearch(ribs, { text: "不存在的食材" }), false);
});

test("client-side matching keeps legacy category aliases usable", () => {
  const catalog = buildCategoryCatalog([], recipes);
  assert.equal(matchesRecipeSearch(recipes[1], { text: "海南", cuisine: "新加坡菜", dishType: "Mains" }, catalog), true);
  assert.equal(matchesRecipeSearch(recipes[1], { text: "海南", cuisine: "Western" }, catalog), false);
});

test("combines cuisine and dish-type filters", () => {
  assert.equal(
    matchesRecipeSearch(recipes[1], { cuisine: "Singaporean", dishType: "Main" }),
    true,
  );
  assert.equal(
    matchesRecipeSearch(recipes[1], { cuisine: "Chinese", dishType: "Main" }),
    false,
  );
});

test("escapes SQL LIKE wildcard characters", () => {
  assert.equal(escapeLikePattern("50%_off\\today"), "50\\%\\_off\\\\today");
});
