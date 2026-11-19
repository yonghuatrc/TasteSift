import test from "node:test";
import assert from "node:assert/strict";
import { languageFromValue, translate } from "../../lib/i18n.ts";

test("unsupported language falls back to Chinese", () => {
  assert.equal(languageFromValue("fr"), "zh");
  assert.equal(languageFromValue("en"), "en");
});

test("labels switch language while substituting recipe counts", () => {
  assert.equal(translate("en", "recipeCount", { count: 3 }), "3 saved recipes · Search by title, ingredient or category");
  assert.equal(translate("zh", "save"), "保存食谱");
});
