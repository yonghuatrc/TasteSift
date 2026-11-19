"use client";
import Link from "next/link";
import { useI18n } from "./language-provider.tsx";

export function EmptyState({ canCreate }: { canCreate: boolean }) {
  const { t } = useI18n();
  return (
    <section className="rounded-[2rem] border border-dashed border-[#c8d8ce] bg-white/70 px-6 py-16 text-center shadow-sm">
      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[#e8f2ec] text-3xl">
        🍲
      </div>
      <h2 className="font-serif text-2xl font-semibold text-[#173d2d]">
        {t("emptyTitle")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#65736b]">
        {t("emptyHelp")}
      </p>
      {canCreate && (
        <Link className="button-primary mt-6 inline-flex" href="/recipes/new">
          {t("manualAdd")}
        </Link>
      )}
    </section>
  );
}
