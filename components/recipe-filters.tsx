"use client";
import { useI18n } from "./language-provider.tsx";
import { categoryLabel, type Category } from "../lib/recipes/categories.ts";
import type { RecipeSearchQuery } from "../lib/recipes/search.ts";

type RecipeFiltersProps = {
  categories: Category[];
  query: string;
  cuisine: string;
  dishType: string;
  cuisines: string[];
  dishTypes: string[];
  onChange: (field: keyof RecipeSearchQuery, value: string) => void;
};

export function RecipeFilters(props: RecipeFiltersProps) {
  const { language, t } = useI18n();
  return (
    <form className="grid gap-3 rounded-2xl border border-[#dbe4de] bg-white p-3 shadow-sm sm:grid-cols-[1fr_180px_180px_auto]" method="get">
      <label className="sr-only" htmlFor="query">{t("search")}</label>
      <input
        className="field-control"
        value={props.query}
        onChange={(event) => props.onChange("text", event.target.value)}
        id="query"
        name="q"
        placeholder={t("searchHint")}
        type="search"
      />
      <label className="sr-only" htmlFor="cuisine">{t("cuisine")}</label>
      <select className="field-control" value={props.cuisine} onChange={(event) => props.onChange("cuisine", event.target.value)} id="cuisine" name="cuisine">
        <option value="">{t("allCuisines")}</option>
        {props.cuisines.map((value) => <option key={value} value={value}>{categoryLabel(props.categories, "cuisine", value, language)}</option>)}
      </select>
      <label className="sr-only" htmlFor="dishType">{t("dishType")}</label>
      <select className="field-control" value={props.dishType} onChange={(event) => props.onChange("dishType", event.target.value)} id="dishType" name="dishType">
        <option value="">{t("allTypes")}</option>
        {props.dishTypes.map((value) => <option key={value} value={value}>{categoryLabel(props.categories, "dishType", value, language)}</option>)}
      </select>
      <button className="button-secondary" type="submit">{t("filter")}</button>
    </form>
  );
}
