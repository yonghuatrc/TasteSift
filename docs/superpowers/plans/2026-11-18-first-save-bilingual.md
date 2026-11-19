# First-save Bilingual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare and persist both recipe languages during import/first save, with automatic Mac processing for saved source changes.

**Architecture:** Extend existing cache persistence and owner Mac task dispatch. Store prepared display content with private import drafts, reuse it after server-side body comparison, and use pending cache rows for other saves. Language switches read stored data.

**Tech Stack:** Existing React/Vinext, D1/Drizzle, local Qwen and authenticated Mac page.

**Spec:** docs/superpowers/specs/2026-11-18-first-save-bilingual.md

## Global Constraints

- Continue inline in the same checkout; the user already requested implementation.
- No new model/provider, sharing, credential, canonical production test record or original-body rewrite.
- Reuse existing source hashes, validation, leases and private job access. First save must persist cache/job atomically with the recipe.

## Review Focus

- A pretranslated draft must not attach stale text after user edits or cross-user job access.
- Video and translation claims must share one global worker slot across multiple tabs.
- Failed/expired work must require explicit retry; ready language toggles must never enqueue a model.
- Old ready video jobs and old Mac clients must remain readable/usable during rollout.
- Homepage and detail must update completed translations without repeated model calls.

### Task 1: Atomic save and shared translation dispatch

**Files:** translation store/client, recipe repository/service/actions, import job store/protocol, shared Mac claim endpoint and tests.

- [x] Write RED tests for first-save ready cache/queued cache, atomic rollback, source changes, prepared draft ownership, cross-task claims and same-origin translation polling.
- [x] Implement atomic persistence and queue states using existing tables. Add owner-only shared claim/translation heartbeat, preserving source/role guards.
- [x] Verify store/client tests and types.

### Task 2: Prepared previews and automatic display

**Files:** Mac processor/helper, review/form, homepage/detail refresh, translations and operating notes.

- [x] Prepare bilingual video drafts on the Mac; carry only validated prepared data to the private job and use its ID during save.
- [x] Poll stored translation progress on the homepage/detail and reuse ready caches across language changes.
- [x] Run local first-save integration, full tests/types/build and one independent review; fix important findings with regression coverage.
- [ ] Publish privately, refresh/start the Mac page, backfill missing saved caches and verify phone-facing toggles without changing originals.

## Execution record

- Store/client tests cover atomic first-save ready/queued caches, rollback, draft ownership/source matching, cross-task claims, explicit retry, heartbeat/stale rejection and cached same-origin reads.
- Helper cancellation regression: baseline fails with an unaborted translation model; shared local serialization and signal propagation make both cancellation cases pass.
- Full unit suite: 167/167; TypeScript and Sites production build pass. Local role/Origin checks pass for the shared claim route and owner-only result writes.
- Live local integration and final review are in progress; publication and production backfill remain pending.

- Final review fixes: translation errors now fail video jobs instead of silently retrying on save; source edits retain active translation leases until cancellation/release; read-only observers follow missing/failed/pending states through completion. All three have regression coverage (RED then GREEN). Status read failures no longer fabricate failed states or refresh routes.
- Browser integration found HTML form LF-to-CRLF conversion causing unnecessary translation. Prepared-draft comparison now normalizes equivalent line endings only; global content hashes and saved originals are unchanged. Regression observed RED/GREEN and actual multi-line browser save now immediately reports ready.
- Real local Facebook preview switches Chinese/English; first save is ready with Mac page stopped. Manual English first save queued and automatically produced Chinese. Repeated language switches/reload preserved all three checked cache hashes and timestamps.
- Final full suite: 172/172, TypeScript and Sites production build pass. No review findings deferred. Publishing/backfill pending.
