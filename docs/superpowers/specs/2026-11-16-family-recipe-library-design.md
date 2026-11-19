# Family Recipe Library Design

## Intent

Build a private, mobile-friendly family recipe library. Dennis can send a public recipe or cooking-video link in ChatGPT, review the extracted recipe, and approve saving it. Family members can sign in to browse the shared library; only members Dennis explicitly promotes may add or edit recipes.

## Goals

- Work well on phone, tablet, and desktop browsers.
- Let Dennis import recipes through ChatGPT from publicly accessible Facebook, YouTube, TikTok, Instagram, and ordinary web pages.
- Normalize each source into a useful recipe: title, image when available, servings, times when known, ingredients, ordered steps, cuisine, dish type, notes, and original source link.
- Show the extracted recipe to Dennis for correction before saving it.
- Support search and filtering by cuisine and dish type.
- Give Dennis owner controls. Family members are viewers unless Dennis grants editor permission.
- Preserve the source and make uncertainty visible instead of inventing missing quantities or steps.

## Non-goals for the first version

- Grocery ordering, Instacart, shopping lists, meal planning, nutrition calculation, ratings, comments, or social feeds.
- Guaranteed extraction from private, login-only, paywalled, removed, or platform-blocked content.
- Native iOS or Android apps. The responsive website is the mobile experience.
- Automatic saving without Dennis reviewing the extracted result.

## Constraints and source fallback

- A public URL is accepted regardless of platform. ChatGPT uses the best available source: page recipe markup or text first, then captions/transcript, then visible or spoken video content.
- If the source cannot be accessed or does not state enough detail, ChatGPT asks for screenshots, copied text, or the video file.
- Unknown quantities, times, or servings remain explicitly unknown. They are not guessed.
- The original URL and platform are stored with every imported recipe.

## Approaches considered

### 1. Private family Site with ChatGPT import — selected

Use a server-backed private Site, hosted authentication, D1 storage, and a small Site MCP tool surface. ChatGPT performs source extraction, presents the normalized recipe for approval, then calls the Site tool to save it. This directly matches the desired workflow and keeps extraction logic out of the browser UI.

### 2. Public or secret-link static site

This is simpler to host but cannot safely enforce owner, viewer, and editor permissions or synchronize durable data across devices. Rejected.

### 3. Website-only importer

Users paste every link into the website, which then owns all platform extraction. This duplicates capabilities already available in ChatGPT, makes video extraction harder, and does not match Dennis's preferred “send the link to you” workflow. Rejected for the first version.

## User roles and authorization

- **Owner (Dennis):** view, add, edit, delete, and manage member roles.
- **Editor:** view, add, and edit. Cannot delete recipes or change permissions.
- **Viewer:** view, search, and filter only.
- Family access is invitation-only. Dennis invites a person; that person enters as a viewer and can be promoted to editor later. There is no open registration into the household.
- On initial setup, the still-owner-private Site is opened by Dennis once to establish the sole owner membership before any family invitations are enabled.
- Every write is authorized on the server using the signed-in Site identity. Hiding buttons is not treated as authorization.
- The Site remains private. Authentication establishes identity; membership and role checks establish access inside the app.

## Main experience

### Recipe library

- A compact mobile-first header with the household cookbook name, search, and account access.
- Recipe cards show image, title, cuisine, dish type, and key time/serving facts when known.
- Filters allow cuisine (for example Chinese, Western, Indian, Malay) and dish type (for example snack, main, dessert, soup, drink).
- Search covers recipe title and ingredients.
- Empty and no-result states explain what to do next.

### Recipe detail

- Image and title, followed by source, cuisine, dish type, servings, and known times.
- Ingredients are a readable checklist-style list; steps are numbered and ordered.
- Notes identify missing or uncertain information.
- Owner/editor controls appear only when authorized. Delete remains owner-only and requires confirmation.

### Add and edit

- Owner and editors can add or edit a recipe through a straightforward form.
- Required fields: title, at least one ingredient, and at least one step.
- Optional fields stay optional rather than accepting invented defaults.
- Cuisine and dish type are separate classifications so a recipe can be both “Chinese” and “snack.”

### Family access

- The owner can see current members and change a member between viewer and editor.
- A member cannot promote themselves or another member.
- New family members enter as viewers.

### ChatGPT import flow

1. Dennis sends a recipe URL in ChatGPT.
2. ChatGPT reads the accessible source and extracts a normalized recipe.
3. ChatGPT displays the proposed recipe and flags unknown or uncertain fields.
4. Dennis corrects it or approves it.
5. Only after approval, ChatGPT calls the Site's save tool.
6. The saved recipe is immediately visible in the shared library.

The initial MCP surface stays deliberately small: a read tool for checking duplicates/searching recipes and a write tool for saving an owner-approved recipe. The write tool validates required fields and owner/editor authorization server-side.

Sites authenticates MCP requests before they reach the app and forwards the caller's Site-scoped identity. The MCP endpoint uses that identity for the same membership and role checks as the website; it does not rely on browser state or a caller-supplied user ID.

## Data ownership

- D1 stores structured records; browser storage is used only for harmless device preferences.
- Core records are members and recipes.
- A recipe stores title, description/notes, source URL and platform, image URL when usable, servings and times when known, cuisine, dish type, ingredients, ordered steps, creator identity, and timestamps.
- Duplicate checking uses the normalized source URL first, then title as a warning only. Dennis decides whether a similar recipe should still be saved.

## Failure handling

- Invalid or inaccessible links produce a clear request for the missing source material.
- Extraction uncertainty is shown before save.
- Duplicate source URLs are blocked from accidental second saves, with the existing recipe identified.
- Validation errors return field-specific messages without losing entered content.
- Authorization failures reveal no private recipe data.

## Acceptance criteria

1. An authenticated owner can add, edit, and delete a recipe; a viewer cannot perform any write even by calling the endpoint directly.
2. The owner can grant editor access, after which that member can add and edit but cannot delete or manage roles.
3. A recipe saved through the approved ChatGPT import tool appears in the website library with its ingredients, ordered steps, classifications, and source link intact.
4. Search by title or ingredient and filters by cuisine and dish type return the expected recipes.
5. The library and recipe detail remain usable at a typical phone viewport and on desktop.
6. A duplicate source URL is detected before creating a second record.
7. Missing optional facts remain visibly unknown; the system does not manufacture values.

## Builder decisions still allowed

- Exact colors, typography, cookbook name, and small layout details, while keeping a warm, readable family-cookbook feel.
- The smallest schema and component structure that satisfies the acceptance criteria.
- Sensible starter categories while still allowing future recipe values that are not in the starter list.
