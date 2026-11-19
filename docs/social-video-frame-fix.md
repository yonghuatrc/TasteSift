# Silent TikTok and Instagram cooking videos

The real failed tasks were `https://vt.tiktok.com/ZSp7Rfxhe/` (mini churros) and `https://www.instagram.com/reel/DHfUQf-pgkk/` (sizzling tofu). Both were publicly readable. TikTok had no usable speech/caption tracks; Instagram ASR contained song lyrics. The cooking amounts/instructions were burned into the video image, which the text/audio-only path never read.

Use the existing ffmpeg and local Qwen vision endpoint only after the existing extraction returns insufficient evidence. Read at most 36 bounded frames; copy printed cooking captions and describe observable actions separately. Ingredients must come from source text/captions, not guesses based on visual appearance. Never add durations/temperatures/amounts from an action description. Preserve the source-grounding and preview-before-save checks. Empty/unreadable frames still fail safely.

One-frame runtime proof: the existing local model copied `Salt (1/4 tsp)` exactly. The installed Tesseract route was also tested but produced noisy results over the busy background, so it is not added as an application dependency. Use the already running local multimodal Qwen model; no paid/provider fallback, credential, queue/schema or permission changes.

Acceptance: the two actual links produce reviewable unsaved previews; normal source imports retain their first text/audio path. All image/media processing is bounded and cancelled with the video request. Existing phone queue and manual save remain unchanged.

## Verification

- 155 tests and TypeScript pass, including frame/body limits at command boundaries, malformed references, unreadable frames, no ingredients from visual appearance alone, abort cleanup and preserving printed heat/temperature/time instructions.
- The real TikTok link returned Mini Churros with nine on-screen ingredient entries (including water/milk 150 ml, salt 1/4 tsp and flour 230 g). The printed low-heat instruction is preserved in the review draft.
- The real Instagram link returned 铁板豆腐 with fifteen source-supported ingredient entries and twelve steps. Music lyrics were excluded from the visual fallback's source material.
- Both were exercised through the actual local helper HTTP handler, with no recipe saved. First measured full attempts took about 67 and 71 seconds respectively. Final queue acceptance happens after the helper update.
- The same local JSON model transport is shared by extraction, translation and frame reading; text/translation sampling defaults are unchanged. Frame reading uses deterministic sampling, at most 36 JPEGs, 512 KiB per frame and 6 MiB total image bytes. Media, subprocess and model timeout/cancellation limits remain enforced.

## Independent review

Four Important findings were reproduced before fixes: spelled-out or vague inferred action quantities, ordinary oven/time spellings being omitted, operational vision errors being mislabeled as absent recipe facts, and explicitly video-only formats bypassing the fallback. Regression cases now cover each. Only typed insufficient-frame-evidence failures reuse the original recipe-evidence error; model outages and timeouts remain processing failures. An earlier promotion fixture blocks frame acquisition deliberately and now expects that operational classification.
