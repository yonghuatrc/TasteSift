import test from "node:test";
import assert from "node:assert/strict";
import { contentHash, parseTranslations } from "../../lib/recipes/content.ts";

const recipe = { title: "干蒸排骨", description: "蒜香排骨", ingredients: ["排骨 500 克"], steps: ["蒸 15 分钟。"], notes: null };

test("translation cache keys change only when recipe text changes", async () => {
  const original = await contentHash(recipe);
  assert.equal(await contentHash({ ...recipe, imageUrl: "https://example.com/photo.jpg", cuisine: "中餐" }), original);
  assert.notEqual(await contentHash({ ...recipe, steps: ["蒸 20 分钟。"] }), original);
});

test("bilingual output cannot drop ingredients or steps", () => {
  const en = { title: "Steamed ribs", description: "Garlic ribs", ingredients: ["500 g ribs"], steps: ["Steam for 15 minutes."], notes: null };
  assert.equal(parseTranslations({ zh: recipe, en }, recipe).en.title, "Steamed ribs");
  assert.throws(() => parseTranslations({ zh: recipe, en: { ...en, steps: [] } }, recipe));
  assert.throws(() => parseTranslations({ zh: recipe, en: { ...en, ingredients: ["ribs", "invented ingredient"] } }, recipe));
});

test("translation cannot invent a description or note missing from the source", () => {
  const source = { ...recipe, description: null };
  assert.throws(() => parseTranslations({ zh: source, en: { ...source, description: "Invented description" } }, source));
  assert.throws(() => parseTranslations({ zh: source, en: { ...source, notes: "Invented storage advice" } }, source));
});

test("translation cannot omit or blank an existing description or note", () => {
  const source = { ...recipe, notes: "必须冷藏" };
  assert.throws(() => parseTranslations({ zh: source, en: { ...source, description: null } }, source));
  assert.throws(() => parseTranslations({ zh: source, en: { ...source, notes: null } }, source));
  assert.throws(() => parseTranslations({ zh: source, en: { ...source, description: "" } }, source));
});
