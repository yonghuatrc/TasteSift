"use client";

import { useState } from "react";
import { useI18n } from "./language-provider.tsx";
import { categoryLabel, findCategory, type Category, type CategoryKind } from "../lib/recipes/categories.ts";

function CategorySelect({ kind, value, catalog, onChange, onCatalog }: { kind: CategoryKind; value: string; catalog: Category[]; onChange: (value: string) => void; onCatalog: (categories: Category[]) => void }) {
  const { language, t } = useI18n();
  const matched = findCategory(catalog, kind, value);
  const [adding, setAdding] = useState(false);
  const [zh, setZh] = useState("");
  const [en, setEn] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function addCategory() {
    if (!zh.trim() || !en.trim()) { setError(true); return; }
    setPending(true); setError(false);
    try {
      const response = await fetch("/api/categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, labelZh: zh, labelEn: en }) });
      const result = await response.json() as { category?: Category; categories?: Category[] };
      if (!response.ok || !result.category || !result.categories) throw new Error();
      onCatalog(result.categories); onChange(result.category.value); setAdding(false); setZh(""); setEn("");
    } catch { setError(true); } finally { setPending(false); }
  }
  return <div className="space-y-2">
    <label className="field-label"><span>{t(kind)}</span><select name={kind} className="field-control" value={matched?.value ?? ""} onChange={(event) => { if (event.target.value === "__new") { setAdding(true); setZh(value); } else { onChange(event.target.value); setAdding(false); } }}>
      <option value="">{t("chooseCategory")}</option>
      {catalog.filter((category) => category.kind === kind).map((category) => <option key={category.value} value={category.value}>{categoryLabel(catalog, kind, category.value, language)}</option>)}
      <option value="__new">{t("newCategory")}</option>
    </select></label>
    {value && !matched && <p className="text-sm leading-6 text-[#68756d]">{t("categorySuggestion", { name: value })}</p>}
    {adding && <div className="space-y-3 rounded-xl border border-[#d6e3da] bg-[#f4f7f3] p-3">
      <label className="field-label"><span>{t("nameZh")}</span><input className="field-control" maxLength={60} value={zh} onChange={(event) => setZh(event.target.value)} /></label>
      <label className="field-label"><span>{t("nameEn")}</span><input className="field-control" maxLength={60} value={en} onChange={(event) => setEn(event.target.value)} /></label>
      <button className="button-secondary" type="button" disabled={pending} onClick={addCategory}>{t(pending ? "saving" : "confirmCategory")}</button>
    </div>}
    {error && <p className="field-error" role="alert">{t("categoryFailed")}</p>}
  </div>;
}

export function CategoryFields({ catalog, cuisine, dishType, onChange, onCatalog }: { catalog: Category[]; cuisine: string; dishType: string; onChange: (kind: CategoryKind, value: string) => void; onCatalog: (categories: Category[]) => void }) {
  return <div className="grid gap-5 sm:grid-cols-2">
    <CategorySelect kind="cuisine" value={cuisine} catalog={catalog} onChange={(value) => onChange("cuisine", value)} onCatalog={onCatalog} />
    <CategorySelect kind="dishType" value={dishType} catalog={catalog} onChange={(value) => onChange("dishType", value)} onCatalog={onCatalog} />
  </div>;
}
