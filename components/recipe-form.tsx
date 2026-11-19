"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { CategoryFields } from "./category-fields.tsx";
import { buildCategoryCatalog, type Category } from "../lib/recipes/categories.ts";
import { RecipeImageField } from "./recipe-image-field.tsx";
import { useI18n } from "./language-provider.tsx";

import type {
  RecipeFormState,
  RecipeFormValues,
} from "../lib/recipes/form-state.ts";

type RecipeFormProps = {
  importJobId?: string;
  categories?: Category[];
  action: (
    state: RecipeFormState,
    formData: FormData,
  ) => Promise<RecipeFormState>;
  initialValues: RecipeFormValues;
  submitLabel: string;
  cancelHref: string;
};

function ErrorText({ message }: { message?: string }) {
  const { t } = useI18n();
  return message ? <p className="field-error">{t(message.includes("already exists") ? "duplicate" : "invalidFields")}</p> : null;
}

export function RecipeForm(props: RecipeFormProps) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(props.action, {
    revision: 0,
    values: props.initialValues,
    errors: {},
  });
  const [ingredients, setIngredients] = useState(props.initialValues.ingredients);
  const [steps, setSteps] = useState(props.initialValues.steps);
  const [categories, setCategories] = useState(props.categories ?? buildCategoryCatalog());
  const [cuisine, setCuisine] = useState(props.initialValues.cuisine);
  const [dishType, setDishType] = useState(props.initialValues.dishType);
  const [imageUrl, setImageUrl] = useState(props.initialValues.imageUrl);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setIngredients(state.values.ingredients.length ? state.values.ingredients : [""]);
    setSteps(state.values.steps.length ? state.values.steps : [""]);
  }, [state.revision, state.values.ingredients, state.values.steps]);

  const field = (name: keyof RecipeFormValues, label: string, type = "text") => (
    <label className="field-label">
      <span>{label}</span>
      <input
        className="field-control"
        defaultValue={state.values[name] as string}
        name={name}
        type={type}
      />
      <ErrorText message={state.errors[name]} />
    </label>
  );

  return (
    <form action={formAction} className="space-y-8" key={state.revision}>
      {props.importJobId && <input type="hidden" name="importJobId" value={props.importJobId} />}
      <RecipeImageField value={imageUrl} onChange={setImageUrl} onBusy={setUploading} />
      <section className="form-section">
        <div>
          <p className="eyebrow">{t("essentials")}</p>
          <h2 className="section-title">{t("nameDish")}</h2>
        </div>
        <div className="grid gap-5">
          {field("title", `${t("title")} *`)}
          <label className="field-label">
            <span>{t("description")}</span>
            <textarea className="field-control min-h-28" defaultValue={state.values.description} name="description" />
            <ErrorText message={state.errors.description} />
          </label>
          <CategoryFields catalog={categories} onCatalog={setCategories} cuisine={cuisine} dishType={dishType} onChange={(kind, value) => kind === "cuisine" ? setCuisine(value) : setDishType(value)} />
          {(state.errors.cuisine || state.errors.dishType) && <p className="field-error">{t("categoryRequired")}</p>}
        </div>
      </section>

      <section className="form-section">
        <div><p className="eyebrow">{t("atGlance")}</p><h2 className="section-title">{t("timing")}</h2></div>
        <div className="grid gap-5 sm:grid-cols-3">
          {field("servings", t("servings"))}
          {field("prepMinutes", t("prepMinutes"), "number")}
          {field("cookMinutes", t("cookMinutes"), "number")}
        </div>
      </section>

      <section className="form-section">
        <div><p className="eyebrow">{t("gather")}</p><h2 className="section-title">{t("ingredients")} *</h2></div>
        <div className="space-y-3">
          {ingredients.map((ingredient, index) => (
            <div className="flex gap-2" key={`${state.revision}-ingredient-${index}`}>
              <div className="flex-1">
                <input aria-label={t("ingredient", { number: index + 1 })} className="field-control" value={ingredient} onChange={(event) => setIngredients((rows) => rows.map((value, row) => row === index ? event.target.value : value))} name="ingredients" placeholder={t("ingredient", { number: index + 1 })} />
                <ErrorText message={state.errors[`ingredients.${index}`]} />
              </div>
              {ingredients.length > 1 && <button aria-label={t("removeIngredient", { number: index + 1 })} className="remove-row" onClick={() => setIngredients((rows) => rows.filter((_, row) => row !== index))} type="button">×</button>}
            </div>
          ))}
          <ErrorText message={state.errors.ingredients} />
          <button className="add-row" onClick={() => setIngredients((rows) => [...rows, ""])} type="button">{t("addIngredient")}</button>
        </div>
      </section>

      <section className="form-section">
        <div><p className="eyebrow">{t("method")}</p><h2 className="section-title">{t("steps")} *</h2></div>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div className="flex gap-3" key={`${state.revision}-step-${index}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e8f2ec] font-serif font-semibold text-[#24533d]">{index + 1}</span>
              <div className="flex-1">
                <textarea aria-label={t("step", { number: index + 1 })} className="field-control min-h-20" value={step} onChange={(event) => setSteps((rows) => rows.map((value, row) => row === index ? event.target.value : value))} name="steps" placeholder={t("step", { number: index + 1 })} />
                <ErrorText message={state.errors[`steps.${index}`]} />
              </div>
              {steps.length > 1 && <button aria-label={t("removeStep", { number: index + 1 })} className="remove-row" onClick={() => setSteps((rows) => rows.filter((_, row) => row !== index))} type="button">×</button>}
            </div>
          ))}
          <ErrorText message={state.errors.steps} />
          <button className="add-row" onClick={() => setSteps((rows) => [...rows, ""])} type="button">{t("addStep")}</button>
        </div>
      </section>

      <section className="form-section">
        <div><p className="eyebrow">{t("sourceTrail")}</p><h2 className="section-title">{t("sourceNotes")}</h2></div>
        <div className="grid gap-5">
          {field("sourceUrl", t("sourceUrl"), "url")}
          <div className="grid gap-5 sm:grid-cols-2">
            {field("sourcePlatform", t("sourcePlatform"))}
          </div>
          <label className="field-label"><span>{t("notes")}</span><textarea className="field-control min-h-28" defaultValue={state.values.notes} name="notes" /><ErrorText message={state.errors.notes} /></label>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link className="button-secondary" href={props.cancelHref}>{t("cancel")}</Link>
        <button className="button-primary" disabled={pending || uploading} type="submit">
          {pending ? t("saving") : props.submitLabel}
        </button>
      </div>
    </form>
  );
}
