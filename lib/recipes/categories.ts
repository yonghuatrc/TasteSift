import type { RecipeInput } from "./model.ts";
import type { Language } from "../i18n.ts";

export type CategoryKind = "cuisine" | "dishType";
export type Category = { value: string; kind: CategoryKind; labelZh: string; labelEn: string; aliases: string[] };

const initial: [CategoryKind, string, string, string, ...string[]][] = [
  ["cuisine", "中餐", "中餐", "Chinese", "Chinese cuisine"],
  ["cuisine", "Western", "西餐", "Western"],
  ["cuisine", "中餐 · 粤菜", "粤菜", "Cantonese", "粤菜", "Chinese · Cantonese"],
  ["cuisine", "印度餐", "印度餐", "Indian", "Indian cuisine"],
  ["cuisine", "马来餐", "马来餐", "Malay", "Malay cuisine"],
  ["cuisine", "新加坡菜", "新加坡菜", "Singaporean"],
  ["dishType", "Mains", "主菜", "Mains", "Main", "Main course"],
  ["dishType", "点心 / 蒸菜", "点心／蒸菜", "Dim sum / steamed dishes", "点心", "Dim sum"],
  ["dishType", "小吃", "小吃", "Snacks", "Snack"],
  ["dishType", "甜品", "甜品", "Desserts", "Dessert"],
  ["dishType", "蒸菜", "蒸菜", "Steamed dishes"],
  ["dishType", "汤", "汤", "Soups", "Soup"],
  ["dishType", "饮品", "饮品", "Drinks", "Drink"],
  ["dishType", "酱料", "酱料", "Sauces", "Sauce", "Condiment"],
];

export function isBuiltInCategory(category: Category): boolean {
  return initial.some(([kind, value]) => kind === category.kind && value === category.value);
}

function legacyEnglishLabel(value: string): string { return value === "素食料理" ? "Vegetarian" : value; }

export function categoryKey(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[\s·/／._-]+/g, "");
}

export function findCategory(catalog: Category[], kind: CategoryKind, value: string | null | undefined): Category | undefined {
  if (!value?.trim()) return undefined;
  const key = categoryKey(value);
  return catalog.find((category) => category.kind === kind && [category.value, category.labelZh, category.labelEn, ...category.aliases].some((alias) => categoryKey(alias) === key));
}

export function buildCategoryCatalog(custom: Category[] = [], records: { cuisine?: string | null; dishType?: string | null }[] = []): Category[] {
  const catalog: Category[] = initial.map(([kind, value, labelZh, labelEn, ...aliases]) => ({ kind, value, labelZh, labelEn, aliases }));
  for (const category of custom) {
    const existing = catalog.find((item) => item.kind === category.kind && item.value === category.value);
    if (existing) {
      existing.aliases = [...new Set([...existing.aliases, existing.labelZh, existing.labelEn, ...category.aliases])];
      existing.labelZh = category.labelZh;
      existing.labelEn = category.labelEn;
    } else catalog.push({ ...category, labelEn: category.labelEn === category.labelZh ? legacyEnglishLabel(category.labelZh) : category.labelEn, aliases: [...category.aliases] });
  }
  for (const record of records) for (const kind of ["cuisine", "dishType"] as const) {
    const value = record[kind];
    if (!value?.trim()) continue;
    const existing = findCategory(catalog, kind, value);
    if (existing) { if (!existing.aliases.includes(value)) existing.aliases.push(value); }
    else catalog.push({ kind, value, labelZh: value, labelEn: legacyEnglishLabel(value), aliases: [] });
  }
  return catalog;
}

export function categoryLabel(catalog: Category[], kind: CategoryKind, value: string | null | undefined, language: Language): string {
  const category = findCategory(catalog, kind, value);
  return category ? language === "en" ? category.labelEn : category.labelZh : value || "";
}

export class CategoryError extends Error {
  readonly field: CategoryKind;
  constructor(field: CategoryKind) { super(`Please select or confirm the ${field} category`); this.name = "CategoryError"; this.field = field; }
}

export function resolveRecipeCategories<T extends RecipeInput>(recipe: T, catalog: Category[]): T {
  const result = { ...recipe };
  for (const kind of ["cuisine", "dishType"] as const) {
    if (!recipe[kind]?.trim()) continue;
    const category = findCategory(catalog, kind, recipe[kind]);
    if (!category) throw new CategoryError(kind);
    result[kind] = category.value;
  }
  return result;
}

export function existingCategoryForNames(catalog: Category[], kind: CategoryKind, labelZh: string, labelEn: string): Category | undefined {
  const zh = findCategory(catalog, kind, labelZh);
  const en = findCategory(catalog, kind, labelEn);
  if (zh && en && zh.value !== en.value) throw new Error("Names belong to different categories");
  return zh ?? en;
}
