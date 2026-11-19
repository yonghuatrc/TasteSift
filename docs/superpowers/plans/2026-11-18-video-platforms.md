# Multi-platform Recipe Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Mac-assisted recipe preview to YouTube, 小红书, TikTok and Instagram while preserving Facebook.

**Architecture:** A shared URL classifier serves the browser and helper. A Node video reader owns bounded yt-dlp/caption/ASR operations, reusing the installed neighboring transcription tools. The existing helper owns recipe generation and progress; hosted storage/save authorization is unchanged.

**Tech Stack:** React/Vinext, Node, installed yt-dlp/ffmpeg/ffprobe/faster-whisper, local Qwen, Sites.

**Spec:** docs/superpowers/specs/2026-11-18-video-platforms.md

## Global Constraints

- Keep the existing project folder and native execution preference; no new worktree.
- No paid services, source-original rewrites, new sharing or remote Mac bridge.
- Public single-source URLs only; 30-minute maximum; keep preview unsaved.
- Preserve source query tokens, existing uploads/search/categories/translations and legacy Facebook endpoint.

## Review Focus

- Lookalike hosts, credentials and cross-platform short-link redirects must fail before a subprocess.
- Playlists/profiles/live streams must not expand into downloads.
- Missing captions must fall back to bounded local ASR; failed jobs must remove temporary files.
- Old helpers must give an update instruction for new platforms while retaining Facebook compatibility.
- A model with no usable ingredients/steps must never produce a saveable fabricated preview.

### Task 1: Shared video import, end to end

**Files:**
- Create: `lib/recipes/video-platform.mjs`, `scripts/video-extractor.mjs`.
- Modify: `scripts/facebook-recipe-local.mjs`, `lib/recipes/import-local.ts`, `components/recipe-importer.tsx`, `lib/i18n.ts`, operations/README.
- Test: `tests/video-extractor.test.mjs`, `tests/facebook-recipe-local.test.mjs`, `tests/recipes/local-import.test.ts`.

**Interfaces:**
- `videoPlatform(rawUrl)` returns one approved platform name or null.
- `resolveVideoUrl(rawUrl, fetcher)` keeps a supported source within its platform.
- `fetchVideoMetadata(url, run)` returns platform, title, creator, description, thumbnail, duration, language and caption languages.
- `fetchVideoTranscript(url, metadata, run)` returns source segments, preferring captions over ASR.
- `importVideoOnMac(url, onStage, fetcher, categories)` returns validated unsaved RecipeInput; the helper streams through `/video-recipe`, retaining `/facebook-recipe`.

- [ ] Write URL/redirect/process/caption/ASR tests and helper/client compatibility/error tests. Watch the added behaviors fail before implementing.
- [ ] Add the shared platform reader and extend the existing helper/client/UI. Reuse source facts; reject missing evidence and unsupported input.
- [ ] Run focused tests, then `npm test` and `npx tsc --noEmit`; all must pass.
- [ ] Run real public-link probes/imports, existing Facebook regression and browser preview/error checks. Record each platform's observed result.
- [ ] Commit, obtain one independent whole-change review, fix important findings with RED/GREEN coverage, run full checks/build and publish the exact source to the existing private Site.
- [ ] Verify hosted UI and share the live link with precise Mac/platform limitations.
