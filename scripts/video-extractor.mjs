import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { videoPlatform } from "../lib/recipes/video-platform.mjs";
import { parseVideoCaptions } from "./video-captions.mjs";

const execute = promisify(execFile);
const YTDLP = process.env.YT_DLP_PATH || "/opt/homebrew/bin/yt-dlp";
const FFMPEG = process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "/opt/homebrew/bin/ffprobe";
const PYTHON = process.env.WHISPER_PYTHON || join(homedir(), ".hermes/venvs/video-knowledge-extraction/bin/python");
const TRANSCRIBE = fileURLToPath(new URL("../../Video Knowledge Extraction/server/transcribe_audio.py", import.meta.url));
const FLAGS = ["--ignore-config", "--no-warnings", "--no-playlist", "--use-extractors", "default,-generic", "--socket-timeout", "15", "--retries", "1", "--extractor-retries", "1"];
export { FLAGS as videoDownloadFlags };

export async function runProcess(command, args, options) {
  const { outputFile, maxFileBytes, ...processOptions } = options;
  processOptions.signal?.throwIfAborted();
  if (!outputFile) {
    const task = execute(command, args, processOptions);
    const closed = new Promise((resolve) => task.child.once("close", resolve));
    try { return await task; }
    catch (error) { task.child.kill("SIGKILL"); await closed; throw error; }
  }
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], signal: processOptions.signal, killSignal: "SIGKILL" });
  const closed = new Promise((resolve) => child.once("close", resolve));
  const timer = setTimeout(() => child.kill("SIGKILL"), processOptions.timeout);
  let stderr = "";
  let bytes = 0;
  child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-4000); });
  const exit = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Video download failed (${code}): ${stderr}`)));
  });
  const transfer = pipeline(child.stdout, new Transform({ transform(chunk, _encoding, done) {
    bytes += chunk.length;
    if (bytes > maxFileBytes) done(new Error("Video download byte limit exceeded"));
    else done(null, chunk);
  } }), createWriteStream(outputFile, { flags: "wx", mode: 0o600 }));
  try { await Promise.all([exit, transfer]); return { stdout: "", stderr }; }
  catch (error) { child.kill("SIGKILL"); await Promise.allSettled([exit, transfer, closed]); throw error; }
  finally { clearTimeout(timer); }
}

export class VideoSourceError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function requireVideo(url) {
  const platform = videoPlatform(url);
  if (!platform) throw new VideoSourceError("videoUnsupported", "请输入受支持平台的单条公开视频或贴文链接。");
  return platform;
}

export async function resolveVideoUrl(value, fetcher = fetch, signal) {
  signal?.throwIfAborted();
  const platform = requireVideo(value);
  let url = new URL(value);
  for (let count = 0; count < 5; count++) {
    if (videoPlatform(url.href) !== platform) throw new VideoSourceError("videoUnavailable", "分享链接跳转到不受支持的地址。Invalid redirect.");
    const host = url.hostname.replace(/^www\./, "");
    const short = ["fb.watch", "vm.tiktok.com", "vt.tiktok.com", "xhslink.com"].includes(host) || host === "facebook.com" && /^\/share\/[rv]\//.test(url.pathname) || host === "tiktok.com" && /^\/t\//.test(url.pathname);
    if (!short) {
      if (["xiaohongshu.com", "tiktok.com"].includes(url.hostname)) url.hostname = `www.${url.hostname}`;
      return url.href;
    }
    const deadline = AbortSignal.timeout(15_000);
    const response = await fetcher(url.href, { redirect: "manual", signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
    await response.body?.cancel();
    const location = response.headers.get("location");
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) throw new VideoSourceError("videoUnavailable", "无法打开分享链接，请复制原始视频链接。");
    url = new URL(location, url);
  }
  throw new VideoSourceError("videoUnavailable", "分享链接跳转次数太多。");
}

export async function fetchVideoMetadata(url, run = runProcess, signal) {
  const platform = requireVideo(url);
  let info;
  try {
    const { stdout } = await run(YTDLP, [...FLAGS, "--skip-download", "--ignore-no-formats-error", "--dump-single-json", "--", url], { timeout: 60_000, maxBuffer: 8_000_000, signal });
    info = JSON.parse(stdout);
  } catch { signal?.throwIfAborted(); throw new VideoSourceError("videoUnavailable", "平台暂时无法提供这条公开视频或贴文。"); }
  if (!info || typeof info !== "object" || Array.isArray(info)) throw new VideoSourceError("videoUnavailable", "平台没有返回可读取的来源内容。");
  const textOnly = platform === "Instagram" && (info._type === "playlist" || Boolean(info.entries));
  if (!textOnly && (info._type === "playlist" || info.entries)) throw new VideoSourceError("videoUnsupported", "请使用单条视频链接。Single video required.");
  if (info.is_live || ["is_live", "is_upcoming", "post_live"].includes(info.live_status)) throw new VideoSourceError("videoUnsupported", "暂不处理直播。Live streams are unsupported.");
  if (Number(info.duration) > 1800) throw new VideoSourceError("videoTooLong", "视频超过 30 分钟，请使用较短的单条视频。");
  const metadata = {
    title: String(info.title || "").trim().slice(0, 200),
    creator: String(info.uploader || info.channel || info.creator || info.uploader_id || "").trim(),
    thumbnail: String(info.thumbnail || info.thumbnails?.at(-1)?.url || ""),
    duration: Math.max(0, Number(info.duration) || 0),
  };
  return { ...metadata, platform, textOnly, info, description: String(info.description || "").trim().slice(0, 16_000), language: String(info.language || ""), captionLanguages: [...new Set([...Object.keys(info.subtitles || {}), ...Object.keys(info.automatic_captions || {})])] };
}

export async function fetchVideoTranscript(url, metadata, run = runProcess, signal) {
  signal?.throwIfAborted();
  requireVideo(url);
  if (metadata.duration > 1800) throw new VideoSourceError("videoTooLong", "视频超过 30 分钟。");
  if (metadata.textOnly) throw new VideoSourceError("noRecipeEvidence", "这条图文贴文没有可读取的音轨。");
  const temporary = await mkdtemp(join(tmpdir(), "tastesift-video-"));
  try {
    const infoFile = join(temporary, "source.json");
    await writeFile(infoFile, JSON.stringify(metadata.info || {}), { mode: 0o600 });
    const source = ["--load-info-json", infoFile];
    const languages = (metadata.captionLanguages || []).filter((value) => /^[a-z]{2,3}(?:[-_][a-z0-9]{1,12}){0,3}$/i.test(value));
    const language = languages.find((value) => value === metadata.language) || languages.find((value) => /^(?:zh|en)(?:-|$)/.test(value)) || languages[0];
    if (language) {
      try {
        await run(YTDLP, [...FLAGS, ...source, "--ignore-no-formats-error", "--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", language, "--sub-format", "vtt/srt/best", "-o", join(temporary, "captions.%(ext)s")], { timeout: 60_000, maxBuffer: 1_000_000, signal });
        for (const file of (await readdir(temporary)).filter((name) => /\.(?:vtt|srt)$/.test(name))) {
          if ((await stat(join(temporary, file))).size > 4_000_000) continue;
          const contents = await readFile(join(temporary, file), "utf8");
          const segments = parseVideoCaptions(contents, language);
          if (segments.length) return { segments, language, source: "captions", totalSeconds: metadata.duration };
        }
      } catch { signal?.throwIfAborted(); /* A source may list captions that cannot be downloaded. Try its audio. */ }
    }
    const formats = metadata.info?.formats || [];
    if (formats.length && formats.some((format) => format.vcodec && format.vcodec !== "none") && formats.every((format) => format.acodec === "none")) throw new VideoSourceError("noRecipeEvidence", "这条视频没有可读取的音轨。");
    const media = join(temporary, "audio.media");
    await run(YTDLP, [...FLAGS, ...source, "--quiet", "--no-progress", "--max-filesize", "200M", "-f", "bestaudio/best", "-o", "-"], { timeout: 180_000, maxBuffer: 1_000_000, outputFile: media, maxFileBytes: 200 * 1024 * 1024, signal });
    const { stdout: durationText } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", media], { timeout: 15_000, maxBuffer: 10_000, signal });
    const duration = Number(durationText.trim());
    if (!Number.isFinite(duration) || duration <= 0) throw new VideoSourceError("videoUnavailable", "无法确认视频时长。");
    if (duration > 1800) throw new VideoSourceError("videoTooLong", "视频超过 30 分钟。");
    const wav = join(temporary, "speech.wav");
    await run(FFMPEG, ["-nostdin", "-v", "error", "-i", media, "-vn", "-ac", "1", "-ar", "16000", wav], { timeout: 120_000, maxBuffer: 1_000_000, signal });
    const { stdout } = await run(PYTHON, [TRANSCRIBE, wav], { timeout: 15 * 60_000, maxBuffer: 4_000_000, signal });
    const transcript = JSON.parse(stdout);
    if (!Array.isArray(transcript.segments) || !transcript.segments.some((segment) => typeof segment.text === "string" && segment.text.trim())) throw new VideoSourceError("noRecipeEvidence", "视频没有可用的字幕或语音。");
    return { ...transcript, totalSeconds: duration, source: "local faster-whisper" };
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof VideoSourceError) throw error;
    throw new VideoSourceError("videoUnavailable", "无法读取视频的字幕或语音，来源可能已失效、需要登录或暂时限制访问。");
  } finally { await rm(temporary, { recursive: true, force: true }).catch(() => {}); }
}
