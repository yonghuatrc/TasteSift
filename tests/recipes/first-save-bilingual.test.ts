import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "../helpers/sqlite-d1.ts";
import { createD1RecipeRepository } from "../../lib/recipes/repository.ts";
import { claimNextTranslation, completeTranslation, enqueueTranslation, failTranslation, renewTranslation, translationSnapshot } from "../../lib/recipes/translation-store.ts";
import { createVideoJob, claimVideoJob, getVideoJob, updateVideoJob, preparedTranslationsForSave } from "../../lib/recipes/import-job-store.ts";
import type { RecipeRecord } from "../../lib/recipes/model.ts";

const owner = { userId: "owner", role: "owner" as const };
const editor = { userId: "editor", role: "editor" as const };
const url = "https://www.youtube.com/shorts/M8dLNsKAsrw";
const record: RecipeRecord = { id: "recipe-one", title: "炒饭", description: null, notes: null, ingredients: ["米饭"], steps: ["翻炒"], normalizedSourceUrl: null, createdBy: "owner", createdAt: new Date(), updatedAt: new Date() };
const bilingual = { zh: { title: "炒饭", description: null, notes: null, ingredients: ["米饭"], steps: ["翻炒"] }, en: { title: "Fried rice", description: null, notes: null, ingredients: ["Rice"], steps: ["Stir-fry"] } };
function setup(t: { after: (fn: () => void) => void }) {
  const result = testDatabase(t);
  result.sqlite.exec("INSERT INTO members(user_id,email,role) VALUES ('owner','owner@test','owner'),('editor','editor@test','editor')");
  return { ...result, repository: createD1RecipeRepository(result.db) };
}

test("first save atomically stores both prepared languages without rewriting the original", async (t) => {
  const { db, sqlite, repository } = setup(t);
  await repository.insert(record, bilingual);
  const cache = await translationSnapshot(record, db);
  assert.equal(cache.status, "ready");
  if (cache.status === "ready") assert.equal(cache.translations.en.title, "Fried rice");
  assert.equal(sqlite.prepare("SELECT title FROM recipes").get()?.title, "炒饭");
  assert.equal(await claimNextTranslation(owner, db), null);
});

test("manual first save queues translation before any page is opened", async (t) => {
  const { db, repository } = setup(t);
  await repository.insert(record);
  assert.equal((await translationSnapshot(record, db)).status, "pending");
  const ticket = await claimNextTranslation(owner, db); assert.ok(ticket);
  assert.equal(ticket.recipeId, record.id); assert.equal(ticket.content.title, "炒饭");
  await completeTranslation(record, owner, { ...ticket, translations: bilingual }, db);
  assert.equal((await translationSnapshot(record, db)).status, "ready");
});

test("metadata edits preserve a ready cache while source edits queue a new version", async (t) => {
  const { db, sqlite, repository } = setup(t);
  await repository.insert(record, bilingual);
  const before = sqlite.prepare("SELECT * FROM recipe_translations").get();
  await repository.update({ ...record, imageUrl: "https://example.com/photo.jpg" });
  assert.deepEqual(sqlite.prepare("SELECT * FROM recipe_translations").get(), before);
  const changed = { ...record, title: "新炒饭" }; await repository.update(changed);
  assert.equal((await translationSnapshot(changed, db)).status, "pending");
  assert.ok(await claimNextTranslation(owner, db));
});

test("a cache write failure rolls back the recipe save", async (t) => {
  const { sqlite, repository } = setup(t);
  sqlite.exec("CREATE TRIGGER block_translation BEFORE INSERT ON recipe_translations BEGIN SELECT RAISE(FAIL,'cache blocked'); END");
  await assert.rejects(repository.insert(record, bilingual));
  assert.equal(sqlite.prepare("SELECT count(*) n FROM recipes").get()?.n, 0);
});

test("video and saved-translation work share one atomic Mac slot", async (t) => {
  const { db, repository } = setup(t); await repository.insert(record);
  const id = crypto.randomUUID(); await createVideoJob(id, url, owner, db);
  const video = await claimVideoJob(owner, db); assert.ok(video);
  assert.equal(await claimNextTranslation(owner, db), null);
  await updateVideoJob(id, { action: "complete", token: video.token, recipe: { ...record, sourceUrl: url } }, owner, db);
  const translation = await claimNextTranslation(owner, db); assert.ok(translation);
  await createVideoJob(crypto.randomUUID(), url, owner, db);
  assert.equal(await claimVideoJob(owner, db), null);
  await completeTranslation(record, owner, { ...translation, translations: bilingual }, db);
  assert.ok(await claimVideoJob(owner, db));
});

test("prepared draft translations are private and match only the saved source body", async (t) => {
  const { db } = setup(t);
  const id = crypto.randomUUID(); const recipe = { ...record, sourceUrl: url };
  await createVideoJob(id, url, owner, db); const claim = await claimVideoJob(owner, db); assert.ok(claim);
  await updateVideoJob(id, { action: "complete", token: claim.token, recipe, translations: bilingual }, owner, db);
  assert.deepEqual(await preparedTranslationsForSave(id, { ...recipe, imageUrl: "https://example.com/new.jpg" }, owner, db), bilingual);
  assert.equal(await preparedTranslationsForSave(id, { ...recipe, ingredients: ["米饭 500g"] }, owner, db), undefined);
  await assert.rejects(preparedTranslationsForSave(id, recipe, editor, db), /not available/i);
});

test("expired queued work needs explicit retry and a ready cache never requeues", async (t) => {
  const { db, sqlite, repository } = setup(t); await repository.insert(record);
  sqlite.exec("UPDATE recipe_translations SET updated_at = 0");
  assert.equal((await translationSnapshot(record, db)).status, "failed");
  assert.equal(await claimNextTranslation(owner, db), null);
  assert.equal((await enqueueTranslation(record, owner, false, db)).status, "failed");
  assert.equal((await enqueueTranslation(record, owner, true, db)).status, "pending");
  const claim = await claimNextTranslation(owner, db); assert.ok(claim);
  await completeTranslation(record, owner, { ...claim, translations: bilingual }, db);
  const before = sqlite.prepare("SELECT * FROM recipe_translations").get();
  assert.equal((await enqueueTranslation(record, owner, true, db)).status, "ready");
  assert.deepEqual(sqlite.prepare("SELECT * FROM recipe_translations").get(), before);
});

test("heartbeats and completion reject expired tokens and changed source", async (t) => {
  const { db, sqlite, repository } = setup(t); await repository.insert(record);
  const claim = await claimNextTranslation(owner, db); assert.ok(claim);
  await renewTranslation(record, owner, claim, db);
  await assert.rejects(renewTranslation(record, owner, { ...claim, token: crypto.randomUUID() }, db), /stale/i);
  sqlite.exec("UPDATE recipe_translations SET lease_until = 0");
  await assert.rejects(renewTranslation(record, owner, claim, db), /stale/i);
  await assert.rejects(completeTranslation(record, owner, { ...claim, translations: bilingual }, db), /stale/i);
  await enqueueTranslation(record, owner, true, db);
  const current = await claimNextTranslation(owner, db); assert.ok(current);
  sqlite.exec("UPDATE recipes SET title = 'Changed' WHERE id = 'recipe-one'");
  await assert.rejects(renewTranslation(record, owner, current, db), /stale/i);
});

test("invalid prepared content cannot save a source or replace a private draft", async (t) => {
  const { db, sqlite, repository } = setup(t);
  const invalid = { ...bilingual, en: { ...bilingual.en, steps: [] } };
  await assert.rejects(repository.insert(record, invalid));
  assert.equal(sqlite.prepare("SELECT count(*) n FROM recipes").get()?.n, 0);
  const id = crypto.randomUUID(); await createVideoJob(id, url, owner, db);
  const claim = await claimVideoJob(owner, db); assert.ok(claim);
  await assert.rejects(updateVideoJob(id, { action: "complete", token: claim.token, recipe: { ...record, sourceUrl: url }, translations: invalid }, owner, db));
});

test("editing during translation holds the Mac slot until the old worker releases it", async (t) => {
  const { db, repository } = setup(t); await repository.insert(record);
  const old = await claimNextTranslation(owner, db); assert.ok(old);
  const changed = { ...record, title: "新炒饭" }; await repository.update(changed);
  await createVideoJob(crypto.randomUUID(), url, owner, db);
  assert.equal(await claimVideoJob(owner, db), null);
  assert.equal(await claimNextTranslation(owner, db), null);
  await assert.rejects(completeTranslation(changed, owner, { ...old, translations: bilingual }, db), /stale/i);
  await failTranslation(record.id, owner, old, db);
  assert.equal((await translationSnapshot(changed, db)).status, "pending");
  const current = await claimNextTranslation(owner, db); assert.ok(current);
  assert.equal(current.content.title, changed.title);
  assert.notEqual(current.token, old.token);
  await failTranslation(record.id, owner, old, db);
  assert.equal(await claimVideoJob(owner, db), null);
});

test("a video translation failure is retained as a failed job for explicit retry", async (t) => {
  const { db } = setup(t); const id = crypto.randomUUID();
  await createVideoJob(id, url, owner, db);
  const claim = await claimVideoJob(owner, db); assert.ok(claim);
  await updateVideoJob(id, { action: "fail", token: claim.token, error: "translationFailed" }, owner, db);
  const job = await getVideoJob(id, owner, db);
  assert.equal(job.status, "failed"); assert.equal(job.error, "translationFailed");
  assert.equal(await claimVideoJob(owner, db), null);
});

test("HTML form CRLF conversion reuses prepared text without treating edits as equivalent", async (t) => {
  const { db, repository } = setup(t); const id = crypto.randomUUID();
  const recipe = { ...record, sourceUrl: url, description: "第一行\n第二行", steps: ["翻炒\n盛盘"] };
  const translations = { zh: { ...bilingual.zh, description: recipe.description, steps: recipe.steps }, en: { ...bilingual.en, description: "First line\nSecond line", steps: ["Stir-fry\nServe"] } };
  await createVideoJob(id, url, owner, db); const claim = await claimVideoJob(owner, db); assert.ok(claim);
  await updateVideoJob(id, { action: "complete", token: claim.token, recipe, translations }, owner, db);
  const submitted = { ...recipe, description: "第一行\r\n第二行", steps: ["翻炒\r\n盛盘"] };
  const prepared = await preparedTranslationsForSave(id, submitted, owner, db);
  assert.deepEqual(prepared, translations);
  await repository.insert(submitted, prepared);
  assert.equal((await translationSnapshot(submitted, db)).status, "ready");
  assert.equal(await preparedTranslationsForSave(id, { ...submitted, steps: ["翻炒后盛盘"] }, owner, db), undefined);
});
