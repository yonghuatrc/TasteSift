import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, access, mkdtemp, rm, stat, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { videoPlatform } from "../lib/recipes/video-platform.mjs";
import { resolveVideoUrl, fetchVideoMetadata, fetchVideoTranscript, runProcess } from "../scripts/video-extractor.mjs";
import { groupTranscriptSegments } from "../scripts/video-captions.mjs";

test("nearby subtitle fragments retain their context and later corrections without dropping text", () => {
  const result = groupTranscriptSegments([{ offset: 10, text: "白萝卜" }, { offset: 12, text: "滚刀切" }, { offset: 32, text: "不是5分钟" }, { offset: 34, text: "差不多6~7分钟" }]);
  assert.deepEqual(result, ["白萝卜 滚刀切", "不是5分钟 差不多6~7分钟"]);
});

test("recognizes individual public posts and short links for all five platforms", () => {
  for (const [url, expected] of [
    ["https://www.facebook.com/reel/123", "Facebook"],
    ["https://www.facebook.com/share/r/abc/", "Facebook"],
    ["https://www.facebook.com/video.php?v=123456", "Facebook"],
    ["https://fb.watch/abc/", "Facebook"],
    ["https://www.youtube.com/shorts/M8dLNsKAsrw", "YouTube"],
    ["https://youtube.com/watch?v=M8dLNsKAsrw&list=abc", "YouTube"],
    ["https://youtu.be/M8dLNsKAsrw", "YouTube"],
    ["https://www.tiktok.com/@cook/video/123456789", "TikTok"],
    ["https://vt.tiktok.com/ABC/", "TikTok"],
    ["https://vm.tiktok.com/ABC/", "TikTok"],
    ["https://www.tiktok.com/t/ZTRC5xgJp/", "TikTok"],
    ["https://www.instagram.com/reel/Abc_123/", "Instagram"],
    ["https://www.instagram.com/p/Abc_123/", "Instagram"],
    ["https://www.xiaohongshu.com/explore/6411cf99000000001300b6d9?xsec_token=keep", "小红书"],
    ["https://www.xiaohongshu.com/discovery/item/6411cf99000000001300b6d9", "小红书"],
    ["https://xhslink.com/a/ABC", "小红书"],
  ]) assert.equal(videoPlatform(url), expected, url);
});

test("resolves Facebook and TikTok app share paths before extraction", async () => {
  for (const [source, destination] of [
    ["https://www.facebook.com/share/r/abc/", "https://www.facebook.com/reel/123456/"],
    ["https://www.facebook.com/share/v/abc/", "https://www.facebook.com/video.php?v=123456"],
    ["https://www.tiktok.com/t/ZTRC5xgJp/", "https://www.tiktok.com/@cook/video/123456"],
  ]) {
    assert.equal(await resolveVideoUrl(source, async () => new Response(null, { status: 302, headers: { location: destination } })), destination);
    await assert.rejects(resolveVideoUrl(source, async () => new Response(null, { status: 302, headers: { location: "https://www.instagram.com/reel/Other/" } })), /redirect|链接/i);
  }
  assert.equal(await resolveVideoUrl("https://tiktok.com/@cook/video/123456"), "https://www.tiktok.com/@cook/video/123456");
  assert.equal(await resolveVideoUrl("https://xiaohongshu.com/explore/6411cf99000000001300b6d9?xsec_token=keep"), "https://www.xiaohongshu.com/explore/6411cf99000000001300b6d9?xsec_token=keep");
});

test("rejects profiles, playlists and unsafe lookalike destinations", () => {
  for (const url of ["https://youtube.com/playlist?list=123", "https://youtube.com/@cook", "https://www.tiktok.com/@cook", "https://www.instagram.com/cook/", "https://www.xiaohongshu.com/user/profile/123", "https://facebook.com.evil.test/reel/123", "https://evil.test/?url=https://youtube.com/watch?v=123", "https://user:password@youtube.com/watch?v=12345678901", "https://youtube.com:444/watch?v=12345678901", "file:///etc/passwd"]) assert.equal(videoPlatform(url), null, url);
});

test("resolves a short link without dropping its source access token", async () => {
  const destination = "https://www.xiaohongshu.com/discovery/item/6411cf99000000001300b6d9?xsec_token=keep&xsec_source=share";
  const result = await resolveVideoUrl("https://xhslink.com/a/ABC", async (_url, options) => {
    assert.equal(options.redirect, "manual");
    return new Response(null, { status: 302, headers: { location: destination } });
  });
  assert.equal(result, destination);
});

test("does not follow a short-link redirect to another platform or private host", async () => {
  for (const destination of ["http://127.0.0.1/private", "https://youtube.com/watch?v=M8dLNsKAsrw"]) {
    let calls = 0;
    await assert.rejects(resolveVideoUrl("https://xhslink.com/a/ABC", async () => { calls++; return new Response(null, { status: 302, headers: { location: destination } }); }), /redirect|链接/i);
    assert.equal(calls, 1);
  }
});

test("reads platform evidence once with generic extractors and ambient config disabled", async () => {
  const source = "https://www.youtube.com/shorts/M8dLNsKAsrw";
  const metadata = await fetchVideoMetadata(source, async (_command, args, options) => {
    assert.ok(args.includes("--ignore-config"));
    assert.ok(args.includes("--no-playlist"));
    assert.ok(args.includes("default,-generic"));
    assert.equal(args.at(-1), source);
    assert.ok(options.timeout <= 60_000);
    return { stdout: JSON.stringify({ id: "M8dLNsKAsrw", title: "Steamed ribs", description: "Source recipe text", uploader: "Home cook", duration: 60, language: "zh", subtitles: { zh: [{}] }, automatic_captions: { en: [{}] }, thumbnail: "https://example.com/ribs.jpg" }) };
  });
  assert.equal(metadata.platform, "YouTube");
  assert.equal(metadata.title, "Steamed ribs");
  assert.equal(metadata.description, "Source recipe text");
  assert.equal(metadata.creator, "Home cook");
  assert.deepEqual(metadata.captionLanguages, ["zh", "en"]);
});

test("rejects long videos and live streams before downloading audio", async () => {
  for (const extra of [{ duration: 1801 }, { is_live: true }, { _type: "playlist", entries: [{}] }]) {
    await assert.rejects(fetchVideoMetadata("https://youtu.be/M8dLNsKAsrw", async () => ({ stdout: JSON.stringify({ title: "Cook", duration: 60, ...extra }) })), /30|live|single|视频|直播/i);
  }
});

test("an individual Instagram carousel exposes only its top-level recipe caption", async () => {
  const url = "https://www.instagram.com/p/Recipe123/";
  const metadata = await fetchVideoMetadata(url, async () => ({ stdout: JSON.stringify({ _type: "playlist", title: "Roast potatoes", description: "Ingredients: potatoes. Method: roast until tender.", entries: [{ url: "https://example.com/first.mp4" }, { url: "https://example.com/second.mp4" }] }) }));
  assert.equal(metadata.textOnly, true);
  assert.match(metadata.description, /Ingredients/);
  await assert.rejects(fetchVideoTranscript(url, metadata, async () => { assert.fail("Carousel media must not be downloaded"); }), (error) => error.code === "noRecipeEvidence");
});

test("empty extractor results are reported as unavailable source evidence", async () => {
  await assert.rejects(fetchVideoMetadata("https://youtu.be/M8dLNsKAsrw", async () => ({ stdout: "null" })), (error) => error.code === "videoUnavailable");
});

test("uses captions in the source language and removes temporary files", async () => {
  let temporary;
  const result = await fetchVideoTranscript("https://youtu.be/M8dLNsKAsrw", { duration: 60, language: "zh", captionLanguages: ["zh", "en"] }, async (_command, args) => {
    assert.ok(args.includes("--write-subs"));
    assert.equal(args[args.indexOf("--sub-langs") + 1], "zh");
    temporary = dirname(args[args.indexOf("-o") + 1]);
    await writeFile(join(temporary, "captions.zh.vtt"), "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n排骨加盐洗净\n");
    return { stdout: "" };
  });
  assert.equal(result.segments[0].text, "排骨加盐洗净");
  await assert.rejects(access(temporary));
});

test("reads available cooking captions even when playable media formats are unavailable", async () => {
  const result = await fetchVideoTranscript("https://www.youtube.com/watch?v=FlP8JEDqe9E", { duration: 1094, captionLanguages: ["zh-Hans"], info: { formats: [] } }, async (_command, args) => {
    if (!args.includes("--write-subs") || !args.includes("--ignore-no-formats-error")) throw new Error("Requested format is not available");
    await writeFile(join(dirname(args[args.indexOf("-o") + 1]), "captions.zh-Hans.vtt"), "WEBVTT\n\n00:01:00.000 --> 00:01:03.000\n白萝卜切块\n\n00:12:00.000 --> 00:12:03.000\n放入排骨小火煮\n");
    return { stdout: "" };
  });
  assert.equal(result.source, "captions");
  assert.deepEqual(result.segments.map((segment) => segment.text), ["白萝卜切块", "放入排骨小火煮"]);
});

test("falls back to bounded audio transcription when captions are unavailable", async () => {
  let temporary;
  const result = await fetchVideoTranscript("https://www.instagram.com/reel/Abc_123/", { duration: 20, captionLanguages: [] }, async (command, args, options) => {
    if (command.endsWith("yt-dlp")) {
      assert.ok(args.includes("--max-filesize"));
      temporary = dirname(options.outputFile);
      await writeFile(options.outputFile, "fixture");
      return { stdout: "" };
    }
    if (command.endsWith("ffprobe")) return { stdout: "20.0" };
    if (command.endsWith("ffmpeg")) return { stdout: "" };
    return { stdout: JSON.stringify({ segments: [{ text: "Roast potatoes at 200 degrees for 20 minutes.", offset: 0, duration: 10 }], language: "en" }) };
  });
  assert.equal(result.segments[0].text, "Roast potatoes at 200 degrees for 20 minutes.");
  await assert.rejects(access(temporary));
});

test("failed audio processing also cleans up its temporary directory", async () => {
  let temporary;
  await assert.rejects(fetchVideoTranscript("https://www.tiktok.com/@cook/video/123456789", { duration: 20, captionLanguages: [] }, async (_command, _args, options) => {
    temporary = dirname(options.outputFile);
    throw new Error("download blocked");
  }), /blocked|unavailable|读取/i);
  await assert.rejects(access(temporary));
});

test("an explicitly video-only source without captions is classified as missing speech", async () => {
  await assert.rejects(fetchVideoTranscript("https://youtu.be/M8dLNsKAsrw", { duration: 20, captionLanguages: [], info: { formats: [{ vcodec: "h264", acodec: "none" }] } }, async () => { assert.fail("Do not attempt unavailable audio"); }), (error) => error.code === "noRecipeEvidence");
});

test("unknown-size process output cannot exceed its on-disk byte limit", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "tastesift-limit-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const output = join(temporary, "audio.media");
  await assert.rejects(runProcess(process.execPath, ["-e", "process.stdout.write(Buffer.alloc(129))"], { outputFile: output, maxFileBytes: 128, timeout: 2000, maxBuffer: 1000 }), /limit|large|大小/i);
  assert.ok((await stat(output)).size <= 128);
});

test("retrieval reuses the validated info JSON rather than extracting the source again", async () => {
  const source = "https://youtu.be/M8dLNsKAsrw";
  const info = { id: "M8dLNsKAsrw", title: "Ribs", duration: 20, subtitles: { zh: [] } };
  const metadata = await fetchVideoMetadata(source, async () => ({ stdout: JSON.stringify(info) }));
  const transcript = await fetchVideoTranscript(source, metadata, async (_command, args) => {
    assert.ok(args.includes("--load-info-json"));
    assert.equal(args.includes(source), false);
    const saved = JSON.parse(await readFile(args[args.indexOf("--load-info-json") + 1], "utf8"));
    assert.equal(saved.id, "M8dLNsKAsrw");
    await writeFile(join(dirname(args[args.indexOf("-o") + 1]), "captions.zh.vtt"), "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n排骨加盐\n");
    return { stdout: "" };
  });
  assert.equal(transcript.segments[0].text, "排骨加盐");
});

for (const kind of ["oversized", "invalid-language"]) {
  test(`${kind} captions fall back to audio without loading unsafe caption data`, async () => {
    const result = await fetchVideoTranscript("https://youtu.be/M8dLNsKAsrw", { duration: 20, captionLanguages: [kind === "invalid-language" ? ".*" : "zh"], info: { id: "fixture" } }, async (command, args, options) => {
      if (command.endsWith("yt-dlp")) {
        if (args.includes("--write-subs")) {
          const contents = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n" + (kind === "oversized" ? "盐".repeat(1_400_000) : "wrong caption");
          await writeFile(join(dirname(args[args.indexOf("-o") + 1]), "captions.zh.vtt"), contents);
        } else await writeFile(options.outputFile || join(dirname(args[args.indexOf("-o") + 1]), "audio.mp4"), "fixture");
        return { stdout: "" };
      }
      if (command.endsWith("ffprobe")) return { stdout: "20" };
      if (command.endsWith("ffmpeg")) return { stdout: "" };
      return { stdout: JSON.stringify({ segments: [{ text: "Valid speech evidence", offset: 0, duration: 1 }] }) };
    });
    assert.equal(result.segments[0].text, "Valid speech evidence");
  });
}
