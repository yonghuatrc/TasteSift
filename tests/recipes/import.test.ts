import assert from "node:assert/strict";
import test from "node:test";

import { extractRecipeFromJsonLd } from "../../lib/recipes/import.ts";
import { fetchRecipePage, validatePublicUrl } from "../../lib/recipes/fetch-page.ts";

const source = "https://recipes.example/chicken";
const recipe = {
  "@type": ["Recipe"],
  name: "Honey &amp; garlic chicken",
  description: "A &lt;quick&gt; dinner &#x27;keeper&#39;.",
  recipeIngredient: ["500 g chicken", "1/3 cup honey"],
  recipeInstructions: [
    { "@type": "HowToSection", name: "Cook", itemListElement: [
      { "@type": "HowToStep", text: "<p>Sear the chicken.</p>" },
      { "@type": "HowToStep", text: "Add honey &amp; simmer." },
    ] },
  ],
  prepTime: "PT4M",
  cookTime: "PT1H8M",
  recipeYield: ["4 servings"],
  recipeCuisine: ["Chinese"],
  recipeCategory: "Main",
  image: { "@type": "ImageObject", url: "/chicken.jpg" },
};

test("extracts a real recipe shape inside a schema graph without losing step order", () => {
  const result = extractRecipeFromJsonLd([JSON.stringify({ "@graph": [{ "@type": "WebPage" }, recipe] })], source);
  assert.equal(result.title, "Honey & garlic chicken");
  assert.equal(result.description, "A <quick> dinner 'keeper'.");
  assert.deepEqual(result.ingredients, ["500 g chicken", "1/3 cup honey"]);
  assert.deepEqual(result.steps, ["Sear the chicken.", "Add honey & simmer."]);
  assert.equal(result.prepMinutes, 4);
  assert.equal(result.cookMinutes, 68);
  assert.equal(result.servings, "4 servings");
  assert.equal(result.cuisine, "Chinese");
  assert.equal(result.dishType, "Main");
  assert.equal(result.imageUrl, "https://recipes.example/chicken.jpg");
  assert.equal(result.sourceUrl, source);
});

test("leaves optional facts absent when the source does not supply them", () => {
  const result = extractRecipeFromJsonLd([JSON.stringify({
    "@type": "Recipe", name: "Toast", recipeIngredient: ["bread"], recipeInstructions: "Toast the bread.",
  })], source);
  assert.equal(result.prepMinutes, undefined);
  assert.equal(result.servings, undefined);
  assert.deepEqual(result.steps, ["Toast the bread."]);
});

test("skips malformed JSON and incomplete recipe objects instead of guessing", () => {
  assert.throws(() => extractRecipeFromJsonLd(["not JSON", JSON.stringify({ "@type": "Recipe", name: "No method" })], source), /完整食谱/);
});

test("rejects private, credential-bearing and non-web URL targets", () => {
  for (const url of ["file:///etc/passwd", "http://localhost/", "https://127.0.0.1/", "https://[::1]/", "https://10.0.0.1/", "https://user:pass@recipes.example/", "https://recipes.example:9999/", "http://my-host/", "https://foo.local/"]) {
    assert.throws(() => validatePublicUrl(url), /公开/);
  }
  assert.equal(validatePublicUrl(source).href, source);
});

test("checks redirect targets before fetching them", async () => {
  const requested: string[] = [];
  await assert.rejects(() => fetchRecipePage(source, async (url) => {
    requested.push(String(url));
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
  }, async () => {}), /公开/);
  assert.deepEqual(requested, [source]);
});

test("returns bounded public HTML and reports blocked pages", async () => {
  const page = await fetchRecipePage(source, async () => new Response("<html>Recipe</html>", { headers: { "content-type": "text/html" } }), async () => {});
  assert.equal(page.html, "<html>Recipe</html>");
  await assert.rejects(() => fetchRecipePage(source, async () => new Response("blocked", { status: 403 }), async () => {}), /读取/);
  await assert.rejects(() => fetchRecipePage(source, async () => new Response("x".repeat(2_000_001), { headers: { "content-type": "text/html" } }), async () => {}), /太大/);
});
