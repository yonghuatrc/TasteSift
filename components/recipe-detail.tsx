"use client";
import Link from "next/link";

import type { Role } from "../lib/auth/roles.ts";
import type { RecipeInput } from "../lib/recipes/model.ts";
import { controlsForRole, recipeViewModel } from "../lib/recipes/view-model.ts";
import { DeleteRecipeButton } from "./delete-recipe-button.tsx";
import { useI18n } from "./language-provider.tsx";
import { buildCategoryCatalog, categoryLabel, type Category } from "../lib/recipes/categories.ts";
import { useRecipeTranslation, RecipeTranslationNotice } from "./recipe-translation.tsx";
import type { TranslationSnapshot } from "../lib/recipes/translation-store.ts";

export function RecipeDetail({ recipe: original, role = "viewer", deleteAction, categories = buildCategoryCatalog(), translation }: { recipe: RecipeInput & { id?: string }; role?: Role; deleteAction?: () => Promise<void>; categories?: Category[]; translation?: TranslationSnapshot }) {
  const { language, t } = useI18n();
  const controls = controlsForRole(role);
  const translated = useRecipeTranslation(original.id, translation, controls.canEdit);
  const recipe = { ...original, ...translated.content };
  const view = recipeViewModel(recipe);

  return (
    <article>
      {original.id && translation && <RecipeTranslationNotice status={translated.status} canTranslate={controls.canEdit} onRetry={translated.retry} />}
      <div className="overflow-hidden rounded-[2rem] border border-[#dbe4de] bg-white shadow-[0_20px_60px_rgba(29,57,44,0.1)]">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative min-h-72 bg-[linear-gradient(135deg,#dcecdf,#f8d6c8)] lg:min-h-[520px]">
            {recipe.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="absolute inset-0 h-full w-full object-cover" src={recipe.imageUrl} />
            ) : <div className="grid h-full min-h-72 place-items-center p-6 text-center"><div><span className="text-7xl" aria-hidden="true">🍲</span><p className="mt-4 text-sm text-[#68756d]">{t("missingImage")}</p></div></div>}
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
            <p className="eyebrow">{[categoryLabel(categories, "cuisine", recipe.cuisine, language), categoryLabel(categories, "dishType", recipe.dishType, language)].filter(Boolean).join(" · ") || t("recipe")}</p>
            <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.08] text-[#173d2d] sm:text-5xl">{recipe.title}</h1>
            {recipe.description && <p className="mt-5 text-base leading-7 text-[#647169]">{recipe.description}</p>}
            <dl className="mt-8 grid grid-cols-3 gap-3 border-y border-[#e2e9e4] py-5">
              <div><dt className="detail-label">{t("servings")}</dt><dd className="detail-value">{recipe.servings || t("unknown")}</dd></div>
              <div><dt className="detail-label">{t("prep")}</dt><dd className="detail-value">{recipe.prepMinutes == null ? t("unknown") : t("minutes", { count: recipe.prepMinutes })}</dd></div>
              <div><dt className="detail-label">{t("cook")}</dt><dd className="detail-value">{recipe.cookMinutes == null ? t("unknown") : t("minutes", { count: recipe.cookMinutes })}</dd></div>
            </dl>
            {recipe.sourceUrl && <a className="mt-6 inline-flex min-h-11 items-center font-semibold text-[#24533d] underline decoration-[#9db9a7] underline-offset-4" href={recipe.sourceUrl} rel="noreferrer" target="_blank">{t("viewSource")} · {recipe.sourcePlatform || t("sourceLink")} ↗</a>}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <section className="content-panel">
          <p className="eyebrow">{t("gather")}</p><h2 className="section-title mt-2">{t("ingredients")}</h2>
          <ul className="mt-6 divide-y divide-[#e4eae6]">
            {view.ingredients.map((ingredient, index) => <li className="flex gap-3 py-4 leading-6" key={`${index}-${ingredient}`}><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#e56b55]" />{ingredient}</li>)}
          </ul>
        </section>
        <section className="content-panel">
          <p className="eyebrow">{t("method")}</p><h2 className="section-title mt-2">{t("steps")}</h2>
          <ol className="mt-6 space-y-6">
            {view.steps.map((step, index) => <li className="grid grid-cols-[44px_1fr] gap-4" key={`${index}-${step}`}><span className="grid h-11 w-11 place-items-center rounded-full bg-[#e8f2ec] font-serif text-lg font-semibold text-[#24533d]">{index + 1}</span><p className="pt-2 leading-7 text-[#39473f]">{step}</p></li>)}
          </ol>
        </section>
      </div>

      {recipe.notes && <section className="content-panel mt-8"><p className="eyebrow">{t("notes")}</p><p className="mt-3 whitespace-pre-wrap leading-7 text-[#4f5d55]">{recipe.notes}</p></section>}
      {recipe.id && (controls.canEdit || controls.canDelete) && <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">{controls.canEdit && <Link className="button-secondary" href={`/recipes/${recipe.id}/edit`}>{t("editRecipe")}</Link>}{controls.canDelete && deleteAction && <DeleteRecipeButton action={deleteAction} />}</div>}
    </article>
  );
}
