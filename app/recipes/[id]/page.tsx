import { RecipeDetail } from "../../../components/recipe-detail.tsx";
import { requireCurrentMember } from "../../../lib/auth/current-member.ts";
import { getRecipe, RecipeNotFoundError } from "../../../lib/recipes/service.ts";
import { notFound } from "next/navigation";
import { deleteRecipeAction } from "../actions.ts";
import { listCategoryCatalog } from "../../../lib/recipes/category-store.ts";
import { translationSnapshot } from "../../../lib/recipes/translation-store.ts";

export const dynamic = "force-dynamic";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await requireCurrentMember(`/recipes/${id}`);
  const recipe = await getRecipe(id, current.actor).catch((error: unknown) => {
    if (error instanceof RecipeNotFoundError) notFound();
    throw error;
  });
  return <main className="page-shell"><RecipeDetail translation={await translationSnapshot(recipe)} categories={await listCategoryCatalog()} deleteAction={deleteRecipeAction.bind(null, id)} recipe={recipe} role={current.membership.role} /></main>;
}
