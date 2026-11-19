# TasteSift MVP 1.4

## Mac helper prerequisites

The core local library can run without this processor. Use the helper for video/post evidence extraction and preparing new Chinese/English display versions. Video sources must remain publicly accessible and provide enough recipe evidence; supported-platform recognition does not guarantee a successful import.

The optional media path is configured for a Mac. These are the existing executable settings in `scripts/video-extractor.mjs` and `scripts/video-frames.mjs`:

| Setting | Default | Purpose |
|---|---|---|
| `YT_DLP_PATH` | `/opt/homebrew/bin/yt-dlp` | Metadata, captions and bounded media downloads |
| `FFMPEG_PATH` | `/opt/homebrew/bin/ffmpeg` | Audio conversion and sampled video frames |
| `FFPROBE_PATH` | `/opt/homebrew/bin/ffprobe` | Media duration/type checks |
| `WHISPER_PYTHON` | `~/.hermes/venvs/video-knowledge-extraction/bin/python` | Python executable for the separate speech-recognition script |

Set the corresponding environment variables before starting the helper when executables live elsewhere. The core install does not install these tools. The speech path also requires `Video Knowledge Extraction/server/transcribe_audio.py` in a sibling checkout next to TasteSift, plus the Python dependencies expected by that script. Its path is fixed by `TRANSCRIBE` in `scripts/video-extractor.mjs`; there is no transcriber-path environment override. Providing Python alone does not supply that script. Captions and explicit post text can avoid speech recognition, but an audio-dependent source needs this external setup.

`scripts/local-model.mjs` sends requests to `http://127.0.0.1:8081/v1/chat/completions` with model name `unsloth/Qwen3.6-35B-A3B-GGUF`. The local server must accept the JSON-schema chat-completions requests; the frame fallback also needs image input. Endpoint/model values are fixed in that module, not environment overrides. No model, inference server, weights, Python environment or separate transcriber is bundled or installed here. There is no paid/cloud inference fallback.

The helper's `SITE_ORIGIN` constant is the original hosted Site's exact HTTPS origin; `LOCAL_ORIGIN` is `http://localhost:5173`. A hosted fork must change only its copy's `SITE_ORIGIN` to the fork's exact origin before processing jobs. Local helper calls from a different hostname or port will fail the existing origin check. Keep the listener at `127.0.0.1:18788` and retain exact allowed origins. Do not expose it or loosen browser/global security settings.

From the project root, run `node scripts/facebook-recipe-local.mjs`. On the same Mac, use the signed-in owner page `/internal/video-worker` and click Start. That page processes both queued videos and saved-recipe translations. Keep the Mac, helper and page running; `/internal` also provides sequential translation backfill. The browser may request permission to reach local devices. Phones contact only the private website, never their own localhost.

## Current workflow

Paste a public recipe-page URL on the homepage. The server reads schema.org Recipe JSON-LD, then shows an **unsaved** preview. Edit the extracted fields or click Confirm and save. Import alone does not write to the recipe table. Title, at least one ingredient and one step are required. Duplicate normalized sources are rejected, including concurrent saves.

The direct server importer supports public HTML pages with complete recipe metadata. It has no AI API key or paid inference dependency. Video/post imports use the Mac helper in [the prerequisites above](#mac-helper-prerequisites). Login-only, blocked, inaccessible sources and sources without sufficient recipe evidence return a visible error. For these, provide the accessible content to ChatGPT, review the extracted recipe, then save with the available Site tools or the manual form.

Run `node scripts/facebook-recipe-local.mjs` from the TasteSift directory (the command name is retained for compatibility). The helper listens only on `127.0.0.1:18788`. Open the signed-in owner's `/internal/video-worker` page on this Mac and click Start; keep the page, helper and Mac running. Phones submit supported video links to the private Site's `video_import_jobs` queue, and the Mac page claims and processes them sequentially. All phone requests use the website's HTTPS origin. The worker uses existing browser sign-in, with no persistent worker secret or inbound Mac listener beyond loopback. Results return to the submitting user's preview; confirming the existing save form is still required.

The shared reader supports public Facebook, YouTube/Shorts, 小红书, TikTok and Instagram individual video/post links using installed yt-dlp, the locally adapted caption parser and the neighboring project's faster-whisper script. Explicit Chinese or English ingredient/method sections can generate a preview directly; other sources use local Qwen at `127.0.0.1:8081`. Post text can still supply a recipe if audio is unavailable; a title alone cannot. Keep quantities/steps under review because speech recognition and model extraction can be imperfect.

Job reads are creator-private. Submission requires owner/editor; claims, heartbeats and completion require owner and the current live token. One atomic claim statement permits only one active job globally. Waiting jobs expire after 20 minutes; once claimed, a live two-minute lease governs processing independently of the waiting deadline. Interrupted or expired work cannot overwrite a result and is never silently reprocessed. The phone URL stores the job ID before submission for retry idempotence and refresh recovery. Ready drafts remain readable without running the model again. Stop/disconnect cancels the helper's current download, transcription or model request, and the helper serializes video work until cancellation cleanup finishes. Job creation/completion never insert or edit recipes. First-time bilingual content preparation remains the separate existing Mac workflow.

The reader rejects profiles, playlists, live streams, arbitrary hosts, credentials, unexpected ports and videos longer than 30 minutes. Share-link redirects remain within the originating platform; meaningful query parameters such as 小红书's `xsec_token` are retained. TikTok/XHS bare hosts are canonicalized for the installed extractor. yt-dlp ignores ambient configuration and disables the generic extractor. Subprocesses have time/output bounds; audio streams stop before writing beyond 200 MiB, including unknown-size responses. Subtitle byte size is checked before loading text, and only literal language identifiers are passed to yt-dlp. Temporary files are removed after success/failure. Metadata is extracted once and reused through a private per-job info JSON file for captions/audio. The caption parser is adapted locally so helper startup/translation do not depend on the neighboring checkout; only local speech recognition uses its Python script. The old `/facebook-recipe` endpoint and health service identifier are retained; `/health` now advertises platform capabilities, and `/video-recipe` is the shared endpoint. Older helpers show a restart/update instruction for the new platforms.

The model references a numbered source line for every ingredient/action. Verifiable excerpts are displayed; otherwise the cited original line is kept instead of an unsupported paraphrase. Placeholders, invalid references and empty evidence are rejected. An omitted model dish name falls back to the source title only after ingredient/action evidence is checked. Individual Instagram carousel posts can use their top-level recipe caption without downloading any carousel entries.

If those sources still lack recipe evidence, video clips can use the existing local Qwen vision model to read at most 36 sampled frames. Printed captions and observable actions remain separate: inferred visual actions cannot supply ingredient quantities, and printed heat/time settings are retained. Frame JPEGs are bounded to 512 KiB each and 6 MiB total; video-only clips can take this path after caption lookup. The frame-model request has a four-minute timeout and shares the video's cancellation signal. Empty/unreadable frames still fail safely; local model outages and timeouts are reported as processing errors. The resulting unsaved draft explicitly asks the user to check automatically read amounts and steps. No visual inference is used when the existing text/audio path succeeds.

On the first Start on the Mac page, Chrome may ask to allow TasteSift to access apps and services on this device. The owner must approve this local-device permission. Keep that Mac tab active so the prompt is visible; a background tab can wait for this permission without sending an HTTP request to the helper. The phone does not need local-device access. A pending TCP connection alone does not establish that the helper received the import. Do not change global browser security settings to bypass the prompt.

The browser checks the helper's origin-restricted `/health` endpoint before starting a video import, allowing up to one minute for the first permission prompt. After connection succeeds it allows up to 15 minutes for video processing and reports processing timeouts separately from connection failures. The helper streams actual `reading`, `transcribing` (when needed), and `organizing` stages as newline-delimited JSON, followed by the recipe; older JSON-only responses remain readable. Recipe model calls have a three-minute timeout; a busy local model may require retrying. The speech-recognition subprocess itself allows 15 minutes, so downloading/conversion plus transcription can exceed the browser's overall 15-minute processing deadline. Structured recipe posts skip audio transcription; otherwise captions/audio and available post text supply the local extraction model.

Cuisine and dish types use a shared bilingual catalog. Initial options and existing recipe values remain usable; confirmed custom categories and normalized aliases are stored in D1. An atomic category/alias batch prevents concurrent duplicate names. Import reads the current options, and recipe saves validate that any selected category already exists. Legacy 素食料理 labels display as Vegetarian in English for both category kinds, which keep distinct persistent IDs when materialized. The interface language is stored in the non-sensitive `tastesift-language` cookie.

Saved recipe pages prepare Chinese and English display content once through the Mac helper. The `recipe_translations` table stores the content hash, bilingual JSON and a short-lived generation claim. A current ready cache bypasses the helper entirely; editing only image/category metadata keeps the same content hash. Original text changes invalidate the display cache. Atomic claims prevent simultaneous duplicate translation calls, stale source hashes/tokens cannot overwrite newer results, and failed jobs need an explicit retry. Missing/offline translations fall back to original text with a visible notice. The editor always edits canonical original text. The owner-only internal page can backfill saved recipes sequentially. Keep the initial translation page open until completion.

## Access and storage

The Site is private. Sites owns hosted authentication. The first owner-private visit initializes the owner; recipe writes require owner/editor membership. Family management is deferred from the main interface. Existing role checks remain enforced server-side.

D1 stores recipes, memberships, custom categories and aliases. Local preview data in `.wrangler/state` is separate from hosted D1; local test recipes are not published. The `BUCKET` R2 binding stores uploaded JPEG/PNG/WebP covers up to 5 MiB, with bounded request bodies and signature validation. Uploads require editor/owner permission and the same browser origin; reading uploaded images requires membership. Existing external image URLs remain third-party URLs and may expire; the editor supports uploading a replacement. An older deployment may reference a legacy potato cover not included in this snapshot; preserve or migrate that image separately before moving its data.

The editor's separate focusable paste area accepts one user-pasted image and reuses that upload path. File selection and image URL entry remain available. It does not read the clipboard automatically or intercept text pasted into other fields.

The normal homepage contains no version badge or fixed test recipe links. Owner-only processing and translation-backfill tools are at `/internal`; non-owners receive 404 for that page and `/internal/video-worker`. One-off recipe previews have been removed. Run `node tests/integration/local-roles.mjs` with the loopback development server to verify local mock-user boundaries; it restores the original local role and never targets production.

Recipe search updates as the user types by filtering the already-loaded recipe shelf in the browser. It reuses literal partial matching for titles/ingredients and catalog-aware category matching, with no LLM call or per-keystroke request. Enter/the Filter button still submits the existing GET form for a shareable search URL. This intentionally lightweight MVP path does not add typo correction or semantic search.

Recipe exports and automated backups are not implemented in MVP 1. Git/source archives do not contain D1 records. Before bulk importing valuable recipes, arrange a separate D1 export/backup through supported hosting controls. Schema migrations are committed under `drizzle/`; do not rewrite applied migrations. A source rollback does not undo database writes.

## Local checks

Use Node.js `>=22.13.0`. Follow the [fresh-checkout quickstart](../README.md#run-a-fresh-local-checkout) for the portable install and local database. Run `npm test`, `npx tsc --noEmit`, `npm run lint`, then `npm run build`. `npm run dev` serves the loopback preview and its local mock sign-in; this authentication is absent from production.

Production runs on Cloudflare Workers. The importer validates destinations, checks public DNS, revalidates redirects, and bounds time/body size. DNS preflight does not pin DNS resolution, so the fetch boundary must remain on the intended Workers public network; do not expose the portable preview as a public server.

Publishing the original Site uses its existing `.openai/hosting.json` project ID and exact reviewed source commit. Keep that Site private. A fork must provision a separate Sites project and use that new `project_id`, preserving the `DB`/`BUCKET` bindings and MCP capability. GitHub source publication does not deploy a Site or change its access policy. Choose repository visibility independently of the Site's access policy. Never put source-repository credentials or API keys in files, logs or browser code.

Commercial release remains a separate phase: trademark/domain clearance and licensing/source attribution still require review before monetization.

## Local data and migrations

The [README quickstart](../README.md#run-a-fresh-local-checkout) applies the four committed SQL files in `drizzle/meta/_journal.json` order to a brand-new local database. Build first: `dist/server/wrangler.json` is generated from the hosting bindings and is the configuration used by the local Wrangler commands. This project does not use `wrangler.jsonc`.

Keep `--local`, `--persist-to .wrangler/state`, and the generated config path together. Development, standalone local migration commands and built previews use that state directory; Wrangler creates its versioned children. Do not pass `.wrangler/state/v3` as the persistence root. These local commands do not apply hosted migrations.

For an existing database, preserve a backup and establish which SQL files are already applied before running only the pending files in journal order. Direct `d1 execute --file` commands are not a migration-history runner; keep your applied-file record and inspect the existing schema when uncertain. Do not replay the quickstart blindly. Use `npm run db:generate` only when intentionally changing `db/schema.ts`; it is not part of setting up the current schema. Never rewrite an already-applied migration.

`.wrangler/state` contains local D1 database/WAL/SHM files and R2 uploads. It is ignored by Git but is persistent application data, not disposable build output. Do not delete it when cleaning builds. Preserve local env files and active service state too. `.sites-runtime/` holds ignored execution-profile and tool settings; `.vinext/` holds the dev-server lock/state. Rebuildable output includes `dist/`, `.next/`, `*.tsbuildinfo` and idle test artifacts. Check for active files before deleting logs or runtime files.

Git/source archives are not recipe backups. Arrange separate local/hosted database and upload backups; a source rollback does not undo database writes. Keep publication archives outside the checkout or inside ignored `outputs/`. Do not add env files, keys, cookies, model files, database exports or local runtime state to the source archive.

## Execution profiles and local tools

A clean checkout defaults to `portable` when ignored `.sites-runtime/execution-profile.json` is absent. The Sites initializer selects `managed-linux` only with `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable and stores that local selection. Both profiles configure first, then the Sites plugin runs its separate dependency-install step. When using that plugin, follow its current skill for lifecycle operations and run its `configure-execution-profile.mjs` helper only when the selection is unknown for that checkout/environment. Profile changes do not require reinstalling valid dependencies; restart a running preview to apply them. Do not commit/upload `.sites-runtime/`.

`npm run install:ci` runs one locked install, disables parent-workspace discovery and includes required dev/optional dependencies even under production/omit settings. Sharp uses prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- Portable preserves the caller's HOME, npm cache, registry, proxies, temporary paths, retry/concurrency and lifecycle-script policy. Its install uses `--prefer-offline --no-audit --no-fund`; no Bash or host `timeout` command is required.
- Managed Linux requires Bash, `flock`, `curl`, `sha256sum` and GNU `timeout`. Its existing scripts use checkout-local HOME/cache/tmp paths, an install lock, locked-tarball preflight and a timeout. The image-seeded npm cache is restored only when the lockfile hash matches; network fallback remains available. Portable does not invoke these Linux helpers.

`scripts/sites-env.mjs` defaults Wrangler/Miniflare tool state to the checkout while preserving the caller's HOME, npm cache, proxy, XDG and temp configuration. If npm cannot write its configured cache, choose a writable `npm_config_cache` for that install. Do not repurpose HOME to fix a portable install. Builds retain their existing managed-linux timeout.

Portable `npm run dev` starts Vinext HMR at `localhost:5173`. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` if needed; keep the preview on loopback. Vinext's ignored `.vinext/` lock rejects ordinary duplicate launches and recovers stale state after stopped processes; exactly simultaneous starts can race. The helper origin and role integration check expect `http://localhost:5173`, so another host/port needs deliberate alignment rather than a wildcard origin.

For managed Linux browser QA, follow the Sites skill's managed preview reference. Its daemon uses the project's Vite dev script with `--host 0.0.0.0 --port 4173 --strictPort`; use the URL the CLI returns. The ignored local execution profile survives the daemon's cleared environment. Mock sign-in is disabled in this profile.

After a build, `npm start` runs the production Worker locally through Wrangler on `127.0.0.1` using `.wrangler/state`. It does not deploy the Site and does not simulate sign-in. Use its printed URL; `npm start -- --port <port>` selects a different built-preview port. Use portable `npm run dev` for the local mock-user flow.

Local previews use Miniflare placeholder `Request.cf` metadata without a network lookup. `CLOUDFLARE_CF_FETCH_ENABLED=true` opts into fetching preview metadata without changing hosted metadata. Tool usage metrics are disabled by default; `WRANGLER_SEND_METRICS=true` opts in.

## Hosted identity and sign-in

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. `worker/index.ts` preserves request-scoped connector bindings; `scripts/connector-preview/` provides the local connector preview Worker/session helpers. Keep these integrations and their notices when forking.

Sites dispatch owns hosted authentication and injects `oai-authenticated-user-id` and `oai-authenticated-user-email` for signed-in visitors. Private Sites require sign-in; public Sites can have anonymous requests without either header. The user ID is stable for one user on one Site but differs across Sites; use it as the durable member key, with email/name for display. Identity alone does not establish workspace membership: retain the server-side role checks and appropriate Sites access policy.

SIWC-authenticated workspace Sites may also receive optional `oai-authenticated-user-full-name` with `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`. Decode only with that encoding marker and fall back to email when the name is absent. `app/chatgpt-auth.ts` centralizes the current helpers.

- Use server-only `getChatGPTUser()` for optional identity and `requireChatGPTUser(returnTo)` for required identity.
- Start sign-in with a top-level `<a href={chatGPTSignInPath(returnTo)} target="_top">`. Do not use fetch/XHR, a client router or a prefetching framework link for sign-in.
- Use `chatGPTSignOutPath(returnTo)` for sign-out. Supply a same-origin relative return path; the helper validates it.
- Keep request-dependent protected pages `dynamic = "force-dynamic"` and enforce membership/role checks for protected data/actions.
- Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, OAuth cookies and identity injection. Do not implement those reserved routes or call the AuthAPI authorization endpoint directly.

Portable development replaces this hosted flow with the loopback-only mock identity described in the README; the mock cookie is not a production authentication mechanism. Generic Worker hosting without Sites dispatch would need its own authentication integration, outside this setup.

## Distribution status

No top-level project license has been selected. Do not label the project open source or assume general reuse/redistribution permission. Existing third-party notices apply to their respective vendored files and must remain. The legacy potato cover from older deployments is not included in this snapshot. Repository visibility is separate from the original private Site's access policy.
