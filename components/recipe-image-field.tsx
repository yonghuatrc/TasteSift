"use client";

import { useState } from "react";
import { useI18n } from "./language-provider.tsx";
import { MAX_IMAGE_BYTES, clipboardImage } from "../lib/recipes/images.ts";
import type { TranslationKey } from "../lib/i18n.ts";

export function RecipeImageField({ value, onChange, onBusy }: { value: string; onChange: (value: string) => void; onBusy: (busy: boolean) => void }) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [broken, setBroken] = useState(false);
  async function upload(file: File | undefined) {
    if (!file || uploading) return;
    if (file.size > MAX_IMAGE_BYTES) { setError("imageTooLarge"); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("imageInvalid"); return; }
    setUploading(true); onBusy(true); setError(null);
    try {
      if (typeof createImageBitmap === "function") { const bitmap = await createImageBitmap(file); bitmap.close(); }
      const form = new FormData(); form.set("image", file);
      const response = await fetch("/api/recipe-images", { method: "POST", body: form });
      const result = await response.json() as { imageUrl?: string; error?: string };
      if (!response.ok || !result.imageUrl) {
        setError(result.error === "imageTooLarge" ? "imageTooLarge" : result.error === "imageInvalid" ? "imageInvalid" : "uploadFailed");
        return;
      }
      onChange(result.imageUrl); setBroken(false);
    } catch { setError("uploadFailed"); }
    finally { setUploading(false); onBusy(false); }
  }
  return <section className="form-section">
    <h2 className="section-title">{t("cover")}</h2>
    <div role="group" tabIndex={0} aria-label={t("pasteImage")} aria-busy={uploading} className="rounded-2xl border-2 border-dashed border-[#b9cebf] p-4 focus-visible:outline focus-visible:outline-3 focus-visible:outline-[#24533d]" onClick={(event) => event.currentTarget.focus()} onPaste={(event) => { const image = clipboardImage(event.clipboardData); if (image) { event.preventDefault(); void upload(image); } }}>
      {value && !broken ? <img className="max-h-64 w-full rounded-2xl object-contain bg-[#edf2ed]" alt={t("cover")} src={value} onError={() => setBroken(true)} /> : <p className="rounded-2xl bg-[#edf2ed] p-6 text-sm text-[#68756d]">{t("missingImage")}</p>}
      <p className="mt-3 text-center text-sm font-semibold text-[#24533d]">{t("pasteImage")}</p>
      <p className="mt-1 text-center text-xs leading-5 text-[#68756d]">{t("pasteImageHelp")}</p>
    </div>
    <label className="field-label"><span>{t("upload")}</span><input className="field-control" accept="image/jpeg,image/png,image/webp" type="file" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} /></label>
    <p className="text-sm leading-6 text-[#68756d]" role="status">{t(uploading ? "uploading" : "uploadHelp")}</p>
    {error && <p className="field-error" role="alert">{t(error)}</p>}
    <details><summary className="cursor-pointer text-sm font-semibold text-[#24533d]">{t("imageUrl")}</summary><input className="field-control mt-3" aria-label={t("imageUrl")} value={value} onChange={(event) => { onChange(event.target.value); setBroken(false); }} /></details>
    <input name="imageUrl" type="hidden" value={value} />
  </section>;
}
