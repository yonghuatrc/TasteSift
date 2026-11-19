"use client";
import { useI18n } from "./language-provider.tsx";

export function DeleteRecipeButton({ action }: { action: () => Promise<void> }) {
  const { t } = useI18n();
  return (
    <form action={action} onSubmit={(event) => {
      if (!window.confirm(t("deleteConfirm"))) event.preventDefault();
    }}>
      <button className="button-danger w-full sm:w-auto" type="submit">{t("delete")}</button>
    </form>
  );
}
