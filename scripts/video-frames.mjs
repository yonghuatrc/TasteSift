import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { videoPlatform } from "../lib/recipes/video-platform.mjs";
import { runProcess, videoDownloadFlags, VideoSourceError } from "./video-extractor.mjs";
import { callLocalModel } from "./local-model.mjs";

export async function fetchVideoFrameEvidence(url, metadata, run = runProcess, fetcher = fetch, signal) {
  signal?.throwIfAborted();
  if (!videoPlatform(url)) throw new VideoSourceError("videoUnsupported", "不支持的视频链接。");
  const temporary = await mkdtemp(join(tmpdir(), "tastesift-frames-"));
  try {
    const info = join(temporary, "source.json");
    await writeFile(info, JSON.stringify(metadata.info || {}), { mode: 0o600 });
    const media = join(temporary, "video.media");
    await run(process.env.YT_DLP_PATH || "/opt/homebrew/bin/yt-dlp", [...videoDownloadFlags, "--load-info-json", info, "--quiet", "--no-progress", "--max-filesize", "200M", "-f", "bestvideo[width<=1280][height<=1280]/best[width<=1280][height<=1280]/best", "-o", "-"], { outputFile: media, maxFileBytes: 200 * 1024 * 1024, maxBuffer: 1_000_000, timeout: 180_000, signal });
    const { stdout } = await run(process.env.FFPROBE_PATH || "/opt/homebrew/bin/ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", media], { timeout: 15_000, maxBuffer: 100_000, signal });
    const probe = JSON.parse(stdout);
    const duration = Number(probe.format?.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 1800 || !probe.streams?.some((stream) => stream.codec_type === "video")) throw new VideoSourceError("noRecipeEvidence", "没有可核对的视频画面。");
    const framesDirectory = join(temporary, "frames"); await mkdir(framesDirectory);
    await run(process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg", ["-nostdin", "-v", "error", "-i", media, "-vf", `fps=1/${Math.max(1, duration / 36)},scale=960:960:force_original_aspect_ratio=decrease:force_divisible_by=2`, "-frames:v", "36", "-q:v", "5", join(framesDirectory, "frame_%03d.jpg")], { timeout: 120_000, maxBuffer: 100_000, signal });
    const files = (await readdir(framesDirectory)).filter((file) => /^frame_\d{3}\.jpg$/.test(file)).sort();
    if (!files.length || files.length > 36) throw new VideoSourceError("noRecipeEvidence", "没有可读取的画面。");
    const content = [{ type: "text", text: "Read these ordered frames from one cooking video. Copy readable cooking captions exactly, including amounts and units. Describe only visible actions. Ignore logos and music. Do not reconstruct a standard recipe." }];
    let bytes = 0;
    for (let index = 0; index < files.length; index++) {
      signal?.throwIfAborted();
      const file = join(framesDirectory, files[index]); const size = (await stat(file)).size; bytes += size;
      if (size > 512 * 1024 || bytes > 6 * 1024 * 1024) throw new VideoSourceError("noRecipeEvidence", "画面读取超过大小限制。");
      content.push({ type: "text", text: `Frame ${index}` });
      content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${(await readFile(file)).toString("base64")}` } });
    }
    const result = await callLocalModel(
      "You are collecting evidence from video frames, not writing a recipe. Return one observation per supplied frame number. In caption, copy only clearly readable cooking text exactly, preserving every number, fraction and unit. Ignore usernames, logos, background packaging and promotions. Use empty caption when unreadable. In action, describe only the visible cooking action in English. Never add quantities, durations or temperatures, and do not identify ambiguous white powders or liquids by appearance. Do not guess missing recipe details. Return JSON only.",
      content,
      { type: "object", properties: { observations: { type: "array", maxItems: files.length, items: { type: "object", properties: { frame: { type: "integer", minimum: 0, maximum: files.length - 1 }, caption: { type: "string" }, action: { type: "string" } }, required: ["frame", "caption", "action"], additionalProperties: false } } }, required: ["observations"], additionalProperties: false },
      6000, 240_000, fetcher, signal, 0,
    );
    return parseVideoFrameEvidence(result, files.length);
  } finally { await rm(temporary, { recursive: true, force: true }).catch(() => {}); }
}

export function parseVideoFrameEvidence(result, frameCount) {
  const sources = []; const seen = new Set();
  for (const item of (Array.isArray(result?.observations) ? result.observations : []).slice(0, 36).sort((a, b) => a.frame - b.frame)) {
    if (!Number.isInteger(item?.frame) || item.frame < 0 || item.frame >= frameCount || seen.has(item.frame)) continue;
    seen.add(item.frame);
    const caption = typeof item.caption === "string" ? item.caption.trim() : "";
    const action = typeof item.action === "string" ? item.action.trim() : "";
    if (caption && caption.length <= 1000) sources.push({ text: caption, kind: "caption" });
    if (/\b(?:a|an|another|some)\s+(?:[a-z]+\s+){1,3}of\b/i.test(action)) continue;
    if (action && action.length <= 600 && !/\d|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|half|halves|quarter|third|dozen|couple|double|triple|grams?|kilograms?|milliliters?|liters?|tablespoons?|teaspoons?|tbsp|tsp|cups?|ounces?|pounds?|minutes?|mins?|seconds?|secs?|hours?|hrs?|degrees?|celsius|fahrenheit)\b|[一二三四五六七八九十百千万两兩半]+\s*(?:汤匙|湯匙|茶匙|勺|杯|克|公斤|毫升|升|个|個|颗|顆|粒|块|塊|条|條)|分钟|分鐘|小时|小時|摄氏|攝氏|秒|度/i.test(action)) sources.push({ text: action, kind: "action" });
  }
  if (!sources.some((source) => source.kind === "caption")) throw new VideoSourceError("noRecipeEvidence", "画面没有足够清晰的食谱文字证据。");
  return sources;
}
