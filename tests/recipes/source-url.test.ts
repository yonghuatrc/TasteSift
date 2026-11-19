import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSourceUrl } from "../../lib/recipes/source-url.ts";

test("accepts only HTTP and HTTPS source URLs", () => {
  assert.throws(() => normalizeSourceUrl("not a url"), /valid HTTP/i);
  assert.throws(() => normalizeSourceUrl("ftp://example.com/recipe"), /valid HTTP/i);
});

test("removes fragments and common tracking parameters", () => {
  assert.equal(
    normalizeSourceUrl(
      "https://Example.COM/recipe?utm_source=facebook&lang=en&fbclid=abc#method",
    ),
    "https://example.com/recipe?lang=en",
  );
});

test("sorts meaningful query parameters stably", () => {
  assert.equal(
    normalizeSourceUrl("HTTPS://EXAMPLE.COM/recipe?z=2&a=3&a=1"),
    "https://example.com/recipe?a=1&a=3&z=2",
  );
});

test("normalizes equivalent source URLs identically", () => {
  const shared = "https://example.com/watch?id=42";

  assert.equal(
    normalizeSourceUrl("https://EXAMPLE.com/watch?utm_medium=social&id=42#comments"),
    normalizeSourceUrl(shared),
  );
});
