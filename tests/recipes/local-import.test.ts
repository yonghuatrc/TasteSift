import test from "node:test";
import assert from "node:assert/strict";
import { importFacebookOnMac, importVideoOnMac } from "../../lib/recipes/import-local.ts";
import { importRoute } from "../../lib/recipes/video-platform.mjs";

const source = "https://www.facebook.com/reel/1093699063146706";
const recipe = { title: "自制 XO 酱", ingredients: ["干贝（用量未说明）"], steps: ["按视频做法处理食材。"] };

test("unsupported platform pages are rejected locally while normal recipe pages keep server import", () => {
  assert.equal(importRoute("https://www.youtube.com/playlist?list=abc"), "unsupported");
  assert.equal(importRoute("https://www.instagram.com/cook/"), "unsupported");
  assert.equal(importRoute("https://www.youtube.com/shorts/M8dLNsKAsrw"), "video");
  assert.equal(importRoute("https://www.recipetineats.com/honey-garlic-chicken/"), "page");
});

test("checks the Mac helper before starting video processing", async () => {
  const requests: string[] = [];
  let connected = false;
  const fetcher = (async (input, options) => {
    requests.push(String(input));
    if (requests.length === 1) {
      assert.equal(connected, false);
      return Response.json({ service: "tastesift-facebook" });
    }
    assert.equal(connected, true);
    assert.equal(options?.method, "POST");
    return Response.json({ recipe });
  }) as typeof fetch;
  const result = await importFacebookOnMac(source, () => { connected = true; }, fetcher);
  assert.equal(result.title, recipe.title);
  assert.deepEqual(requests, ["http://127.0.0.1:18788/health", "http://127.0.0.1:18788/facebook-recipe"]);
});

test("a processing timeout is not reported as a disconnected Mac", async () => {
  let calls = 0;
  const fetcher = (async () => {
    if (++calls === 1) return Response.json({ service: "tastesift-facebook" });
    throw new DOMException("Timed out", "TimeoutError");
  }) as typeof fetch;
  await assert.rejects(importFacebookOnMac(source, () => {}, fetcher), /视频处理超时/);
});

test("a blocked local connection stops before starting video processing", async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; throw new TypeError("Failed to fetch"); }) as typeof fetch;
  await assert.rejects(importFacebookOnMac(source, () => { throw new Error("Must not run"); }, fetcher), /无法连接/);
  assert.equal(calls, 1);
});

test("preserves the helper's processing error after connection succeeds", async () => {
  let calls = 0;
  const fetcher = (async () => ++calls === 1
    ? Response.json({ service: "tastesift-facebook" })
    : Response.json({ error: "视频没有可用语音或字幕。" }, { status: 400 })) as typeof fetch;
  await assert.rejects(importFacebookOnMac(source, () => {}, fetcher), /视频没有可用语音或字幕/);
});

test("streamed stages and a Chinese recipe survive arbitrary byte chunks", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ stage: "transcribing" }) + "\n" + JSON.stringify({ stage: "organizing" }) + "\n" + JSON.stringify({ recipe }) + "\n");
  let calls = 0;
  const stages: string[] = [];
  const fetcher = (async () => ++calls === 1 ? Response.json({ service: "tastesift-facebook" }) : new Response(new ReadableStream({
    start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close(); },
  }), { headers: { "content-type": "application/x-ndjson" } })) as typeof fetch;
  const result = await importFacebookOnMac(source, (stage) => stages.push(stage), fetcher);
  assert.equal(result.title, "自制 XO 酱");
  assert.deepEqual(stages, ["reading", "transcribing", "organizing", "ready"]);
});

test("new video platforms use the shared helper endpoint and keep the source URL", async () => {
  for (const url of ["https://youtu.be/M8dLNsKAsrw", "https://www.instagram.com/reel/Abc/", "https://www.tiktok.com/@cook/video/123", "https://xhslink.com/a/ABC"]) {
    const fetcher = (async (input, options) => {
      if (String(input).endsWith("/health")) return Response.json({ service: "tastesift-facebook", videoPlatforms: ["Facebook", "YouTube", "Instagram", "TikTok", "小红书"] });
      assert.equal(String(input), "http://127.0.0.1:18788/video-recipe");
      assert.equal(JSON.parse(String(options?.body)).url, url);
      return Response.json({ recipe: { ...recipe, sourceUrl: url } });
    }) as typeof fetch;
    assert.equal((await importVideoOnMac(url, () => {}, fetcher)).sourceUrl, url);
  }
});

test("an older helper asks for an update before processing a new platform", async () => {
  let calls = 0;
  await assert.rejects(importVideoOnMac("https://youtu.be/M8dLNsKAsrw", () => {}, (async () => { calls++; return Response.json({ service: "tastesift-facebook" }); }) as typeof fetch), (error: unknown) => (error as { key: string }).key === "helperUpdate");
  assert.equal(calls, 1);
});

test("a source restriction produces an actionable platform error", async () => {
  const fetcher = (async (input) => String(input).endsWith("/health")
    ? Response.json({ service: "tastesift-facebook", videoPlatforms: ["Instagram"] })
    : Response.json({ error: "Login required", code: "videoUnavailable" }, { status: 400 })) as typeof fetch;
  await assert.rejects(importVideoOnMac("https://www.instagram.com/reel/Abc/", () => {}, fetcher), (error: unknown) => (error as { key: string }).key === "videoUnavailable");
});
