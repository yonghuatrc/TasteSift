# TasteSift housekeeping and GitHub publication

> Publication note: This historical document describes the original checkout. The public snapshot starts a new Git history and excludes the legacy potato cover.

## Request and outcome

Dennis wants housekeeping before publishing TasteSift to GitHub: delete test artifacts, assets, and files that will not help a teammate fork the project. This document records the proposed scope for review; it does not authorize execution or publication by itself.

A teammate should receive the working application, useful automated tests, migrations, required runtime assets, dependency lockfile, third-party notices, and accurate setup instructions. A clean checkout must install, test, typecheck, build, and serve a working local recipe library without Dennis's local database or generated outputs.

## Constraints

- Node.js `>=22.13.0`.
- Preserve recipe behavior, Chinese/English support, membership checks, private uploads, import queues, source grounding, and cancellation limits.
- Keep useful automated tests; remove generated test results and one-off demonstration content.
- Preserve local `.wrangler/state` databases and uploaded files, local environment files, installed dependencies, and active service state.
- Do not modify hosted data, deploy the Site, change its visibility, or rewrite applied migrations.
- Do not add dependencies, infrastructure, or optional features merely for housekeeping.
- Review exact deletion paths before removing files; preserve a recoverable copy outside the publication source.
- Publication includes only reviewed committed source and reviewed Git history, never ignored local files or private data.
- Do not select GitHub visibility, repository owner, a license, or a history rewrite without Dennis's decision.

## Observed checkout, 19 November 2026

- HEAD was `6cc1c47`; working tree was clean and no Git remote was configured.
- `outputs/` occupied approximately 28 MiB and held probe results, logs, screenshots, drafts, archives, and development-review material. It is already ignored.
- `dist/`, `.next/`, TypeScript build state, and `.DS_Store` are generated and ignored. Runtime directories are ignored too, but `.wrangler/state` contains local application data and must not be treated as disposable build output.
- Two owner-only demonstration pages import `data/review/facebook-potatoes.json` and `data/review/steamed-spare-ribs.json`. The potato JSON references `public/images/recipes/potatoes.jpg`. Their navigation is in `app/internal/page.tsx`; the homepage also has an owner-only `?example=chicken` shortcut.
- `/internal` additionally owns real translation backfill and the Mac worker link. It must remain.
- `examples/d1/` is starter example code, excluded from TypeScript, with a README mention. It is separate from TasteSift's actual `db/` and `drizzle/` implementation.
- `.openai/hosting.json` is imported by `vite.config.ts` and copied during builds. Preserve its binding declarations and the existing checkout's deployment identity; forks must provision their own Site identity before publishing.
- The local helper accepts one specific hosted origin plus `http://localhost:5173`. It uses a loopback Qwen endpoint at port 8081, Homebrew media-tool defaults, and a speech-recognition script in the sibling `Video Knowledge Extraction` checkout. Existing environment overrides cover media binaries and Python, but not that script path or hosted origin.
- The repository has vendored notices but no top-level project license. GitHub CLI is installed; authentication and repository ownership have not been checked. No secret scan, baseline suite, or fresh-clone run has been performed for this plan.

## Proposed cleanup boundary

Remove the two demonstration routes, their JSON/image assets, their navigation and query shortcut, and copy made obsolete by those removals. Remove the unused starter D1 example after confirming no runtime dependency. Remove generated outputs only after inventory, recovery copy, and open-file checks. Keep useful architectural/operational documentation and regression fixtures; retire historical reports or completed implementation checklists only after carrying any unique setup or invariant into the maintained documentation.

Unused source modules or packages require proof from the import graph, configuration, runtime loading, and verification. A single text-search miss does not justify deletion. No broad source refactor is proposed.

## Verification and publication

The original checkout and a source-only temporary checkout must pass `npm test`, `npx tsc --noEmit`, and `npm run build`. Record the lint baseline and run `npm run lint` again after cleanup; new errors block completion. Prove a fresh local D1 setup, local sign-in, and owner/editor/viewer boundaries using the retained integration check. Verify removed sample routes return 404 for the owner too, and the real worker/backfill tools remain accessible only to the owner.

Document optional local-model/media dependencies honestly. Do not claim a standalone speech-recognition installation or arbitrary hosted-origin support; document the exact existing customization points and missing dependency. Bundling the sibling transcriber or redesigning helper configuration requires a separate approved change.

Before a push, review both current files and every ref to be published for credentials, private records, machine-specific material, and third-party redistribution rights. Confirm GitHub owner/name/visibility and license decision; recommend `TasteSift` as the name but do not infer public visibility. Preserve history when clean. If history is unsafe, stop for a rotation/remediation or source-only-history decision. Verify the pushed commit and repository visibility after publication. GitHub source publication is separate from Site deployment.
