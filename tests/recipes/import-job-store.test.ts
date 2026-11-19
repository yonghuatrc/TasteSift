import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "../helpers/sqlite-d1.ts";
import { createVideoJob, getVideoJob, claimVideoJob, updateVideoJob } from "../../lib/recipes/import-job-store.ts";

const owner = { userId: "owner", role: "owner" as const };
const editor = { userId: "editor", role: "editor" as const };
const viewer = { userId: "viewer", role: "viewer" as const };
const url = "https://www.youtube.com/shorts/M8dLNsKAsrw";
const draft = { title: "排骨", sourceUrl: url, ingredients: ["排骨"], steps: ["蒸熟"] };
function setup(t: { after: (fn: () => void) => void }) {
  const result = testDatabase(t);
  result.sqlite.exec("INSERT INTO members(user_id,email,role) VALUES ('owner','owner@test','owner'),('editor','editor@test','editor'),('viewer','viewer@test','viewer')");
  return result;
}

test("phone jobs are idempotent, creator-private and never save a recipe", async (t) => {
  const { db, sqlite } = setup(t);
  const id = crypto.randomUUID();
  assert.equal((await createVideoJob(id, url, editor, db)).status, "queued");
  assert.equal((await createVideoJob(id, url, editor, db)).id, id);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM video_import_jobs").get()?.n, 1);
  await assert.rejects(getVideoJob(id, owner, db), /not available/i);
  await assert.rejects(createVideoJob(id, "https://youtu.be/abcdefghijk", editor, db), /queueFailed/);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM recipes").get()?.n, 0);
});

test("viewer submissions and non-owner worker claims are rejected before writing", async (t) => {
  const { db, sqlite } = setup(t);
  await assert.rejects(createVideoJob(crypto.randomUUID(), url, viewer, db), /not available/i);
  await assert.rejects(claimVideoJob(editor, db), /not available/i);
  await assert.rejects(createVideoJob(crypto.randomUUID(), "http://127.0.0.1/private", owner, db), /videoUnsupported/);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM video_import_jobs").get()?.n, 0);
});

test("concurrent worker tabs can claim only one active job globally", async (t) => {
  const { db } = setup(t);
  await createVideoJob(crypto.randomUUID(), url, owner, db);
  await createVideoJob(crypto.randomUUID(), "https://youtu.be/abcdefghijk", editor, db);
  const claims = await Promise.all([claimVideoJob(owner, db), claimVideoJob(owner, db), claimVideoJob(owner, db)]);
  assert.equal(claims.filter(Boolean).length, 1);
});

test("live worker progress and result return an unchanged unsaved draft to its creator", async (t) => {
  const { db, sqlite } = setup(t);
  const id = crypto.randomUUID(); await createVideoJob(id, url, editor, db);
  const claim = await claimVideoJob(owner, db); assert.ok(claim);
  await updateVideoJob(id, { action: "progress", token: claim.token, stage: "transcribing" }, owner, db);
  assert.equal((await getVideoJob(id, editor, db)).stage, "transcribing");
  await updateVideoJob(id, { action: "complete", token: claim.token, recipe: draft }, owner, db);
  const ready = await getVideoJob(id, editor, db);
  assert.equal(ready.status, "ready"); assert.deepEqual(ready.recipe, draft);
  assert.equal("token" in ready, false);
  await assert.rejects(updateVideoJob(id, { action: "progress", token: claim.token, stage: "reading" }, owner, db), /workerDisconnected/);
  assert.equal((await getVideoJob(id, editor, db)).status, "ready");
  assert.equal(sqlite.prepare("SELECT count(*) n FROM recipes").get()?.n, 0);
});

test("expired workers cannot complete or overwrite a replacement job", async (t) => {
  const { db, sqlite } = setup(t);
  const id = crypto.randomUUID(); await createVideoJob(id, url, owner, db);
  const old = await claimVideoJob(owner, db); assert.ok(old);
  sqlite.exec("UPDATE video_import_jobs SET lease_until=0");
  const failed = await getVideoJob(id, owner, db);
  assert.equal(failed.status, "failed"); assert.equal(failed.error, "workerDisconnected");
  await assert.rejects(updateVideoJob(id, { action: "complete", token: old.token, recipe: draft }, owner, db), /workerDisconnected/);
  await createVideoJob(crypto.randomUUID(), url, owner, db);
  assert.ok(await claimVideoJob(owner, db));
});

test("wrong tokens, wrong sources and malformed results never publish a draft", async (t) => {
  const { db } = setup(t);
  const id = crypto.randomUUID(); await createVideoJob(id, url, owner, db);
  const claim = await claimVideoJob(owner, db); assert.ok(claim);
  await assert.rejects(updateVideoJob(id, { action: "complete", token: crypto.randomUUID(), recipe: draft }, owner, db), /workerDisconnected/);
  await assert.rejects(updateVideoJob(id, { action: "complete", token: claim.token, recipe: { ...draft, sourceUrl: "https://youtu.be/abcdefghijk" } }, owner, db), /queueFailed/);
  await assert.rejects(updateVideoJob(id, { action: "complete", token: claim.token, recipe: {} }, owner, db));
  assert.equal((await getVideoJob(id, owner, db)).status, "running");
});

test("a stopped worker records failure and queued jobs eventually expire", async (t) => {
  const { db, sqlite } = setup(t);
  const id = crypto.randomUUID(); await createVideoJob(id, url, owner, db);
  const claim = await claimVideoJob(owner, db); assert.ok(claim);
  await updateVideoJob(id, { action: "fail", token: claim.token, error: "noRecipeEvidence" }, owner, db);
  assert.equal((await getVideoJob(id, owner, db)).error, "noRecipeEvidence");
  const queued = crypto.randomUUID(); await createVideoJob(queued, url, owner, db);
  sqlite.exec("UPDATE video_import_jobs SET expires_at=0 WHERE status='queued'");
  assert.equal((await getVideoJob(queued, owner, db)).error, "queueExpired");
  assert.equal(await claimVideoJob(owner, db), null);
});

test("a healthy running job outlives its queue deadline and keeps the global claim", async (t) => {
  const { db, sqlite } = setup(t);
  const id = crypto.randomUUID(); await createVideoJob(id, url, owner, db);
  const claim = await claimVideoJob(owner, db); assert.ok(claim);
  sqlite.exec("UPDATE video_import_jobs SET expires_at=0 WHERE status='running'");
  await createVideoJob(crypto.randomUUID(), url, editor, db);
  assert.equal(await claimVideoJob(owner, db), null);
  assert.equal((await getVideoJob(id, owner, db)).status, "running");
  await updateVideoJob(id, { action: "complete", token: claim.token, recipe: draft }, owner, db);
  assert.equal((await getVideoJob(id, owner, db)).status, "ready");
});

test("only a stored result can publish the ready stage", async (t) => {
  const { db } = setup(t);
  const id = crypto.randomUUID(); await createVideoJob(id, url, owner, db);
  const claim = await claimVideoJob(owner, db); assert.ok(claim);
  await assert.rejects(updateVideoJob(id, { action: "progress", token: claim.token, stage: "ready" }, owner, db));
  assert.equal((await getVideoJob(id, owner, db)).stage, "connecting");
});
