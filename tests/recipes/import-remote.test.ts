import test from "node:test";
import assert from "node:assert/strict";
import { beginRemoteSubmission, createRemoteImport, waitForRemoteImport } from "../../lib/recipes/import-remote.ts";

const id = "11111111-1111-4111-8111-111111111111";
const url = "https://www.youtube.com/shorts/M8dLNsKAsrw";
const recipe = { title: "排骨", sourceUrl: url, ingredients: ["排骨"], steps: ["蒸熟"] };
const queued = { id, url, status: "queued", stage: "connecting", error: null, recipe: null };

test("a phone submits only to the private website, never its localhost", async () => {
  const job = await createRemoteImport(url, (async (input, options) => {
    assert.equal(input, "/api/video-imports");
    assert.equal(options?.method, "POST");
    const body = JSON.parse(String(options?.body));
    assert.match(body.id, /^[a-f\d-]{36}$/);
    assert.equal(body.url, url);
    return Response.json({ ...queued, id: body.id });
  }) as typeof fetch);
  assert.equal(job.status, "queued");
});

test("reopening a ready job reads its stored preview without starting another import", async () => {
  let calls = 0;
  const result = await waitForRemoteImport(id, () => {}, (async (input, options) => {
    calls++; assert.equal(input, `/api/video-imports/${id}`); assert.equal(options?.method, undefined);
    return Response.json({ ...queued, status: "ready", stage: "ready", recipe });
  }) as typeof fetch);
  assert.deepEqual(result, recipe); assert.equal(calls, 1);
});

test("retrying an interrupted submission preserves its idempotency key", async () => {
  const seen: string[] = [];
  const fetcher = (async (_input, options) => {
    seen.push(JSON.parse(String(options?.body)).id);
    if (seen.length === 1) throw new TypeError("Connection lost after submission");
    return Response.json(queued);
  }) as typeof fetch;
  await assert.rejects(createRemoteImport(url, fetcher, undefined, id));
  await createRemoteImport(url, fetcher, undefined, id);
  assert.deepEqual(seen, [id, id]);
});

test("queued and running progress eventually returns a ready recipe", async () => {
  const states = [queued, { ...queued, status: "running", stage: "organizing" }, { ...queued, status: "ready", stage: "ready", recipe }];
  const seen: string[] = [];
  const result = await waitForRemoteImport(id, (job) => seen.push(job.status), (async () => Response.json(states.shift())) as typeof fetch);
  assert.deepEqual(seen, ["queued", "running", "ready"]);
  assert.equal(result.title, "排骨");
});

test("failed jobs do not silently restart processing", async () => {
  let calls = 0;
  await assert.rejects(waitForRemoteImport(id, () => {}, (async () => { calls++; return Response.json({ ...queued, status: "failed", error: "workerDisconnected" }); }) as typeof fetch), /workerDisconnected/);
  assert.equal(calls, 1);
});

test("cancelling a resumed wait stops before another request", async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(waitForRemoteImport(id, () => {}, (async () => { assert.fail("Must not request"); }) as typeof fetch, controller.signal), (error: unknown) => (error as Error).name === "AbortError");
});

test("retry after failure resets submission state before a lost POST response", () => {
  const state: { status: "failed" | "queued" | null } = { status: "failed" };
  const retry = beginRemoteSubmission(id, state);
  assert.notEqual(retry, id);
  assert.equal(state.status, "queued");
  assert.equal(beginRemoteSubmission(retry, state), retry);
});
