import test from "node:test";
import assert from "node:assert/strict";
import { observeRecipeTranslation, translateSavedRecipe } from "../../lib/recipes/translation-client.ts";

test("a saved bilingual cache is read without contacting the Mac or model", async () => {
  const calls: string[] = [];
  const fetcher = (async (url) => {
    calls.push(String(url));
    return Response.json({ status: "ready", sourceHash: "hash", translations: { zh: { title: "饭", description: null, ingredients: ["米"], steps: ["煮"], notes: null }, en: { title: "Rice", description: null, ingredients: ["Rice"], steps: ["Cook"], notes: null } } });
  }) as typeof fetch;
  assert.equal((await translateSavedRecipe("one", "hash", {}, fetcher)).status, "ready");
  assert.deepEqual(calls, ["/api/recipes/one/translations"]);
});

test("a phone waits on a pending task using only stored website reads", async () => {
  let calls = 0;
  const fetcher = (async (url, options) => {
    calls++; assert.equal(url, "/api/recipes/one/translations"); assert.equal(options?.method, undefined);
    return Response.json(calls === 1 ? { status: "pending", sourceHash: "hash" } : { status: "ready", sourceHash: "hash", translations: {} });
  }) as typeof fetch;
  assert.equal((await translateSavedRecipe("one", "hash", {}, fetcher)).status, "ready");
  assert.equal(calls, 2);
});

test("missing content is enqueued once on the website without a phone-local helper call", async () => {
  const methods: string[] = [];
  const fetcher = (async (url, options) => {
    assert.equal(url, "/api/recipes/one/translations"); methods.push(options?.method || "GET");
    return Response.json(methods.length === 1 ? { status: "missing", sourceHash: "hash" } : methods.length === 2 ? { status: "pending", sourceHash: "hash" } : { status: "ready", sourceHash: "hash", translations: {} });
  }) as typeof fetch;
  assert.equal((await translateSavedRecipe("one", "hash", {}, fetcher)).status, "ready");
  assert.deepEqual(methods, ["GET", "POST", "GET"]);
});

test("failed translation does not retry when the display language changes", async () => {
  let calls = 0;
  await assert.rejects(translateSavedRecipe("one", "hash", {}, (async (_url, options) => { calls++; assert.equal(options?.method, undefined); return Response.json({ status: "failed", sourceHash: "hash" }); }) as typeof fetch), /translationFailed/);
  assert.equal(calls, 1);
});

test("a viewer observes missing and failed content through backfill using GET only", async () => {
  const observed: string[] = [];
  const states = ["missing", "failed", "pending", "ready"];
  const fetcher = (async (url, options) => {
    assert.equal(url, "/api/recipes/one/translations"); assert.equal(options?.method, undefined);
    return Response.json({ status: states.shift(), sourceHash: "hash", translations: {} });
  }) as typeof fetch;
  await observeRecipeTranslation("one", (snapshot) => observed.push(snapshot.status), undefined, fetcher);
  assert.deepEqual(observed, ["missing", "failed", "pending", "ready"]);
});

test("a failed status read does not become a failed translation or trigger an update", async () => {
  let calls = 0; const observed: string[] = [];
  await observeRecipeTranslation("one", (snapshot) => observed.push(snapshot.status), undefined, (async () => {
    calls++;
    return calls === 1 ? new Response(null, { status: 503 }) : Response.json({ status: "ready", sourceHash: "hash", translations: {} });
  }) as typeof fetch);
  assert.deepEqual(observed, ["ready"]); assert.equal(calls, 2);
});
