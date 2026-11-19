# TasteSift — MVP 1.4

Private Chinese/English recipe library built with Vinext, React, Cloudflare D1 and R2. Add recipes manually or import a public recipe page, review the ingredients and steps, then confirm save. Search titles, ingredients and shared categories; upload, link or paste a cover image.

Manual recipes and complete recipe-page metadata work without a local AI model. Video/post imports and preparing new bilingual display content use the optional Mac processor. Saved originals remain readable while translations are unavailable. See [operations and limitations](docs/operations.md) for the full workflow.

## Run a fresh local checkout

Use Node.js `>=22.13.0`, npm and Git. The core portable setup supports Windows, macOS and Linux without Bash. The optional media/AI workflow has separate Mac prerequisites below.

Run commands from the repository root. No Cloudflare login or hosted database is needed for this loopback development setup.

1. Install the locked dependencies and build the local Worker configuration:

   ```sh
   node --version
   npm run install:ci
   npm run build
   ```

   `install:ci` runs one `npm ci` with the required dev/optional dependencies. Do not overlap installers. A fresh checkout defaults to the portable execution profile.

2. **For a brand-new local database only**, apply these four committed migrations once, in this order:

   ```sh
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_stale_winter_soldier.sql
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_cuddly_warpath.sql
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_silly_captain_flint.sql
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_many_lenny_balinger.sql
   ```

   Keep `--local` and `.wrangler/state` exactly as shown. Wrangler adds its own versioned subdirectories. If this checkout already has local data, follow the [migration notes](docs/operations.md#local-data-and-migrations) instead of replaying these commands. Do not run `db:generate` for first-time setup.

3. Start the development server:

   ```sh
   npm run dev
   ```

   Open [local sign-in](http://localhost:5173/signin-with-chatgpt?return_to=/) in a browser on the same computer. Portable development signs in as the mock user `local_seedy` / `seedy@sites.test`. The first signed-in visit to an empty membership database becomes owner; later new members start as viewers. The development cookie survives server restarts. Use [local sign-out](http://localhost:5173/signout-with-chatgpt?return_to=/) to sign out.

4. Add a disposable manual recipe, confirm save, and check it in the library. New Chinese/English display content waits for the Mac processor; original content remains available with a visible status. Public HTML pages with complete schema.org Recipe metadata can import without AI. Import previews remain unsaved until confirmed.

Keep this preview on loopback. Mock sign-in is absent from production builds and disabled in the managed-linux profile. `npm start` previews the built Worker locally; it does not provide the development mock sign-in. See [execution profiles](docs/operations.md#execution-profiles-and-local-tools) for managed Linux and built-preview details.

## Optional Mac processing

Use this only when you need video/post imports or new bilingual display content. Existing cached translations do not call the model again.

| Capability | Prerequisites |
|---|---|
| Manual recipes and complete recipe-page metadata | Core local setup above; no model or paid AI API |
| Video/post previews | Mac helper, yt-dlp, ffmpeg/ffprobe and source evidence; local Qwen prepares bilingual content and organizes/reads evidence when needed |
| Audio speech recognition | The separate sibling transcriber and a Python environment with its dependencies |
| Preparing Chinese/English content | Mac helper, local Qwen and the signed-in owner's processing page |

Start the helper in another terminal:

```sh
node scripts/facebook-recipe-local.mjs
```

It listens only on `127.0.0.1:18788`. On that Mac, sign in as owner, open `/internal/video-worker`, and click Start. Keep the Mac, helper and browser page running. Phones use the private website; the Mac page initiates helper connections and returns an unsaved preview to the submitting device. Browser local-device access permission may be required.

The helper defaults to Homebrew media binaries, a local Qwen endpoint at `http://127.0.0.1:8081/v1/chat/completions`, and a speech-recognition script outside this repository. Read the [exact prerequisites and fork origin settings](docs/operations.md#mac-helper-prerequisites) before using it. This repository does not install the model, Python environment, or sibling transcriber.

## Checks and project layout

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Run `node tests/integration/local-roles.mjs` only with a disposable local database and its development server on `localhost:5173`. It checks role/origin boundaries, temporarily changes the mock user's role, and restores the original role. It never targets the hosted database.

| Path | Purpose |
|---|---|
| `app/`, `components/`, `lib/` | Recipe UI, authorization, import/translation logic and MCP tools |
| `db/schema.ts` | Members, recipes, categories/aliases, translations and import jobs |
| `drizzle/` | Committed SQL migrations and their generation journal |
| `scripts/` | Install/build helpers, local processor, Sites and connector integrations |
| `worker/index.ts` | Production Worker entrypoint and request-scoped connector binding |
| `.openai/hosting.json` | Sites deployment identity, `DB`/`BUCKET` bindings and MCP capability |
| `tests/` | Reusable regression checks |
| `vendor/` | Required stylesheet and its third-party license |

`dist/`, `.next/`, TypeScript build state and test outputs are generated and ignored. `.wrangler/state` holds local database/upload data: preserve it. Local env files, dependencies and runtime directories are excluded from Git; see [local data and migrations](docs/operations.md#local-data-and-migrations).

## Forks and publication

A GitHub fork contains source, tests and migrations. It does not contain the family's D1 records, R2 uploads, local env files, models or Python environment. Back those up separately through the relevant storage controls.

Hosted authentication depends on the Sites platform. To host a fork, create a separate Sites project through the supported Sites workflow. In the fork's `.openai/hosting.json`, replace `project_id` with that new project's ID while retaining `d1: "DB"`, `r2: "BUCKET"` and the `"mcp"` capability. Local development can use the existing manifest without deploying to its project. The original Site's identity and private access policy remain unchanged.

For hosted Mac processing, set `SITE_ORIGIN` in `scripts/facebook-recipe-local.mjs` to the fork's exact HTTPS origin. `http://localhost:5173` is already allowed for local development. Keep exact origin restrictions and the loopback listener; do not use a wildcard or expose the helper. [Hosted identity details](docs/operations.md#hosted-identity-and-sign-in) describe the reserved sign-in routes and membership boundary.

GitHub publication and Sites deployment are separate operations. Repository visibility and the original private Site's access policy are independent. No top-level project license has been selected, so do not describe this repository as open source or assume general reuse/redistribution permission. Retain [the vendored stylesheet notice](vendor/shadcn-tailwind-4.13.0.LICENSE.md) and [Sites plugin notice](scripts/vite/sites-vite-plugin.LICENSE). Older deployments may reference a legacy potato cover not included in this public snapshot; preserve or migrate that image separately when moving their data.

## References

- [Operations and limitations](docs/operations.md)
- [Vinext documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 guide](https://orm.drizzle.team/docs/get-started/d1-new)
