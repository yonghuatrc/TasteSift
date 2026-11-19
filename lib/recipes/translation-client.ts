import type { TranslationSnapshot } from "./translation-store.ts";
import { waitForNextPoll } from "./import-remote.ts";

export class TranslationClientError extends Error {
  readonly key: "translationOffline" | "translationFailed" | "translationPending" | "translationStale";
  constructor(key: TranslationClientError["key"]) { super(key); this.key = key; this.name = "TranslationClientError"; }
}

export async function checkTranslationResponse(response: Response) {
  if (!response.ok) throw new TranslationClientError(response.status === 409 ? "translationStale" : "translationFailed");
  return response;
}

export async function observeRecipeTranslation(id: string, onUpdate: (snapshot: TranslationSnapshot) => void, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<void> {
  while (true) {
    signal?.throwIfAborted();
    let snapshot: TranslationSnapshot | undefined;
    try {
      const response = await checkTranslationResponse(await fetcher(`/api/recipes/${encodeURIComponent(id)}/translations`, { cache: "no-store", signal }));
      snapshot = await response.json() as TranslationSnapshot;
    } catch { signal?.throwIfAborted(); }
    if (snapshot) { onUpdate(snapshot); if (snapshot.status === "ready") return; }
    await waitForNextPoll(signal);
  }
}

export async function translateSavedRecipe(id: string, sourceHash: string, options: { retry?: boolean; signal?: AbortSignal } = {}, fetcher: typeof fetch = fetch): Promise<Extract<TranslationSnapshot, { status: "ready" }>> {
  const endpoint = `/api/recipes/${encodeURIComponent(id)}/translations`;
  const read = async () => (await checkTranslationResponse(await fetcher(endpoint, { cache: "no-store", signal: options.signal }))).json() as Promise<TranslationSnapshot>;
  let current = await read();
  if (current.sourceHash !== sourceHash) throw new TranslationClientError("translationStale");
  if (current.status === "ready") return current;
  if (current.status === "failed" && !options.retry) throw new TranslationClientError("translationFailed");
  if (current.status !== "pending") current = await (await checkTranslationResponse(await fetcher(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ retry: Boolean(options.retry), sourceHash }), signal: options.signal }))).json() as TranslationSnapshot;
  while (true) {
    options.signal?.throwIfAborted();
    if (current.sourceHash !== sourceHash || current.status === "missing") throw new TranslationClientError("translationStale");
    if (current.status === "ready") return current;
    if (current.status === "failed") throw new TranslationClientError("translationFailed");
    await waitForNextPoll(options.signal);
    current = await read();
  }
}
