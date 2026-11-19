import { parseRecipeInput } from "./model.ts";
import { ImportJobError, videoJobErrors, type VideoJob } from "./import-jobs.ts";

export function beginRemoteSubmission(rememberedId: string | null, state: { status: VideoJob["status"] | null }) {
  const id = state.status !== "failed" && rememberedId && /^[a-f\d-]{36}$/i.test(rememberedId) ? rememberedId : crypto.randomUUID();
  state.status = "queued";
  return id;
}

export async function readVideoImportResponse(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: unknown };
    throw new ImportJobError(videoJobErrors.find((key) => key === body.error) ?? "queueFailed");
  }
  return response;
}

export function waitForNextPoll(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
    const timer = setTimeout(finish, 2000);
    const abort = () => { clearTimeout(timer); reject(signal?.reason); };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function createRemoteImport(url: string, fetcher: typeof fetch = fetch, signal?: AbortSignal, id = crypto.randomUUID()): Promise<VideoJob> {
  const response = await readVideoImportResponse(await fetcher("/api/video-imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, url }), signal }));
  return response.json() as Promise<VideoJob>;
}

export async function waitForRemoteImport(id: string, onUpdate: (job: VideoJob) => void, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  while (true) {
    signal?.throwIfAborted();
    const response = await readVideoImportResponse(await fetcher(`/api/video-imports/${encodeURIComponent(id)}`, { cache: "no-store", signal }));
    const job = await response.json() as VideoJob;
    onUpdate(job);
    if (job.status === "failed") throw new ImportJobError(job.error ?? "queueFailed");
    if (job.status === "ready") return parseRecipeInput(job.recipe);
    await waitForNextPoll(signal);
  }
}
