// Run with the loopback development server running; modifies only its mock user.
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const command = ["--import", "./scripts/sites-env.mjs", "./node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--config", "dist/server/wrangler.json", "--persist-to", ".wrangler/state", "--json", "--command"];
function query(sql) {
  return JSON.parse(execFileSync(process.execPath, [...command, sql], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
}
function role(value) { query(`UPDATE members SET role = '${value}' WHERE user_id = 'local_seedy' AND email = 'seedy@sites.test'`); }
const previous = query("SELECT role FROM members WHERE user_id = 'local_seedy' AND email = 'seedy@sites.test'")[0]?.results?.[0]?.role;
assert.ok(["owner", "editor", "viewer"].includes(previous), "Local mock user must already exist");
const headers = { cookie: "__sites_local_auth=1", origin: "http://localhost:5173" };
try {
  role("viewer");
  assert.equal((await fetch("http://localhost:5173/api/categories", { headers })).status, 200);
  assert.equal((await fetch("http://localhost:5173/api/categories", { method: "POST", headers })).status, 403);
  assert.equal((await fetch("http://localhost:5173/api/recipe-images", { method: "POST", headers })).status, 403);
  assert.equal((await fetch("http://localhost:5173/api/video-imports", { method: "POST", headers })).status, 403);
  assert.equal((await fetch("http://localhost:5173/api/video-imports/claim", { method: "POST", headers })).status, 403);
  assert.equal((await fetch("http://localhost:5173/api/mac-tasks/claim", { method: "POST", headers })).status, 403);
  assert.equal((await fetch("http://localhost:5173/api/video-imports/00000000-0000-4000-8000-000000000000", { method: "PATCH", headers })).status, 403);
  const recipeId = query("SELECT id FROM recipes LIMIT 1")[0]?.results?.[0]?.id;
  if (recipeId) {
    const endpoint = `http://localhost:5173/api/recipes/${encodeURIComponent(recipeId)}/translations`;
    assert.equal((await fetch(endpoint, { headers })).status, 200);
    for (const method of ["POST", "PUT", "PATCH"]) assert.equal((await fetch(endpoint, { method, headers })).status, 403);
  }
  for (const path of ["/internal", "/internal/video-worker", "/recipes/facebook-preview", "/recipes/preview"]) assert.equal((await fetch(`http://localhost:5173${path}`, { headers })).status, 404);
  role("editor");
  assert.equal((await fetch("http://localhost:5173/api/mac-tasks/claim", { method: "POST", headers })).status, 403);
  if (recipeId) for (const method of ["PUT", "PATCH"]) assert.equal((await fetch(`http://localhost:5173/api/recipes/${recipeId}/translations`, { method, headers })).status, 403);
  role("owner");
  for (const path of ["/recipes/facebook-preview", "/recipes/preview"]) assert.equal((await fetch(`http://localhost:5173${path}`, { headers })).status, 404);
  assert.equal((await fetch("http://localhost:5173/api/video-imports", { method: "POST", headers: { ...headers, origin: "https://unrelated.test" } })).status, 403);
  assert.equal((await fetch("http://localhost:5173/api/video-imports/claim", { method: "POST", headers: { ...headers, origin: "https://unrelated.test" } })).status, 403);
  assert.equal((await fetch("http://localhost:5173/api/mac-tasks/claim", { method: "POST", headers: { ...headers, origin: "https://unrelated.test" } })).status, 403);
  assert.equal((await fetch("http://localhost:5173/api/mac-tasks/claim", { method: "POST" })).status, 401);
  assert.equal((await fetch("http://localhost:5173/api/recipe-images/00000000-0000-0000-0000-000000000000.jpg")).status, 401);
  console.log("Viewer reads allowed; category/upload writes and internal pages denied.");
} finally { role(previous); console.log("Restored the local mock user's original role."); }
