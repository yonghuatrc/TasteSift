import assert from "node:assert/strict";
import test from "node:test";

import {
  controlsForRole,
  recipeViewModel,
  validateRecipeDraft,
} from "../../lib/recipes/view-model.ts";
import type { RecipeRecord } from "../../lib/recipes/model.ts";

const recipe: RecipeRecord = {
  id: "recipe-1",
  title: "Laksa",
  ingredients: ["paste", "coconut milk", "noodles"],
  steps: ["Fry paste", "Add coconut milk", "Add noodles"],
  normalizedSourceUrl: null,
  createdBy: "owner",
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

test("unknown optional facts render explicitly as Unknown", () => {
  const view = recipeViewModel(recipe);

  assert.equal(view.servings, "Unknown");
  assert.equal(view.prepTime, "Unknown");
  assert.equal(view.cookTime, "Unknown");
  assert.equal(view.cuisine, "Unknown");
  assert.equal(view.dishType, "Unknown");
});

test("view models preserve ingredient and step order", () => {
  const view = recipeViewModel(recipe);

  assert.deepEqual(view.ingredients, recipe.ingredients);
  assert.deepEqual(view.steps, recipe.steps);
});

test("validation errors map to exact form fields", () => {
  const result = validateRecipeDraft({
    title: " ",
    ingredients: [""],
    steps: [],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.errors.title);
    assert.ok(result.errors["ingredients.0"]);
    assert.ok(result.errors.steps);
  }
});

test("controls follow viewer, editor, and owner permissions", () => {
  assert.deepEqual(controlsForRole("viewer"), {
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageFamily: false,
  });
  assert.deepEqual(controlsForRole("editor"), {
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canManageFamily: false,
  });
  assert.deepEqual(controlsForRole("owner"), {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageFamily: true,
  });
});

test("malformed source and image URLs return field errors without throwing", () => {
  for (const field of ["sourceUrl", "imageUrl"]) {
    for (const value of ["https://", "not a url"]) {
      const result = validateRecipeDraft({ ...recipe, [field]: value });
      assert.equal(result.success, false);
      if (!result.success) assert.ok(result.errors[field]);
    }
  }
});
