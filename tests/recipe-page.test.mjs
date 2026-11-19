import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { Script } from "node:vm";
import ts from "typescript";
import { getRecipe, RecipeNotFoundError } from "../lib/recipes/service.ts";

const require = createRequire(import.meta.url);
const pageUrl = new URL("../app/recipes/[id]/page.tsx", import.meta.url);
const compiled = ts.transpileModule(readFileSync(pageUrl, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function recipePage(repository, identity = async () => ({ actor: { userId: "owner", role: "owner" } })) {
  const exports = {};
  const imports = {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/navigation": require("next/navigation"),
    "../../../lib/auth/current-member.ts": { requireCurrentMember: identity },
    "../../../lib/recipes/service.ts": {
      getRecipe: (id, actor) => getRecipe(id, actor, repository), RecipeNotFoundError,
    },
    "../../../components/recipe-detail.tsx": {},
    "../actions.ts": {},
    "../../../lib/recipes/category-store.ts": {},
    "../../../lib/recipes/translation-store.ts": {},
  };
  new Script(`(function(exports, require) { ${compiled}\n})`, { filename: pageUrl.pathname })
    .runInThisContext()(exports, (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected page dependency: ${name}`);
      return imports[name];
    });
  return exports.default;
}

test("missing recipes, including removed demo IDs, use the framework's 404 response", async () => {
  const page = recipePage({ get: async () => null });
  for (const id of ["preview", "facebook-preview", "00000000-0000-4000-8000-000000000000"]) {
    await assert.rejects(page({ params: Promise.resolve({ id }) }), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  }
});

test("recipe detail preserves operational database failures", async () => {
  const failure = new Error("Database unavailable");
  const page = recipePage({ get: async () => { throw failure; } });
  await assert.rejects(page({ params: Promise.resolve({ id: "preview" }) }), (error) => error === failure);
});

test("recipe detail authenticates before reading a recipe", async () => {
  const failure = new Error("Sign-in required");
  const page = recipePage({ get: async () => assert.fail("Unauthorized recipe read") }, async () => { throw failure; });
  await assert.rejects(page({ params: Promise.resolve({ id: "preview" }) }), (error) => error === failure);
});
