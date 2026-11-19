"use client";
import Link from "next/link";

import type { RecipeWithTranslations } from "../lib/recipes/content.ts";
import { useI18n } from "./language-provider.tsx";
import { buildCategoryCatalog, categoryLabel, type Category } from "../lib/recipes/categories.ts";

export function RecipeCard({ recipe: original, categories = buildCategoryCatalog() }: { recipe: RecipeWithTranslations; categories?: Category[] }) {
  const { language, t } = useI18n();
  const recipe = { ...original, ...original.translations?.[language] };
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group overflow-hidden rounded-[1.6rem] border border-[#dbe4de] bg-white shadow-[0_12px_35px_rgba(29,57,44,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(29,57,44,0.14)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#e56b55]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(135deg,#dcecdf,#f8d6c8)]">
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            src={recipe.imageUrl}
          />
        ) : (
          <div className="grid h-full place-items-center text-6xl" aria-hidden="true">
            🍽️
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#24533d] backdrop-blur">
          {categoryLabel(categories, "dishType", recipe.dishType, language) || t("recipe")}
        </span>
      </div>
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d25c49]">
          {categoryLabel(categories, "cuisine", recipe.cuisine, language) || t("familyKitchen")}
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold leading-tight text-[#173d2d]">
          {recipe.title}
        </h2>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#69766f]">
          {recipe.description || t("recipeSummary", { ingredients: recipe.ingredients.length, steps: recipe.steps.length })}
        </p>
      </div>
    </Link>
  );
}
