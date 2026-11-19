import { RecipeForm } from "../../../../components/recipe-form.tsx";
import { requireCurrentMember } from "../../../../lib/auth/current-member.ts";
import { requireEditor } from "../../../../lib/auth/permissions.ts";
import { recipeFormValues } from "../../../../lib/recipes/form-state.ts";
import { getRecipe } from "../../../../lib/recipes/service.ts";
import { updateRecipeAction } from "../../actions.ts";
import { listCategoryCatalog } from "../../../../lib/recipes/category-store.ts";
import { getLanguage } from "../../../../lib/language-server.ts";
import { translate } from "../../../../lib/i18n.ts";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await requireCurrentMember(`/recipes/${id}/edit`);
  requireEditor(current.membership.role);
  const recipe = await getRecipe(id, current.actor);
  const categories = await listCategoryCatalog();
  const language = await getLanguage();
  return <main className="page-shell max-w-4xl"><h1 className="mt-2 font-serif text-4xl font-semibold text-[#173d2d] sm:text-5xl">{translate(language, "editRecipe")} · {recipe.title}</h1><p className="mt-3 leading-7 text-[#68756d]">{translate(language, "editOriginalHelp")}</p><div className="mt-8"><RecipeForm categories={categories} action={updateRecipeAction.bind(null, id)} cancelHref={`/recipes/${id}`} initialValues={recipeFormValues(recipe)} submitLabel={translate(language, "saveChanges")} /></div></main>;
}
