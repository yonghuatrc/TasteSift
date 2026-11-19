import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentMember } from "../../../lib/auth/current-member.ts";
import { getLanguage } from "../../../lib/language-server.ts";
import { translate } from "../../../lib/i18n.ts";
import { MacImportWorker } from "../../../components/mac-import-worker.tsx";

export const dynamic = "force-dynamic";
export default async function VideoWorkerPage() {
  const current = await requireCurrentMember("/internal/video-worker");
  if (current.membership.role !== "owner") notFound();
  const language = await getLanguage();
  return <main className="page-shell max-w-4xl"><h1 className="section-title">{translate(language, "macWorker")}</h1><MacImportWorker /><Link className="button-secondary mt-6" href="/">{translate(language, "myRecipes")}</Link></main>;
}
