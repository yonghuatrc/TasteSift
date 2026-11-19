import { RecipeForm } from "../../../components/recipe-form.tsx";
import { requireCurrentMember } from "../../../lib/auth/current-member.ts";
import { requireEditor } from "../../../lib/auth/permissions.ts";
import { emptyRecipeForm } from "../../../lib/recipes/form-state.ts";
import { createRecipeAction } from "../actions.ts";
import { listCategoryCatalog } from "../../../lib/recipes/category-store.ts";
import { getLanguage } from "../../../lib/language-server.ts";
import { translate } from "../../../lib/i18n.ts";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  const current = await requireCurrentMember("/recipes/new");
  requireEditor(current.membership.role);
  const categories = await listCategoryCatalog();
  const language = await getLanguage();
  return <main className="page-shell max-w-4xl"><h1 className="mt-2 font-serif text-4xl font-semibold text-[#173d2d] sm:text-5xl">{translate(language, "newRecipe")}</h1><p className="mt-3 text-[#68756d]">{translate(language, "formHelp")}</p><div className="mt-8"><RecipeForm categories={categories} action={createRecipeAction} cancelHref="/" initialValues={emptyRecipeForm} submitLabel={translate(language, "save")} /></div></main>;
}
