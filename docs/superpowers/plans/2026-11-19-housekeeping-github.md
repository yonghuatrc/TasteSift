# TasteSift Housekeeping and GitHub Publication Implementation Plan

> Publication note: This historical document describes the original checkout. The public snapshot starts a new Git history and excludes the legacy potato cover.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare a lean, reproducible TasteSift repository for teammates to fork, then publish only reviewed source to the approved GitHub repository.

**Architecture:** Keep the existing Vinext/Cloudflare application and its security boundaries. Remove demonstration features together with their assets and references, separate generated artifacts from persistent local state, and verify a source-only checkout before publishing. GitHub publication does not deploy the existing Site.

**Tech Stack:** Node.js >=22.13.0, TypeScript/React, Vinext/Vite, Cloudflare D1/R2, Node test runner, npm lockfile, Git, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-11-19-housekeeping-github.md` — read it before executing this plan.

## Global Constraints

- Node.js `>=22.13.0`.
- Preserve recipe behavior, Chinese/English support, membership checks, private uploads, import queues, source grounding, and cancellation limits.
- Keep useful automated tests; remove generated test results and one-off demonstration content.
- Preserve local `.wrangler/state` databases and uploaded files, local environment files, installed dependencies, and active service state.
- Do not modify hosted data, deploy the Site, change its visibility, or rewrite applied migrations.
- Do not add dependencies, infrastructure, or optional features merely for housekeeping.
- Review exact deletion paths before removing files; preserve a recoverable copy outside the publication source.
- Publication includes only reviewed committed source and reviewed Git history, never ignored local files or private data.
- Do not select GitHub visibility, repository owner, a license, or a history rewrite without Dennis's decision.

## Review Focus

1. An ignored runtime directory contains the only copy of local recipes/images: Task 1 inventories and checksums persistent state; Tasks 2/4 confirm it is unchanged.
2. A deleted sample is still imported, linked, or saved as a cover path: Task 2 checks references, compiler/build output, owner-visible 404s, and existing database references.
3. A fork has no original Site identity, local model, or sibling transcriber: Tasks 3/4 exercise the documented core setup separately from optional processing and verify origin restrictions remain exact.
4. A credential or private record exists only in an older Git commit: Tasks 1/5 audit the exact publication refs, not just HEAD; no push before findings are resolved.
5. A passing workspace relies on ignored generated files or original membership state: Task 4 installs and initializes a source-only temporary checkout, then exercises real role boundaries.

---

## Execution and file ownership

Planning only is authorized now. Retain the requested plan-conductor workflow: route this saved plan for review, load each approved stage's recommended skills/agents, and obtain independent stage approval before execution. Tasks below are the proposed stage boundaries.

| Path | Responsibility and proposed treatment |
|---|---|
| `.gitignore` | Retain existing protections; add only missing generated-output rules proved by the inventory. |
| `outputs/`, `dist/`, `.next/`, `tsconfig.tsbuildinfo`, `.DS_Store` | Exact reviewed artifact removal; regenerated verification outputs remain ignored. Never delete an active helper's log. |
| `.wrangler/`, `.sites-runtime/`, `.vinext/`, `.superpowers/`, `.env*`, `.dev.vars*`, `node_modules/` | Preserve local data/configuration and active state; already excluded from Git. |
| `app/recipes/facebook-preview/page.tsx`, `app/recipes/preview/page.tsx` | Delete one-off demonstration routes. |
| `data/review/facebook-potatoes.json`, `data/review/steamed-spare-ribs.json`, `public/images/recipes/potatoes.jpg` | Delete with their demonstration consumers, subject to saved-cover reference check. |
| `app/internal/page.tsx`, `app/page.tsx`, `lib/i18n.ts` | Remove only demo links, `?example=chicken` handling, and newly orphaned sample copy; keep worker/backfill and bilingual UI. |
| `tests/integration/local-roles.mjs` | Retain role checks; add owner 404 assertions for deleted routes. |
| `examples/d1/app/api/notes/route.ts`, `examples/d1/db/schema.ts` | Delete unused starter example after dependency check; remove its README mention. |
| `README.md`, `docs/operations.md` | Maintain accurate fork setup, local prerequisites, current behavior, and hosting boundaries. |
| `docs/recipes/steamed-spare-ribs-evidence.md` | Delete one-off demonstration evidence and its README/operations references. |
| `docs/mvp11-acceptance.md`, `docs/mvp12-acceptance.md`, `docs/mvp13-acceptance.md`, `docs/mvp14-acceptance.md`, old `docs/superpowers/plans/*.md`, `docs/social-video-frame-fix.md` | Audit historical material; remove only superseded reports/completed checklists after preserving unique operational guidance. Keep this plan and its spec. |
| `components/ui/`, `hooks/`, `package.json`, `package-lock.json` | Inventory unused starter code; change only files/packages proved unreachable and included in the reviewed manifest. No blanket deletion or dependency upgrade. |
| `.openai/hosting.json`, `db/`, `drizzle/`, `scripts/`, `vendor/`, `public/favicon.svg`, useful tests/specs | Preserve required configuration, runtime/build code, migrations, notices, and reusable verification. |
| `LICENSE` | Create only if Dennis chooses a project license and ownership/third-party checks permit it. |

No new application API or persistent schema is introduced. Task interfaces are local audit artifacts, reviewed source commits, and verification evidence.

### Task 1: Inventory, recovery, and publication audit

**Files:** Read tracked source, ignored artifact candidates, `.gitignore`, `.openai/hosting.json`, historical docs, and relevant Git history. Write private audit/recovery material outside the repository under `/private/tmp/tastesift-housekeeping-<timestamp>/` with owner-only permissions.

**Interfaces:** Consumes current checkout and Git refs. Produces `inventory.md` (exact remove/keep paths, reason, consumers, sizes, active-file status), `baseline.md`, `persistent-state.sha256`, `source.bundle`, and recovery copies of deletion candidates. Never include these private artifacts in later commits or publication.

- [ ] **Step 1: Record current state.** Run `git status --short`, `git log --oneline -5`, `git remote -v`, `git ls-files`, and `git clean -ndX`. Expected: the initial planned baseline is HEAD `6cc1c47`, no changes/remotes. Reconcile drift; never execute the corresponding broad clean command.
- [ ] **Step 2: Create recovery evidence.** Create the restricted temporary directory, run `git bundle create <audit-dir>/source.bundle --all`, then `git bundle verify <audit-dir>/source.bundle`. Copy only exact approved artifact candidates there, preserving modes; compare hashes. Capture a sorted SHA-256 manifest for existing persistent local database/upload files while idle. If active writes prevent comparison, defer destructive cleanup until a consistent snapshot is possible; do not stop services silently.
- [ ] **Step 3: Classify deletion candidates.** Trace sample imports/assets, internal navigation, starter examples, completed docs, and component import/configuration graphs. Check local saved recipe cover URLs read-only for `/images/recipes/potatoes.jpg`; check hosted references through an approved read-only path before removing the bundled cover. If it is used, preserve the image and list the dependency; do not rewrite recipes. Use `lsof` on candidate paths to exclude active logs/state. Record exact paths instead of wildcards.
- [ ] **Step 4: Audit publication inputs locally.** Inspect `git ls-files`, `git log --all --name-only --format=`, and `git rev-list --objects --all`; scan current files and intended history with an available credential scanner. Inspect filenames/metadata for database dumps, cookies, probes, local paths, and copied media. Do not print secret values. If scanner tooling is unavailable, record that gap and block publication until an equivalent local scan is completed. Keep findings private. Treat the hosting project ID as deployment identity, not proof of a credential leak.
- [ ] **Step 5: Capture baseline checks.** Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` sequentially. Save exit codes and relevant diagnostics. A failed baseline is evidence to investigate, not permission for unrelated fixes. No production calls, real video downloads, or local model jobs are needed.
- [ ] **Step 6: Present the exact deletion manifest and audit outcome.** No source deletion before the manifest is reviewed. Record unresolved history/privacy and asset-ownership findings. This audit stage needs no source commit.

### Task 2: Remove disposable content without breaking the application

**Files:** Exact Task 1 deletion manifest; the demo routes/assets and consumers listed above; `tests/integration/local-roles.mjs`; docs with references; `.gitignore` only if a gap was found.

**Interfaces:** Consumes the reviewed inventory, recovery material, baseline, and persistent-state manifest. Produces a housekeeping commit with unchanged application/security interfaces and a complete `git diff --name-status` deletion list.

- [ ] **Step 1: Pin removed-route behavior before changing code.** Extend `tests/integration/local-roles.mjs` so the owner also receives 404 from `/recipes/facebook-preview` and `/recipes/preview`. Preserve all existing viewer/editor/owner denial assertions. In a temporary local database/server, run `node tests/integration/local-roles.mjs`; confirm these new owner assertions fail against the existing sample routes. Do not run this role-mutating test against Dennis's main local state or hosted data.
- [ ] **Step 2: Remove the coherent sample feature.** Delete the two route files, their JSON data, and the sample image if Task 1 proved it unused by saved recipes. Remove the three demo links from `app/internal/page.tsx` and the `exampleUrl` variable/`initialUrl` sample shortcut from `app/page.tsx`; preserve general importer behavior. Delete only translation keys made unused by these removals (`testPage`, `potatoExample`, `ribsExample`, `sampleNotice`) and update `internalHelp` so it describes the remaining worker/backfill tools in both languages. Remove demonstration references from README/operations and delete their evidence document.
- [ ] **Step 3: Remove other approved repository clutter.** Delete the two unused D1 example files and their README mention. Remove only audited superseded reports/completed plans and proved-unused starter modules/packages listed in the manifest. Preserve useful design constraints, tests, fixtures, vendored notices, and all migrations. If a package becomes unused solely because of an approved removal, update the npm manifest/lockfile with no unrelated version changes; otherwise leave them alone.
- [ ] **Step 4: Remove exact idle artifact paths.** Check candidate type, path containment, and open-file status immediately before removal. Delete only manifest-listed generated files/directories; do not traverse symlinks or delete persistent runtime data. Retain the recovery copy outside the checkout. Check `git check-ignore` for generated outputs; change ignore rules only for an observed omission. Do not create ignore-policy tests that merely duplicate `.gitignore`.
- [ ] **Step 5: Verify the cleanup.** Run `npm test`, `npx tsc --noEmit`, and `npm run build`. Search retained runtime/docs for deleted imports, asset paths, and sample links; an explicit regression assertion that removed routes return 404 is valid. Re-run the integration check on the temporary database. Expect removed routes to return 404 even for owner, all prior role boundaries to pass, and real internal tools to remain. Compare persistent-state hashes when idle and inspect `git diff --check` plus `git diff --name-status`.
- [ ] **Step 6: Commit only reviewed cleanup files.** Stage explicit paths from the reviewed diff; do not use `git add .`. Commit as `chore: remove disposable TasteSift demos and artifacts`. Ignored local artifact deletion may leave no Git diff; record it in the audit rather than adding generated files to Git.

### Task 3: Make fork setup accurate and complete

**Files:** Modify `README.md` and `docs/operations.md`; conditionally create `LICENSE` after Dennis's choice. Read `.openai/hosting.json`, `vite.config.ts`, `scripts/facebook-recipe-local.mjs`, `scripts/video-extractor.mjs`, `scripts/local-model.mjs`, and existing install scripts. Do not change helper transport or authorization for documentation convenience.

**Interfaces:** Consumes the cleaned source and Task 1 dependency findings. Produces a documented core setup, explicit optional-processing prerequisites, and a clear fork deployment boundary that Task 4 can follow literally.

- [ ] **Step 1: Write the core quickstart.** Put the Node floor, `npm run install:ci`, `npm run build`, local D1 initialization, `npm run dev`, and `/signin-with-chatgpt?return_to=/` in dependency order. For a brand-new temporary database, document applying the four committed SQL migrations in journal order using the existing local Wrangler command/config and `.wrangler/state`. Warn not to replay them on an existing database. Explain first-user ownership and that hosted authentication requires Sites. Correct stale starter claims such as `db/schema.ts` being empty. Preserve managed-linux instructions where still required; keep standalone fork instructions easy to find.
- [ ] **Step 2: Document optional processing prerequisites and limits.** List actual `YT_DLP_PATH`, `FFMPEG_PATH`, `FFPROBE_PATH`, and `WHISPER_PYTHON` overrides; the exact expected sibling `Video Knowledge Extraction/server/transcribe_audio.py`; the local Qwen endpoint/model; loopback helper command/port; and owner-worker start flow. State which features need these services. Explain that `SITE_ORIGIN` in `scripts/facebook-recipe-local.mjs` must match the fork's exact hosted origin and that localhost is already allowed. Never suggest wildcard origins or exposing the helper. Full independent ASR packaging is a separate task; do not claim this cleanup supplies it.
- [ ] **Step 3: Document separate GitHub and Site identities.** Explain that forks must create their own Sites project and replace only their fork's `project_id`, retaining `DB`, `BUCKET`, and MCP declarations. Keep this checkout's hosting identity and private deployment unchanged. Explain that GitHub contains source, not the family's database, uploads, environment, or model files.
- [ ] **Step 4: Resolve distribution choices before publication.** Ask Dennis for GitHub owner/name/visibility and a project license choice once the audit can inform the question. If public/open-source reuse is intended, obtain a specific license decision; do not infer it from a wish to fork. Keep existing third-party notices. If no license is selected, state the reuse limitation accurately instead of labeling the project open source.
- [ ] **Step 5: Review documentation and commit.** Check every command against retained files/scripts and every relative link against existing targets. Run `git diff --check`; expect no whitespace errors or links to removed sample pages/docs. Commit explicit documentation paths as `docs: document reproducible TasteSift fork setup`.

### Task 4: Prove a source-only checkout works

**Files:** No planned product changes. Use `/private/tmp/tastesift-fork-check-<timestamp>/`; keep verification evidence in the private audit directory. Test the committed tree with its own dependencies, generated config, and local database.

**Interfaces:** Consumes the Task 3 commit and quickstart. Produces verified commit SHA, install/test/type/build/lint results, local smoke/role results, and recorded optional-feature limitations. Any corrective commit invalidates the affected proof and must be checked again.

- [ ] **Step 1: Export reviewed source only.** Record `git rev-parse HEAD`, create a `git archive --format=tar HEAD` outside the source checkout, and extract to the new temporary directory. Confirm `.git`, `outputs`, `.wrangler`, local env files, and `node_modules` were not included. Do not copy dependencies or ignored runtime state from the main checkout.
- [ ] **Step 2: Follow the README literally.** In the temporary checkout run the documented install, `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`. Expect install/tests/typecheck/build to exit 0 and no new lint errors versus baseline. Record pre-existing lint debt explicitly; do not silently call a failed command passing. If network/sandbox restrictions prevent a check, mark it blocked and do not claim fork readiness until completed in an authorized environment.
- [ ] **Step 3: Initialize only the new temporary D1 database.** Follow the README migration commands; verify all four migrations/schema are present and the recipes table is empty. Start its dev server on available loopback port 5173 (the retained integration test uses localhost:5173); if occupied, defer or deliberately adapt the test and exact-origin expectations without broadening allowed origins. Do not stop the existing service silently.
- [ ] **Step 4: Exercise the core browser flow.** Sign in with the local mock route; create, read, edit, search, and delete a disposable manual recipe. Expect an understandable fallback/notice when optional translation services are unavailable. Check `/internal` and its worker/backfill controls as owner, and both removed samples as 404. Run `node tests/integration/local-roles.mjs`; expect all preserved role/origin denials plus owner sample 404s to pass, and the mock role to be restored. Use only this temporary database.
- [ ] **Step 5: Confirm isolation and readiness.** Stop only the verification server started for this task. Compare the main checkout's persistent-state manifest when idle. Verify the release commit contains no generated output, local data, missing runtime assets, or unreviewed source changes. Record optional ASR/model/hosted deployment dependencies separately from the verified core behavior. Keep recoverable audit material private.

### Task 5: Publish the approved repository and verify it

**Files:** Git refs/remotes and approved repository metadata only; `LICENSE` if Task 3 authorized it. No Sites deployment or production data change.

**Interfaces:** Consumes the exact Task 4 verified commit, resolved privacy/history findings, and Dennis's explicit repository owner/name/visibility/license decision. Produces GitHub repository URL, remote commit SHA, and verified visibility.

- [ ] **Step 1: Recheck authorization and account.** Review the agreed publication values; run `gh auth status`, `gh api user --jq .login`, `git remote -v`, and `git status --short`. Verify organization permission if an organization was chosen. Do not print tokens, silently use a different owner, overwrite an existing repository, or change existing remote settings.
- [ ] **Step 2: Audit the exact outbound refs.** Run the history/current-tree checks from Task 1 on the branch and all ancestors intended for push; account for any newly added commits. Confirm no secrets/private exports, clean generated-output exclusion, retained notices, resolved license status, and Task 4's verified SHA. Push one approved branch only, no `--all`/`--mirror`/tags by default. If unsafe historical content is found, stop for remediation and an explicit history choice rather than pushing or force-rewriting it.
- [ ] **Step 3: Present the concrete publication summary.** Show the exact owner/name, visibility, license status, branch/commit, deletion summary, and verification limits. If approval for these exact values already exists, proceed; otherwise obtain it before the external write. Stage approval alone does not settle unspecified public/private or licensing choices.
- [ ] **Step 4: Create the repository and push the verified branch.** First verify the target does not already exist. Run `gh repo create <approved-owner>/<approved-name> --<approved-visibility> --source=. --remote=origin` without `--push`, then `git push -u origin <verified-branch>`. Use actual reviewed values, not placeholders, and never force-push. If creation succeeds but push fails, record the empty repository and retry only the push after resolving the failure.
- [ ] **Step 5: Verify the external result.** Run `gh repo view <approved-owner>/<approved-name> --json url,visibility,defaultBranchRef` and `git ls-remote origin refs/heads/<verified-branch>`. Expect the approved visibility and exact verified SHA; check default branch matches the published branch. Confirm the remote tree/README has useful tests, migrations, notices, and setup instructions but none of the removed demo assets or generated/private files. Report the repository URL and any material limitations. If incorrect private material was published, address access/removal and credential rotation immediately; deleting a remote commit alone cannot guarantee recall.

## Self-review and handoff

- Request coverage: artifact cleanup is Tasks 1/2; useful fork contents and setup are Tasks 2/3; fresh-source proof is Task 4; actual GitHub publication is Task 5.
- All five review-focus items have explicit verification steps in their owning tasks.
- No new code interfaces, dependencies, database migration, Site deployment, CI system, or ASR service is proposed.
- Open decisions: repository owner/name/visibility, project license, any unsafe-history remediation, and whether a cover currently used by saved recipes must remain.
- Execution has not begun. Review this plan, then route it with plan-conductor and approve stages independently as requested.
