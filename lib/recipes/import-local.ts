import { parseRecipeInput, type RecipeInput } from "./model.ts";
import { isImportStage, type ImportStage } from "./import-progress.ts";
import type { Category } from "./categories.ts";
import { videoPlatform } from "./video-platform.mjs";

const HELPER = "http://127.0.0.1:18788";

export class LocalImportError extends Error {
  readonly key: "connectionError" | "timeoutError" | "interruptedError" | "processingError" | "helperUpdate" | "videoUnavailable" | "videoUnsupported" | "videoTooLong" | "noRecipeEvidence";
  constructor(key: LocalImportError["key"], message: string) { super(message); this.key = key; this.name = "LocalImportError"; }
}

export async function checkMacHelper(fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  try {
    const deadline = AbortSignal.timeout(60_000);
    const response = await fetcher(`${HELPER}/health`, { signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
    const health = await response.json() as { service?: string; videoPlatforms?: string[] } | null;
    if (!response.ok || health?.service !== "tastesift-facebook") throw new Error("Unexpected helper response");
    return health;
  } catch {
    signal?.throwIfAborted();
    throw new LocalImportError("connectionError", "无法连接这台 Mac 的视频助手。请确认助手已启动，并允许浏览器访问本机网络。");
  }
}

export async function importVideoOnMac(
  url: string,
  onConnected: (stage: ImportStage) => void,
  fetcher: typeof fetch = fetch,
  categories: Category[] = [],
  signal?: AbortSignal,
): Promise<RecipeInput> {
  const platform = videoPlatform(url);
  if (!platform) throw new LocalImportError("videoUnsupported", "请使用受支持平台的单条视频链接。");
  let endpoint = "/video-recipe";
  try {
    const health = await checkMacHelper(fetcher, signal);
    if (!health.videoPlatforms?.includes(platform)) {
      if (platform === "Facebook") endpoint = "/facebook-recipe";
      else throw new LocalImportError("helperUpdate", "请在 Mac 上重新启动更新后的 TasteSift 助手。");
    }
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof LocalImportError) throw error;
    throw new LocalImportError("connectionError", "无法连接这台 Mac 的视频助手。请确认助手已启动，并允许浏览器访问本机网络。");
  }

  onConnected("reading");
  try {
    const response = await fetcher(`${HELPER}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, stream: true, categories }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15 * 60_000)]) : AbortSignal.timeout(15 * 60_000),
    });
    let result: { recipe?: unknown; error?: string; code?: unknown } = {};
    if (response.headers.get("content-type")?.includes("application/x-ndjson") && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";
          if (done && pending) { lines.push(pending); pending = ""; }
          for (const line of lines.filter((item) => item.trim())) {
            const event = JSON.parse(line) as { stage?: unknown; recipe?: unknown; error?: string; code?: unknown };
            if (isImportStage(event.stage)) onConnected(event.stage);
            if (event.recipe || event.error) result = event;
            if (event.error) throw processingError(event);
          }
          if (done) break;
        }
      } finally { reader.releaseLock(); }
    } else result = await response.json() as typeof result;
    if (!response.ok || !result.recipe) throw processingError(result);
    try { const recipe = parseRecipeInput(result.recipe); onConnected("ready"); return recipe; }
    catch { throw new LocalImportError("processingError", "无法确认完整的食材和步骤，请核对视频内容后再试。"); }
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new LocalImportError("timeoutError", "视频处理超时。Mac 助手已连接，但下载、转录或本机 AI 耗时过长，请稍后重试。");
    }
    if (error instanceof TypeError) throw new LocalImportError("interruptedError", "与 Mac 助手的连接中断，请确认 Mac 保持开机且助手仍在运行。");
    throw error;
  }
}

function processingError(result: { code?: unknown; error?: string }): LocalImportError {
  const code = result.code;
  return new LocalImportError(code === "videoUnavailable" || code === "videoUnsupported" || code === "videoTooLong" || code === "noRecipeEvidence" ? code : "processingError", result.error || "无法读取这个视频。");
}

export const importFacebookOnMac = importVideoOnMac;
