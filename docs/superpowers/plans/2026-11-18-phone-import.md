# Phone Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-submitted video URL is processed by the existing Mac helper and returns a persistent unsaved preview to the phone.

**Architecture:** Add one D1 job table with creator-scoped reads and an atomic owner-worker claim/lease. Same-origin APIs connect the homepage to an authenticated Mac processing page; that page alone calls the existing loopback helper. Reuse the existing review/save UI and ordinary page importer.

**Tech Stack:** Existing React/Vinext, D1/Drizzle, browser sign-in and local video helper.

**Spec:** docs/superpowers/specs/2026-11-18-phone-import.md

## Global Constraints

- Native execution, same folder/branch, private Site; no paid services, tunnels, cloud model or persistent worker secrets.
- Submission requires editor/owner, worker writes require owner plus a live claim token; result reads are creator-private.
- Keep preview-before-save, existing recipes and ordinary page imports intact.

## Review Focus

- Concurrent Mac tabs must not claim two jobs or overwrite ready/expired work.
- Refreshes/retries must not create duplicate jobs or rerun an already completed import.
- Phones must never call loopback; source/body/role/origin validation stays at server boundaries.
- Closing or disconnecting the Mac page must yield an actionable failure, not indefinite waiting.
- User edits and pre-existing recipes must remain untouched; receiving a draft is not a save.

### Task 1: Queue through authenticated APIs

**Files:** `db/schema.ts`, new migration, `lib/recipes/import-jobs.ts`, `lib/recipes/import-job-store.ts`, `app/api/video-imports/route.ts`, `app/api/video-imports/claim/route.ts`, `app/api/video-imports/[id]/route.ts`, `tests/recipes/import-job-store.test.ts`.

**Interfaces:** create/get/claim/update job functions take RecipeActor and optional existing Database; snapshots contain id/url/status/stage/error/recipe, never lease tokens. Claim responses alone include token. Updates validate token, state, expiry and source URL.

- [ ] Write failing SQLite tests for creator isolation, idempotence, atomic claims, lease expiry, source/result validation and no recipe inserts.
- [ ] Implement the schema/store/routes and generate one additive migration.
- [ ] Run focused store tests and types; commit the working API deliverable.

### Task 2: Phone client and Mac page

**Files:** `lib/recipes/import-remote.ts`, `lib/recipes/import-local.ts`, `components/recipe-importer.tsx`, `components/mac-import-worker.tsx`, `app/internal/video-worker/page.tsx`, `app/internal/page.tsx`, `components/import-progress.tsx`, `lib/i18n.ts`, client and role tests.

**Interfaces:** createRemoteImport(url) and waitForRemoteImport(id,onSnapshot,signal) use only the Site. The worker serializes heartbeat/progress/completion around importVideoOnMac and allows cancellation. The homepage stores the job ID in its URL, resumes reads after refresh and passes ready data to RecipeReview.

- [ ] Write failing client tests for same-origin requests, completed-draft resume, failures and cancellation.
- [ ] Connect queued import/progress/resume and owner-only Start/Stop Mac processing with current categories.
- [ ] Verify role/CSRF boundaries, full tests/types/build, then one independent change review and necessary RED/GREEN fixes.
- [ ] Publish the same private Site; open/start the Mac page and test a real queued link from a separate browser, including refresh and no auto-save.
