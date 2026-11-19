"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { createRecipeAction } from "../app/recipes/actions.ts";
import { importRecipeAction } from "../app/recipes/import-actions.ts";
import { recipeFormValues } from "../lib/recipes/form-state.ts";
import { ImportJobError, type VideoJob } from "../lib/recipes/import-jobs.ts";
import { beginRemoteSubmission, createRemoteImport, waitForRemoteImport } from "../lib/recipes/import-remote.ts";
import { importRoute } from "../lib/recipes/video-platform.mjs";
import type { RecipeInput } from "../lib/recipes/model.ts";
import type { BilingualContent } from "../lib/recipes/content.ts";
import { RecipeDetail } from "./recipe-detail.tsx";
import { RecipeForm } from "./recipe-form.tsx";
import { ImportProgress } from "./import-progress.tsx";
import { useI18n } from "./language-provider.tsx";
import type { ImportStage } from "../lib/recipes/import-progress.ts";
import { buildCategoryCatalog, findCategory, type Category } from "../lib/recipes/categories.ts";
import { CategoryFields } from "./category-fields.tsx";
import type { TranslationKey } from "../lib/i18n.ts";

export function RecipeReview({ recipe, translations, jobId, categories: initialCategories = buildCategoryCatalog() }: { recipe: RecipeInput; translations?: BilingualContent; jobId?: string; categories?: Category[] }) {
  const { language, t } = useI18n();
  const [categories, setCategories] = useState(initialCategories);
  const [cuisine, setCuisine] = useState(recipe.cuisine ?? "");
  const [dishType, setDishType] = useState(recipe.dishType ?? "");
  const reviewed = { ...recipe, cuisine: findCategory(categories, "cuisine", cuisine)?.value ?? null, dishType: findCategory(categories, "dishType", dishType)?.value ?? null };
  const values = recipeFormValues(reviewed);
  const [editing, setEditing] = useState(false);
  const [saved, saveAction, saving] = useActionState(createRecipeAction, {
    revision: 0, values, errors: {},
  });

  return (
    <section aria-labelledby="preview-title" className="mt-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">{t("preview")}</p><h2 className="section-title mt-2" id="preview-title">{t("previewTitle")}</h2></div>
        <span className="rounded-full border border-[#d6e3da] bg-[#e8f2ec] px-4 py-2 text-sm font-semibold text-[#24533d]">{t("unsaved")}</span>
      </div>
      <p className="mb-5 text-sm leading-6 text-[#68756d]">{t("reviewHelp")}</p>
      <p className="mb-5 text-sm text-[#345344]">{t(translations ? "preparedBilingual" : "prepareOnSave")}</p>
      {editing ? (
        <RecipeForm categories={categories} action={createRecipeAction} cancelHref="/" initialValues={values} submitLabel={t("confirmSave")} importJobId={jobId} />
      ) : (
        <>
          <RecipeDetail recipe={{ ...reviewed, ...translations?.[language] }} categories={categories} />
          <div className="content-panel mt-6"><CategoryFields catalog={categories} onCatalog={setCategories} cuisine={cuisine} dishType={dishType} onChange={(kind, value) => kind === "cuisine" ? setCuisine(value) : setDishType(value)} /></div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setEditing(true)} type="button">{t("editContent")}</button>
            <form action={saveAction}>
              {jobId && <input type="hidden" name="importJobId" value={jobId} />}
              {Object.entries(values).flatMap(([name, value]) =>
                (Array.isArray(value) ? value : [value]).map((item, index) => <input key={`${name}-${index}`} name={name} type="hidden" value={item} />),
              )}
              <button className="button-primary w-full" disabled={saving} type="submit">{t(saving ? "saving" : "confirmSave")}</button>
            </form>
          </div>
          {Object.keys(saved.errors).length > 0 && <p className="field-error mt-3" role="alert">{t(saved.errors.sourceUrl ? "duplicate" : "invalidFields")}</p>}
        </>
      )}
    </section>
  );
}

export function RecipeImporter({ categories: initialCategories = buildCategoryCatalog(), initialUrl = "", showMacWorker = false }: { categories?: Category[]; initialUrl?: string; showMacWorker?: boolean }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(importRecipeAction, {
    url: "", recipe: null, error: null, categories: initialCategories,
  });
  const [url, setUrl] = useState(initialUrl);
  const [categories, setCategories] = useState(initialCategories);
  const [localRecipe, setLocalRecipe] = useState<RecipeInput | null>(null);
  const [prepared, setPrepared] = useState<BilingualContent | undefined>();
  const [jobId, setJobId] = useState<string | undefined>();
  const [localError, setLocalError] = useState<TranslationKey | null>(null);
  const [localPending, setLocalPending] = useState(false);
  const [stage, setStage] = useState<ImportStage>("connecting");
  const [waitingMac, setWaitingMac] = useState(false);
  const active = useRef<AbortController | null>(null);
  const submission = useRef<{ status: VideoJob["status"] | null }>({ status: null });
  const busy = pending || localPending;
  const recipe = localRecipe ?? (state.url === url ? state.recipe : null);
  const error = localError ? t(localError) : state.url === url && state.error ? t("pageError") : null;

  function rememberJob(id: string | null) {
    const location = new URL(window.location.href);
    if (id) location.searchParams.set("import", id); else location.searchParams.delete("import");
    window.history.replaceState(null, "", location.href);
  }
  async function followJob(id: string, controller: AbortController) {
    try {
      const result = await waitForRemoteImport(id, (job) => { submission.current.status = job.status; setJobId(job.id); setPrepared(job.translations); setUrl(job.url); setStage(job.stage); setWaitingMac(job.status === "queued"); }, fetch, controller.signal);
      const catalogResponse = await fetch("/api/categories", { cache: "no-store", signal: controller.signal });
      if (!catalogResponse.ok) { setLocalError("categoryFailed"); return; }
      setCategories((await catalogResponse.json() as { categories: Category[] }).categories);
      setLocalRecipe(result);
    } catch (problem) {
      if (!controller.signal.aborted) setLocalError(problem instanceof ImportJobError ? problem.key : "queueFailed");
    } finally { if (active.current === controller) { active.current = null; setLocalPending(false); } }
  }
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("import");
    if (id && /^[a-f\d-]{36}$/i.test(id)) {
      const controller = new AbortController(); active.current = controller;
      setLocalPending(true); setWaitingMac(true);
      void followJob(id, controller);
    }
    return () => active.current?.abort();
  }, []);

  async function onImport(event: React.FormEvent<HTMLFormElement>) {
    const route = importRoute(url);
    if (route === "page") return;
    event.preventDefault();
    if (route === "unsupported") { setLocalRecipe(null); setLocalError("videoUnsupported"); return; }
    setLocalPending(true);
    setLocalError(null);
    setLocalRecipe(null);
    setPrepared(undefined); setJobId(undefined);
    setStage("connecting");
    setWaitingMac(true);
    const controller = new AbortController(); active.current?.abort(); active.current = controller;
    try {
      const remembered = new URL(window.location.href).searchParams.get("import");
      const id = beginRemoteSubmission(remembered, submission.current);
      rememberJob(id);
      const job = await createRemoteImport(url, fetch, controller.signal, id);
      await followJob(job.id, controller);
    } catch (problem) {
      if (!controller.signal.aborted) setLocalError(problem instanceof ImportJobError ? problem.key : "queueFailed");
      if (active.current === controller) { active.current = null; setLocalPending(false); }
    }
  }

  return (
    <>
      <section aria-labelledby="import-title" className="import-panel">
        <div className="max-w-2xl">
          <p className="eyebrow">{t("kitchen")}</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-[#173d2d] sm:text-6xl" id="import-title">{t("hero")}</h1>
          <p className="mt-4 text-base leading-7 text-[#68756d]">{t("heroHelp")}</p>
        </div>
        <form action={action} className="mt-7" onSubmit={onImport}>
          <label className="mb-2 block text-sm font-semibold text-[#345344]" htmlFor="recipe-url">{t("sourceLink")}</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input aria-describedby="import-help" aria-invalid={Boolean(error)} className="field-control min-w-0 flex-1" disabled={busy} id="recipe-url" name="url" onChange={(event) => { setUrl(event.target.value); setLocalRecipe(null); setLocalError(null); submission.current.status = null; rememberJob(null); }} placeholder="https://…" required type="url" value={url} />
            <button className="button-primary shrink-0" disabled={busy} type="submit">{t(busy ? "generating" : "generate")}</button>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#68756d]" id="import-help">{t("importHelp")}</p>
          {showMacWorker && <Link className="inline-block py-2 text-sm font-semibold text-[#24533d] underline" href="/internal/video-worker">{t("macWorker")}</Link>}
          {busy && <ImportProgress stage={localPending ? stage : "reading"} remote={localPending} waitingMac={localPending && waitingMac} />}
          {error && <div className="mt-4 rounded-xl border border-[#e4b8ae] bg-[#fff2ed] p-4 text-sm leading-6 text-[#8e4033]" role="alert">{error}<p className="mt-2"><Link className="font-semibold underline underline-offset-4" href="/recipes/new">{t("manualAdd")}</Link></p></div>}
        </form>
      </section>
      {recipe && !busy && <RecipeReview key={`${url}-${JSON.stringify(recipe)}`} recipe={recipe} translations={localRecipe ? prepared : undefined} jobId={localRecipe ? jobId : undefined} categories={localRecipe ? categories : state.categories} />}
    </>
  );
}
