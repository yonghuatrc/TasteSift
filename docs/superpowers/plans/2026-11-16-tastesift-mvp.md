# TasteSift MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and privately deploy a responsive family recipe library that stores normalized recipes, enforces owner/editor/viewer permissions, and exposes authenticated ChatGPT tools for recipe lookup and saving.

**Architecture:** Use the Sites Vinext starter as a server-backed Next.js application on Cloudflare Workers. D1 owns members and recipes; server helpers own validation and role checks; pages and route handlers call those helpers rather than duplicating rules. The Site MCP endpoint reuses the same recipe service and authenticated Site identity as the web UI.

**Tech Stack:** TypeScript, Next.js 16/Vinext, React 19, Tailwind CSS, Drizzle ORM with Cloudflare D1, Zod, Node 22 built-in test runner, Sites authentication, MCP JSON-RPC 2026-07-28.

**Spec:** `docs/superpowers/specs/2026-11-16-family-recipe-library-design.md`

## Global Constraints

- The Site remains private and uses Sites-hosted authentication; do not add a separate OAuth or session stack.
- Owner can view, add, edit, delete, and manage roles; editor can view, add, and edit; viewer is read-only.
- Family admission is handled by the Site's private sharing controls; an authenticated first visit creates an app membership as viewer, and the owner may then promote that member to editor.
- Required recipe fields are title, at least one ingredient, and at least one ordered step.
- Unknown servings, times, quantities, and other optional facts remain null or explicit text; never invent defaults.
- Search covers title and ingredients; filters cover cuisine and dish type.
- Duplicate normalized source URLs are rejected before insert.
- The original URL and platform remain attached to imported recipes.
- ChatGPT extraction and user review occur before calling the Site write tool; the Site stores only the approved normalized payload.
- No shopping, nutrition, meal planning, ratings, comments, social feed, or native mobile app in this plan.

## Review Focus

- A malformed or non-HTTP source URL must fail validation without discarding the rest of a web form.
- Two syntactically different URLs that normalize to the same source must trigger the duplicate rule.
- A caller with no membership or viewer role must not learn private data through write or member-management errors.
- Empty, whitespace-only ingredients or steps must not satisfy required-field validation.
- Search and filters containing `%`, `_`, apostrophes, or non-Latin text must be parameterized and behave as literal user input.

---

### Task 1: Runnable Site foundation and recipe domain model

**Files:**
- Create: starter files produced by `scripts/project-setup.mjs`
- Modify: `package.json`
- Modify: `.openai/hosting.json`
- Modify: `db/schema.ts`
- Create: `lib/recipes/model.ts`
- Create: `lib/recipes/source-url.ts`
- Test: `tests/recipes/model.test.ts`
- Test: `tests/recipes/source-url.test.ts`
- Create: generated `drizzle/*` migration files

**Interfaces:**
- Produces: `RecipeInput`, `RecipeRecord`, `parseRecipeInput(value)`, and `normalizeSourceUrl(value: string): string`.
- Produces D1 tables `members` and `recipes`; `recipes.ingredientsJson` and `recipes.stepsJson` preserve ordered arrays.

- [ ] **Step 1: Scaffold the Vinext starter and initialize Git**

Run the Sites `project-setup.mjs` against the existing project directory, preserve `docs/`, then initialize a repository if none exists.

- [ ] **Step 2: Add the built-in test command**

Set `test` to `node --experimental-strip-types --test tests/**/*.test.ts`; do not add a test framework dependency.

- [ ] **Step 3: Write failing validation and URL-normalization tests**

Cover required fields, whitespace-only list items, unknown optional fields remaining absent, HTTP/HTTPS enforcement, tracking-parameter removal, fragment removal, stable query ordering, and two equivalent URLs normalizing identically.

- [ ] **Step 4: Run the focused tests and confirm failure**

Run: `npm test -- tests/recipes/model.test.ts tests/recipes/source-url.test.ts`
Expected: FAIL because `parseRecipeInput` and `normalizeSourceUrl` do not exist.

- [ ] **Step 5: Implement the recipe types, Zod validator, and URL normalizer**

Use strings for ingredient lines and ordered step lines. Normalize protocol/host casing, remove fragments and common tracking parameters, and retain meaningful query parameters.

- [ ] **Step 6: Define the D1 schema and generate the migration**

Create `members(userId, email, displayName, role, createdAt, updatedAt)` and `recipes(id, title, description, sourceUrl, normalizedSourceUrl, sourcePlatform, imageUrl, servings, prepMinutes, cookMinutes, cuisine, dishType, ingredientsJson, stepsJson, notes, createdBy, createdAt, updatedAt)` with a unique normalized source URL when present.

- [ ] **Step 7: Run tests, generate migration, and build**

Run: `npm test && npm run db:generate && npm run build`
Expected: all tests PASS, one migration is generated, and the production build exits 0.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: establish TasteSift recipe model"
```

### Task 2: Identity bootstrap, membership, and authorization

**Files:**
- Create: `lib/auth/roles.ts`
- Create: `lib/auth/membership.ts`
- Create: `lib/auth/permissions.ts`
- Create: `app/api/bootstrap/route.ts`
- Test: `tests/auth/permissions.test.ts`
- Test: `tests/auth/bootstrap.test.ts`

**Interfaces:**
- Consumes: Sites identity from `app/chatgpt-auth.ts` and the `members` table.
- Produces: `Role = "owner" | "editor" | "viewer"`, `requireMember()`, `requireEditor()`, `requireOwner()`, `bootstrapMembership(identity, memberCount)`, and `can(role, action)`.

- [ ] **Step 1: Write failing permission-matrix tests**

Assert owner allows `read/create/update/delete/manage_members`, editor allows `read/create/update`, viewer allows only `read`, and missing membership allows nothing.

- [ ] **Step 2: Write failing bootstrap tests**

Assert the first authenticated user in an owner-private fresh Site becomes owner, later authenticated users become viewers, and an existing user keeps the stored role.

- [ ] **Step 3: Run tests and confirm failure**

Run: `npm test -- tests/auth/permissions.test.ts tests/auth/bootstrap.test.ts`
Expected: FAIL because the role helpers do not exist.

- [ ] **Step 4: Implement role and bootstrap policy**

Keep policy pure in `permissions.ts`; keep D1 identity lookup and membership creation in `membership.ts`. API and page callers must not accept user IDs or roles from request bodies.

- [ ] **Step 5: Implement authenticated bootstrap route**

Reject missing Site identity. Use one D1 transaction or atomic insert path so concurrent first visits cannot create two owners.

- [ ] **Step 6: Run focused tests and build**

Run: `npm test -- tests/auth/*.test.ts && npm run build`
Expected: all tests PASS and build exits 0.

- [ ] **Step 7: Commit**

```bash
git add lib/auth app/api/bootstrap tests/auth
git commit -m "feat: enforce TasteSift family roles"
```

### Task 3: Recipe repository and query service

**Files:**
- Create: `lib/recipes/repository.ts`
- Create: `lib/recipes/service.ts`
- Create: `lib/recipes/search.ts`
- Test: `tests/recipes/service.test.ts`
- Test: `tests/recipes/search.test.ts`

**Interfaces:**
- Consumes: `RecipeInput`, URL normalization, D1 schema, and `requireMember/requireEditor/requireOwner`.
- Produces: `listRecipes(query)`, `getRecipe(id)`, `createRecipe(input, actor)`, `updateRecipe(id, input, actor)`, `deleteRecipe(id, actor)`, and `findDuplicateSource(url)`.

- [ ] **Step 1: Write failing service tests**

Cover owner/editor create and update, owner-only delete, viewer rejection, duplicate source rejection, missing-member privacy, and JSON round-trip preserving ingredient and step order.

- [ ] **Step 2: Write failing search tests**

Cover title and ingredient matches, combined cuisine/dish-type filters, literal wildcard characters, apostrophes, and Chinese search text.

- [ ] **Step 3: Run tests and confirm failure**

Run: `npm test -- tests/recipes/service.test.ts tests/recipes/search.test.ts`
Expected: FAIL because repository and service functions do not exist.

- [ ] **Step 4: Implement parameterized repository queries**

Keep SQL/Drizzle access in `repository.ts`; escape LIKE wildcard characters before parameter binding.

- [ ] **Step 5: Implement service invariants**

Validate before writes, normalize sources before duplicate checks, authorize before revealing whether a private record exists, and serialize arrays only at the repository boundary.

- [ ] **Step 6: Run focused tests and build**

Run: `npm test -- tests/recipes/*.test.ts && npm run build`
Expected: all tests PASS and build exits 0.

- [ ] **Step 7: Commit**

```bash
git add lib/recipes tests/recipes
git commit -m "feat: add authorized recipe service"
```

### Task 4: Mobile-first library, detail, and recipe editing

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/page.tsx`
- Create: `app/recipes/[id]/page.tsx`
- Create: `app/recipes/new/page.tsx`
- Create: `app/recipes/[id]/edit/page.tsx`
- Create: `app/recipes/actions.ts`
- Create: `components/recipe-card.tsx`
- Create: `components/recipe-filters.tsx`
- Create: `components/recipe-form.tsx`
- Create: `components/recipe-detail.tsx`
- Create: `components/empty-state.tsx`
- Test: `tests/ui/recipe-view-model.test.ts`

**Interfaces:**
- Consumes: recipe service functions and authenticated membership.
- Produces: responsive library, detail, new, and edit routes; server actions preserve submitted values when validation fails.

- [ ] **Step 1: Write failing view-model tests**

Assert unknown optional fields render as `Unknown`, ordered ingredients and steps remain ordered, validation maps errors to exact fields, and viewer/editor/owner controls match the permission matrix.

- [ ] **Step 2: Run the UI-focused tests and confirm failure**

Run: `npm test -- tests/ui/recipe-view-model.test.ts`
Expected: FAIL because the view-model helpers do not exist.

- [ ] **Step 3: Implement the library and filtering experience**

Use URL search parameters for query, cuisine, and dish type so filtered views are linkable and work without browser-local state.

- [ ] **Step 4: Implement detail and role-aware controls**

Display source attribution, known metadata, explicit unknowns, ingredients, steps, and notes. Keep delete owner-only and confirmation-gated.

- [ ] **Step 5: Implement add/edit forms and server actions**

Use dynamic ingredient and step rows; preserve entered values and show field-specific messages on validation failure.

- [ ] **Step 6: Apply the TasteSift visual direction**

Use a modern AI-native but food-warm system: high-contrast typography, restrained green/coral accents, generous card imagery, 44px minimum touch targets, visible focus states, and no decorative animation required for MVP.

- [ ] **Step 7: Run tests and build**

Run: `npm test && npm run build`
Expected: all tests PASS and build exits 0.

- [ ] **Step 8: Commit**

```bash
git add app components tests/ui
git commit -m "feat: build responsive TasteSift library"
```

### Task 5: Member role management

**Files:**
- Create: `app/family/page.tsx`
- Create: `app/family/actions.ts`
- Create: `components/member-list.tsx`
- Test: `tests/auth/member-management.test.ts`

**Interfaces:**
- Consumes: membership table, Site identity, and `requireOwner()`.
- Produces: `listMembers(actor)`, `changeMemberRole(targetUserId, role, actor)`, and an owner-only family page.

- [ ] **Step 1: Write failing member-management tests**

Assert only owner can list/change roles, target role is limited to viewer/editor, owner cannot demote themselves, and errors do not expose member data to non-owners.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- tests/auth/member-management.test.ts`
Expected: FAIL because the management functions do not exist.

- [ ] **Step 3: Implement member repository functions and owner-only actions**

Keep Sites sharing/invitations outside the app; this page manages app roles for authenticated family members who have already visited.

- [ ] **Step 4: Implement the family page**

Explain the two-step flow: share the private Site, then promote the new viewer if editing is desired.

- [ ] **Step 5: Run tests and build**

Run: `npm test -- tests/auth/*.test.ts && npm run build`
Expected: all tests PASS and build exits 0.

- [ ] **Step 6: Commit**

```bash
git add app/family components/member-list.tsx lib/auth tests/auth
git commit -m "feat: add owner-managed family roles"
```

### Task 6: Authenticated Site MCP tools

**Files:**
- Create: `app/mcp/route.ts`
- Create: `lib/mcp/protocol.ts`
- Create: `lib/mcp/tools.ts`
- Modify: `.openai/hosting.json`
- Test: `tests/mcp/protocol.test.ts`
- Test: `tests/mcp/tools.test.ts`

**Interfaces:**
- Consumes: Site identity and recipe service.
- Produces: MCP `server/discover`, `tools/list`, and `tools/call`; tools `search_recipes` and `save_recipe`.

- [ ] **Step 1: Write failing protocol tests**

Assert MCP 2026-07-28 discovery, tool schemas, JSON-RPC IDs, unknown-method errors, malformed argument errors, and `isError: true` tool failures.

- [ ] **Step 2: Write failing tool tests**

Assert authenticated members can search, owner/editor can save, viewer cannot save, duplicate sources return the existing recipe reference, and missing membership reveals no private data.

- [ ] **Step 3: Run tests and confirm failure**

Run: `npm test -- tests/mcp/*.test.ts`
Expected: FAIL because MCP protocol and tools do not exist.

- [ ] **Step 4: Implement the stateless MCP endpoint**

Use the caller identity forwarded by Sites. The `save_recipe` description must state that the calling assistant presents the extracted recipe and gets user approval before invocation.

- [ ] **Step 5: Declare the MCP capability**

Add `"mcp"` to `.openai/hosting.json` without changing the Site audience.

- [ ] **Step 6: Run tests and build**

Run: `npm test -- tests/mcp/*.test.ts && npm run build`
Expected: all tests PASS and build exits 0.

- [ ] **Step 7: Commit**

```bash
git add app/mcp lib/mcp .openai/hosting.json tests/mcp
git commit -m "feat: expose TasteSift recipe tools"
```

### Task 7: Private deployment and end-to-end acceptance

**Files:**
- Modify: `README.md`
- Modify: `.openai/hosting.json`
- Create: `docs/operations.md`

**Interfaces:**
- Consumes: completed web app, migration, hosting manifest, and MCP endpoint.
- Produces: privately deployed TasteSift URL, connected Site plugin, and verified owner workflow.

- [ ] **Step 1: Register one new private Site and persist its project ID**

Use the Sites creation workflow exactly once. Keep D1 enabled, R2 null, MCP declared, and the Site owner-private.

- [ ] **Step 2: Run complete automated verification**

Run: `npm test && npm run build`
Expected: all tests PASS and production build exits 0.

- [ ] **Step 3: Run local browser acceptance**

Verify at desktop and 390px-wide mobile viewport: sign-in boundary, library, query and filters, detail, validation preservation, role-based controls, and keyboard focus visibility.

- [ ] **Step 4: Package, save, and deploy the exact pushed commit**

Use the Sites source workflow, confirm the deployment reaches `succeeded`, and retain the production URL and version ID.

- [ ] **Step 5: Initialize the owner and verify roles**

Open the private Site as Dennis, confirm the first membership is owner, then verify a viewer receives read-only behavior and cannot call writes directly.

- [ ] **Step 6: Verify MCP end-to-end**

Connect the Site plugin, call `search_recipes`, obtain approval for one known sample, call `save_recipe`, and verify the recipe appears on the website without field loss.

- [ ] **Step 7: Document operations and limitations**

Record sharing, viewer-to-editor promotion, source-extraction fallback, backup/export considerations, and the rule that trademark/domain clearance is still required before commercial launch.

- [ ] **Step 8: Final commit**

```bash
git add README.md docs/operations.md .openai/hosting.json
git commit -m "docs: add TasteSift deployment operations"
```

