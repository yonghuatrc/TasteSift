import Link from "next/link";
import { requireCurrentMember } from "../../lib/auth/current-member.ts";
import { notFound } from "next/navigation";
import { getLanguage } from "../../lib/language-server.ts";
import { translate } from "../../lib/i18n.ts";
import { listRecipes } from "../../lib/recipes/service.ts";
import { contentHash } from "../../lib/recipes/content.ts";
import { TranslationBatch } from "../../components/translation-batch.tsx";

export const dynamic = "force-dynamic";

export default async function InternalPage() {
  const current = await requireCurrentMember("/internal");
  if (current.membership.role !== "owner") notFound();
  const language = await getLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const recipes = await listRecipes({}, current.actor);
  const translationJobs = await Promise.all(recipes.map(async (recipe) => ({ id: recipe.id, title: recipe.title, sourceHash: await contentHash(recipe) })));
  return <main className="page-shell max-w-4xl"><p className="eyebrow">TasteSift · MVP 1.4</p><h1 className="section-title mt-3">{t("internal")}</h1><p className="mt-4 leading-7 text-[#68756d]">{t("internalHelp")}</p><div className="content-panel mt-8 flex flex-col items-start gap-4">
    <Link className="button-primary" href="/internal/video-worker">{t("macWorker")}</Link>
  </div><TranslationBatch recipes={translationJobs} /></main>;
}
