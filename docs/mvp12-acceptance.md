# TasteSift MVP 1.2 validation

## Delivered scope

- Instant browser-side title/ingredient search was published first. Typing 干蒸 immediately reduces the live shelf to 干蒸排骨 without Enter, LLM calls or a per-keystroke search request.
- A focusable single-image paste area reuses the cover upload/validation path. Existing file selection and URL entry remain available. Actual PNG paste uploaded to local R2; ordinary title-text paste preserved the image.
- Existing 素食料理 values show Vegetarian in English for both category kinds. Their saved associations remain usable, and materializing identical legacy names in two kinds creates distinct IDs.
- Saved recipe content can be prepared once on the Mac and cached in Chinese/English. Repeated switches and a full reload used the same ready cache timestamp in the local browser. Canonical source text remains the editor's source of truth; image/category changes do not invalidate content translations.

## Checks before publication

- 97 unit/domain/store tests pass, including real SQLite + Drizzle cache claims and concurrency checks. TypeScript passes; the final source workflow runs the production build again.
- Real local-model test: a Chinese recipe produced English title, description, ingredients and ordered steps; the original record was not rewritten.
- Local role integration passes: viewers cannot upload, create categories, claim or write translations; owner-only internal pages are hidden. The test restores the original mock role.
- Existing recipe content is protected by an atomic source-text comparison in both claim and completion SQL. JSON arrays compare index/value semantics, preserving whitespace/escaped-Unicode compatibility.

## Independent review

The fresh read-only review of candidate 2f948fe found three Important issues. All were reproduced and fixed:

1. A delayed old claim could replace a newer ready cache. Regression tests now reject stale claim/completion writes atomically against persisted source content.
2. An expired pending claim could leave the detail page stuck. Browser RED/GREEN verification showed retry availability change from 0 to 1 after refreshing an expired claim; retry subsequently produced a ready cache.
3. Model output could omit an existing description or note. Validation now preserves field presence in both directions and rejects blank translated text.

## Operating limits

First generation requires the local Mac helper and an editor/owner; keep the page open until it completes. Phones and viewers use already saved versions. Offline/failed generation shows original content and a visible retry notice, never a silent stale translation. Failed jobs do not automatically restart on language toggles. Existing recipes can be processed sequentially from the owner-only internal page. No paid model, public sharing or remote Mac job bridge was added.
