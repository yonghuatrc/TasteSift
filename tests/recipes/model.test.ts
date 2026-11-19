import assert from "node:assert/strict";
import test from "node:test";

import { parseRecipeInput } from "../../lib/recipes/model.ts";

const validRecipe = {
  title: "  Hainanese Chicken Rice  ",
  ingredients: [" 1 whole chicken ", " ginger "],
  steps: [" Poach the chicken. ", " Cook the rice. "],
};

test("parses and trims the required recipe fields", () => {
  assert.deepEqual(parseRecipeInput(validRecipe), {
    title: "Hainanese Chicken Rice",
    ingredients: ["1 whole chicken", "ginger"],
    steps: ["Poach the chicken.", "Cook the rice."],
  });
});

test("rejects a missing required field", () => {
  assert.throws(
    () => parseRecipeInput({ ingredients: ["rice"], steps: ["Cook it."] }),
    /title/i,
  );
});

test("rejects whitespace-only ingredient and step items", () => {
  assert.throws(
    () => parseRecipeInput({ ...validRecipe, ingredients: ["   "] }),
    /ingredient/i,
  );
  assert.throws(
    () => parseRecipeInput({ ...validRecipe, steps: ["\t"] }),
    /step/i,
  );
});

test("strips unknown optional fields instead of inventing data", () => {
  const parsed = parseRecipeInput({ ...validRecipe, nutrition: "unknown" });

  assert.equal("nutrition" in parsed, false);
  assert.equal("servings" in parsed, false);
});
