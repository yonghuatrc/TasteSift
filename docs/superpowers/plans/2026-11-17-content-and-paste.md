# TasteSift: paste, category labels and saved bilingual content

Approved directly by Dennis after the four-item checklist: finish live search, then implement the other three without another approval gate. Live search is published in f6277b8; verify its live behavior before final handoff.

## Remaining acceptance

1. Add a focusable single-image paste area to the cover editor. Reuse the existing file upload validation and R2 persistence; keep file selection and URL entry unchanged. Ordinary text pasting outside the image area must be unaffected.
2. Show Vegetarian for the existing 素食料理 category in both cuisine and dish type. Preserve existing recipe references and keep the two category kinds distinct when storing bilingual aliases.
3. Persist Chinese and English recipe content so language switching does not call an LLM. Keep canonical source text intact for editing. A saved recipe opened on a Mac with the helper can generate its two display versions once; an original-content change invalidates the old translation. Phone reading uses saved translations. Missing/offline translations must show the original with a clear status, never silently display a stale version.

## Implementation

- Extend the cover field with a user-initiated paste handler; no automatic clipboard reads or new browser permission.
- Extend the existing category normalization/store rather than rewriting saved recipe rows.
- Add a D1 translation cache keyed by recipe ID and source-content hash, with an atomic claim/lease to prevent simultaneous duplicate model requests. Complete writes must match the current source hash and claim token. Failures require an explicit retry, not repeated LLM calls on language toggles.
- Extend the existing local helper with a translation route using the already configured local model; no paid provider or remote tunnel. Translate title, description, ingredients, ordered steps and notes, preserving quantities and source meaning. The original remains the editor's source of truth.
- Use the existing owner-only internal page for sequential backfill of older saved recipes, keeping Mac load bounded.

## Verification

Write and observe failing tests for clipboard selection, bilingual legacy category labels/kind separation, cache reuse/invalidation/claim races and stale-result rejection. Run full tests, types and build. Exercise paste, unchanged upload/link flows, both category dropdowns, first-time translation and repeated toggles through the browser. Keep production recipe originals unchanged, retain the private audience, publish through Sites, then verify the actual hosted UI. One fresh read-only review covers the completed changes before publication.
