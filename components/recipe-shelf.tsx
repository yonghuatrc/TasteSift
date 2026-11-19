"use client";

import { useState } from "react";
import type { RecipeWithTranslations } from "../lib/recipes/content.ts";
import type { Category } from "../lib/recipes/categories.ts";
import { matchesRecipeSearch } from "../lib/recipes/search.ts";
import { useI18n } from "./language-provider.tsx";
import { RecipeFilters } from "./recipe-filters.tsx";
import { RecipeCard } from "./recipe-card.tsx";
import { EmptyState } from "./empty-state.tsx";

export function RecipeShelf(props: { recipes: RecipeWithTranslations[]; categories: Category[]; canCreate: boolean; query: string; cuisine: string; dishType: string; cuisines: string[]; dishTypes: string[] }) {
  const { language, t } = useI18n();
  const [filters, setFilters] = useState({ text: props.query, cuisine: props.cuisine, dishType: props.dishType });
  const recipes = props.recipes.filter((recipe) => matchesRecipeSearch(recipe, filters, props.categories) || matchesRecipeSearch({ ...recipe, ...recipe.translations?.[language] }, filters, props.categories));
  const filtering = Boolean(filters.text.trim() || filters.cuisine || filters.dishType);
  return <>
    <RecipeFilters categories={props.categories} cuisines={props.cuisines} dishTypes={props.dishTypes} query={filters.text} cuisine={filters.cuisine} dishType={filters.dishType} onChange={(field, value) => setFilters((previous) => ({ ...previous, [field]: value }))} />
    {filtering && <p className="mt-4 text-sm text-[#68756d]" role="status">{t("matchCount", { count: recipes.length })}</p>}
    <div className="mt-7">
      {recipes.length ? <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("myRecipes")}>{recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} categories={props.categories} />)}</section> : filtering ? <section className="content-panel text-center"><h2 className="section-title">{t("noMatches")}</h2><p className="mt-3 leading-6 text-[#68756d]">{t("noMatchesHelp")}</p></section> : <EmptyState canCreate={props.canCreate} />}
    </div>
  </>;
}
