# MVP 1.3: multi-platform video import

## Verification before publication

- Baseline 97 tests; extended suite 124/124 and TypeScript pass after the independent review fixes.
- Shared platform/URL validation, safe short-link redirects preserving source tokens, caption selection, bounded audio fallback, cleanup, client capabilities/legacy helper fallback and localized source failures are covered.
- A subprocess-backed HTTP integration test proves a complete post recipe can produce a preview when audio is unavailable; a title-only source never calls the model in that path. The regression failed before the implementation change and then passed.
- Actual YouTube import: `https://www.youtube.com/shorts/M8dLNsKAsrw` produced an unsaved 干蒸排骨 preview from local speech recognition/model extraction in about 30 seconds. No caption tracks were available. Review remains necessary; no original saved recipe was changed.
- Actual TikTok import: `https://www.tiktok.com/@thesapor/video/7672478613748337951` produced an unsaved Creamy garlic parmesan chicken meatballs preview using the public source text/audio pipeline.
- Existing Facebook regression: `https://www.facebook.com/reel/2164961941036665` still produced the structured-post preview without waiting for the model, in about 4 seconds.
- Instagram sample `https://www.instagram.com/reel/DS0alsqiGj6/` exposed a public caption referring readers elsewhere for the recipe. It correctly returned noRecipeEvidence rather than inventing ingredients/steps. A complete public recipe link is still needed for positive live verification.
- The old upstream 小红书 sample `https://www.xiaohongshu.com/explore/6411cf99000000001300b6d9` currently exposes no usable post text/video formats. 小红书 link routing/redirects and extraction fixtures pass; positive live verification needs a current accessible share link.
- Chrome denied the local preview URL with HTTP 403 despite the development server responding normally to local CLI requests. Use the deployed private Site for final browser acceptance; do not change browser security settings.

## Scope and limits

No production recipe was auto-saved, no sharing changed and no paid provider was added. Importing runs on the Mac with the helper; phone access remains for saved recipes and normal hosted features. Support means an extraction path for accessible public content, not bypassing login/platform blocks. Audio-only extraction cannot guarantee correct recognition of every quantity or burned-in subtitle; users review the unsaved result.

## Independent review corrections

One fresh review found seven important gaps. The fix pass restores common Facebook/TikTok share routes and legacy video.php links, rejects unsupported social pages before hosted fetching, rejects placeholder/invented recipe fields against source text, enforces an on-disk byte cap on streamed media, validates subtitle size/language selectors, accepts Instagram carousel captions without downloading entries, reuses the validated info JSON for captions/audio, and removes the mandatory neighboring JavaScript import from helper startup. Regression coverage includes a real child-process byte stream, a standalone helper copy and a promotional caption whose stub model invents a recipe. These reproduce the failures before the fixes.

The minor total-time mismatch remains: the browser allows 15 minutes overall while local speech recognition has a separate 15-minute process limit. Very slow jobs can still time out in the browser; they never auto-save a partial result.

The first strict-verbatim validation trial rejected a real TikTok paraphrase, and a busy local model timed out on a YouTube retry. The final extraction schema therefore requires a numbered source-line reference for every ingredient/action. Exact excerpts are displayed when available; otherwise the referenced original line is kept rather than the model's paraphrase. Out-of-range references, empty evidence, placeholder-only results and promotional text after audio failure are rejected. Recipe model calls allow up to three minutes/4000 output tokens; no paid model or unlimited retries were added.

Tracing an actual TikTok rejection showed valid source references, ingredients and steps, but an empty model title. The helper now falls back to the source title only after grounding the recipe fields. The subprocess-backed HTTP regression reproduces that missing-title response and now returns a valid unsaved preview. A final real YouTube import with source-line grounding succeeded (12 ingredients, 26 source-grounded steps).
