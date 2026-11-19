import Link from "next/link";

import { RecipeShelf } from "../components/recipe-shelf.tsx";
import { RecipeImporter } from "../components/recipe-importer.tsx";
import { requireCurrentMember } from "../lib/auth/current-member.ts";
import { listRecipes } from "../lib/recipes/service.ts";
import { controlsForRole } from "../lib/recipes/view-model.ts";
import { listCategoryCatalog } from "../lib/recipes/category-store.ts";
import { findCategory } from "../lib/recipes/categories.ts";
import { getLanguage } from "../lib/language-server.ts";
import { translate } from "../lib/i18n.ts";
import { listTranslationSnapshots } from "../lib/recipes/translation-store.ts";
import { TranslationShelfStatus } from "../components/recipe-translation.tsx";

export const dynamic = "force-dynamic";

type HomeProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function parameter(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const language = await getLanguage();
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(language, key, values);
  const query = parameter(params.q);
  const current = await requireCurrentMember("/");
  const categories = await listCategoryCatalog();
  const cuisine = findCategory(categories, "cuisine", parameter(params.cuisine))?.value ?? parameter(params.cuisine);
  const dishType = findCategory(categories, "dishType", parameter(params.dishType))?.value ?? parameter(params.dishType);
  const allRecipes = await listRecipes({}, current.actor);
  const snapshots = await listTranslationSnapshots(allRecipes);
  const translations = Object.fromEntries(Object.entries(snapshots).flatMap(([id, snapshot]) => snapshot.status === "ready" ? [[id, snapshot.translations]] : []));
  const incomplete = Object.entries(snapshots).filter(([, snapshot]) => snapshot.status !== "ready").map(([id, snapshot]) => ({ id, status: snapshot.status, sourceHash: snapshot.sourceHash }));
  const controls = controlsForRole(current.membership.role);
  const cuisines = [...new Set(allRecipes.map((recipe) => findCategory(categories, "cuisine", recipe.cuisine)?.value).filter((value): value is string => Boolean(value)))];
  const dishTypes = [...new Set(allRecipes.map((recipe) => findCategory(categories, "dishType", recipe.dishType)?.value).filter((value): value is string => Boolean(value)))];

  return (
    <main className="page-shell">
      {controls.canCreate && <RecipeImporter categories={categories} showMacWorker={current.membership.role === "owner"} />}
      <TranslationShelfStatus incomplete={incomplete} />
      <section className="mb-6 mt-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{t("kitchen")}</p>
          <h2 className="section-title mt-2">{t("shelf")}</h2>
          <p className="mt-2 text-sm text-[#68756d]">{t("recipeCount", { count: allRecipes.length })}</p>
        </div>
        {controls.canCreate && <Link className="button-secondary shrink-0" href="/recipes/new">{t("manualAdd")}</Link>}
      </section>
      <RecipeShelf key={JSON.stringify([query, cuisine, dishType])} recipes={allRecipes.map((recipe) => ({ ...recipe, translations: translations[recipe.id] }))} categories={categories} canCreate={controls.canCreate} query={query} cuisine={cuisine} dishType={dishType} cuisines={cuisines} dishTypes={dishTypes} />
      {current.membership.role === "owner" && <footer className="mt-12 text-right"><Link className="inline-flex min-h-11 items-center text-sm text-[#68756d] underline underline-offset-4" href="/internal">{t("internal")}</Link></footer>}
    </main>
  );
}
