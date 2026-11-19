# TasteSift MVP 1.1 validation record

Approved by Dennis on 17 November 2026. Release URL: https://tastesift.yonghuat0425.chatgpt.site

## Implemented scope

- Actual animated import stages from the Mac helper, including conditional transcription and local-AI organization; no invented percentage.
- A shared bilingual cuisine/dish-type catalog. Imports read current options, editors choose from dropdowns, and new names require confirmation. Aliases are persisted even when an existing category is reused; concurrent shared names converge on one category.
- Private R2 cover uploads in the editor, JPEG/PNG/WebP up to 5 MiB. Previous images and edits survive rejected uploads. The potato example includes a bundled original-source cover.
- Chinese/English interface switching with a persistent language cookie; unsaved form fields and unsaved import previews survive switching. Recipe source text remains unchanged.
- Clean normal homepage, with version/sample content on owner-only internal pages. Existing recipe data and the private Site audience remain intact.

## Proof collected before publication

- 77 automated tests pass, including real SQLite/Drizzle category persistence and concurrent alias collisions, source-step preservation, streamed byte chunks, upload signatures/body limits and existing permissions/save behavior.
- TypeScript check passes. Production build is required again by the final Sites source workflow.
- Real local browser checks: Facebook potato import, the longer XO-sauce video (including transcription/local AI and reuse of the existing Cantonese/Sauces categories) and RecipeTin Eats import; category reuse and confirmed creation; upload, failed-upload preservation and local save/reload; language switching with unsaved title/ingredients/category/image; 390px layout without horizontal overflow.
- `node tests/integration/local-roles.mjs` passes: viewers can read categories, cannot upload/create categories, and receive 404 for internal/test pages. Anonymous uploaded-image reads return 401. The script restores the local mock user's original role.
- All test recipe saves and custom QA categories were local. Real hosted recipe saves still require Dennis's confirmation.

## Independent review and fixes

A first reviewer could not finish because of a usage limit. Its replacement completed a read-only whole-branch review of `8491545..c19feb8` and reported two Important defects, both reproduced before correction:

1. Reusing one bilingual category name lost the other alias. Fixed with atomic alias attachment, collision retry and deduplicated catalog materialization. Three real store tests went RED to GREEN.
2. A cooking step containing `+` was wrongly rewritten as a dipping sauce. Fixed by preserving ordinary source steps and requiring an explicit sauce section. Reproducing test went RED to GREEN.

No confirmed Critical finding remained. The reviewer did not independently repeat browser/deployment/integration acceptance; those checks are performed by the implementing agent.

## Decisions and remaining limits

- Continue the previously selected inline, one-folder feature-branch workflow. Tradeoff: less independent worktree isolation; the production source workflow still packages an exact tested commit.
- Deferred Minor: a few detailed source errors use localized general messages. Connection failures and processing timeouts remain distinct.
- Facebook imports still require this Mac and its helper. Phones can browse/edit/save hosted recipes and upload covers, but cannot remotely submit a job to the Mac in this version.
- Automatic YouTube/TikTok extraction, paid AI setup, recipe-content translation and expanded family management were not added.
