import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "../helpers/sqlite-d1.ts";
import { claimTranslation, completeTranslation, failTranslation, translationSnapshot } from "../../lib/recipes/translation-store.ts";

const source = { id: "one", updatedAt: new Date(1000), title: "蒸排骨", description: null, ingredients: ["排骨 500 克"], steps: ["蒸 15 分钟"], notes: null };
const translated = { zh: { title: source.title, description: null, ingredients: source.ingredients, steps: source.steps, notes: null }, en: { title: "Steamed ribs", description: null, ingredients: ["500 g ribs"], steps: ["Steam for 15 minutes"], notes: null } };
const owner = { role: "owner" as const, userId: "owner" };
function setup(t: { after: (fn: () => void) => void }) {
  const result = testDatabase(t);
  result.sqlite.exec("INSERT INTO members(user_id,email,role) VALUES ('owner','owner@example.test','owner'); INSERT INTO recipes(id,title,ingredients_json,steps_json,created_by,updated_at) VALUES ('one','蒸排骨','[\"排骨 500 克\"]','[\"蒸 15 分钟\"]','owner',1000)");
  return result;
}

test("a source revision gets one translation claim and repeated reads use the cache", async (t) => {
  const { db } = setup(t);
  const ticket = await claimTranslation(source, owner, false, db);
  assert.equal(ticket.status, "claimed");
  if (ticket.status !== "claimed") return;
  assert.equal((await claimTranslation(source, owner, false, db)).status, "pending");
  const content = { zh: { title: source.title, description: null, ingredients: source.ingredients, steps: source.steps, notes: null }, en: translated.en };
  await completeTranslation(source, owner, { ...ticket, translations: content }, db);
  const cached = await claimTranslation(source, owner, false, db);
  assert.equal(cached.status, "ready");
  if (cached.status === "ready") assert.equal(cached.translations.en.title, "Steamed ribs");
  assert.equal((await translationSnapshot({ ...source, imageUrl: "https://example.com/new.jpg" }, db)).status, "ready");
});

test("edited text invalidates translation and an old claim cannot overwrite the new revision", async (t) => {
  const { db, sqlite } = setup(t);
  const old = await claimTranslation(source, owner, false, db);
  assert.equal(old.status, "claimed");
  if (old.status !== "claimed") return;
  const changed = { ...source, title: "新蒸排骨", updatedAt: new Date(2000) };
  sqlite.exec("UPDATE recipes SET title = '新蒸排骨', updated_at = 2000 WHERE id = 'one'");
  assert.equal((await translationSnapshot(changed, db)).status, "missing");
  const current = await claimTranslation(changed, owner, false, db);
  assert.equal(current.status, "claimed");
  await assert.rejects(completeTranslation(changed, owner, { ...old, translations: translated }, db), /changed|stale/i);
});

test("failed jobs do not restart on language switches without explicit retry", async (t) => {
  const { db } = setup(t);
  const ticket = await claimTranslation(source, owner, false, db);
  if (ticket.status !== "claimed") throw new Error("Expected claim");
  await failTranslation(source.id, owner, ticket, db);
  assert.equal((await claimTranslation(source, owner, false, db)).status, "failed");
  assert.equal((await claimTranslation(source, owner, true, db)).status, "claimed");
});

test("viewers cannot generate or write translated content", async (t) => {
  const { db, sqlite } = setup(t);
  await assert.rejects(claimTranslation(source, { role: "viewer", userId: "viewer" }, false, db), /not available/i);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM recipe_translations").get()?.count, 0);
});

test("simultaneous translation requests issue only one active claim", async (t) => {
  const { db } = setup(t);
  const results = await Promise.all([claimTranslation(source, owner, false, db), claimTranslation(source, owner, false, db), claimTranslation(source, owner, false, db)]);
  assert.equal(results.filter((result) => result.status === "claimed").length, 1);
  assert.equal(results.filter((result) => result.status === "pending").length, 2);
});

test("an expired claim cannot overwrite a replacement claim for the same text", async (t) => {
  const { db, sqlite } = setup(t);
  const old = await claimTranslation(source, owner, false, db);
  if (old.status !== "claimed") throw new Error("Expected claim");
  sqlite.exec("UPDATE recipe_translations SET lease_until = 0");
  const current = await claimTranslation(source, owner, false, db);
  assert.equal(current.status, "claimed");
  await assert.rejects(completeTranslation(source, owner, { ...old, translations: translated }, db), /stale/i);
});

test("a delayed old request cannot replace a newer ready translation", async (t) => {
  const { db, sqlite } = setup(t);
  const newer = { ...source, title: "新蒸排骨", updatedAt: new Date(2000) };
  sqlite.exec("UPDATE recipes SET title = '新蒸排骨', updated_at = 2000 WHERE id = 'one'");
  const ticket = await claimTranslation(newer, owner, false, db);
  if (ticket.status !== "claimed") throw new Error("Expected claim");
  await completeTranslation(newer, owner, { ...ticket, translations: { zh: { ...translated.zh, title: newer.title }, en: { ...translated.en, title: "New steamed ribs" } } }, db);
  await assert.rejects(claimTranslation(source, owner, false, db), /changed|stale/i);
  assert.equal((await translationSnapshot(newer, db)).status, "ready");
});

test("completion checks the persisted recipe version atomically", async (t) => {
  const { db, sqlite } = setup(t);
  const ticket = await claimTranslation(source, owner, false, db);
  if (ticket.status !== "claimed") throw new Error("Expected claim");
  sqlite.exec("UPDATE recipes SET title = 'Changed while PUT was waiting', updated_at = 2000 WHERE id = 'one'");
  await assert.rejects(completeTranslation(source, owner, { ...ticket, translations: translated }, db), /changed|stale/i);
});
