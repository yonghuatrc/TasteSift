import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fetchVideoFrameEvidence } from "../scripts/video-frames.mjs";

const url = "https://www.tiktok.com/@cook/video/123";
const metadata = { duration: 35, info: { id: "123", formats: [] } };
function runner(state) {
  return async (command, args, options) => {
    if (command.endsWith("yt-dlp")) {
      assert.ok(args.includes("--load-info-json"));
      assert.equal(args.includes(url), false);
      assert.ok(options.maxFileBytes <= 200 * 1024 * 1024);
      state.temporary = dirname(options.outputFile);
      await writeFile(options.outputFile, "video fixture");
    } else if (command.endsWith("ffprobe")) return { stdout: JSON.stringify({ format: { duration: 35 }, streams: [{ codec_type: "video" }] }) };
    else {
      assert.ok(args.includes("-frames:v"));
      assert.ok(Number(args[args.indexOf("-frames:v") + 1]) <= 36);
      const frames = dirname(args.at(-1));
      await writeFile(join(frames, "frame_001.jpg"), "image one");
      await writeFile(join(frames, "frame_002.jpg"), "image two");
    }
    return { stdout: "" };
  };
}

test("silent cooking videos produce separate caption and visible-action evidence locally", async () => {
  const state = {};
  const evidence = await fetchVideoFrameEvidence(url, metadata, runner(state), async (endpoint, options) => {
    assert.equal(endpoint, "http://127.0.0.1:8081/v1/chat/completions");
    const body = JSON.parse(options.body);
    assert.equal(body.chat_template_kwargs.enable_thinking, false);
    const images = body.messages[1].content.filter((part) => part.type === "image_url");
    assert.equal(images.length, 2);
    assert.match(images[0].image_url.url, /^data:image\/jpeg;base64,/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ observations: [
      { frame: 0, caption: "Water (250 ml)", action: "Pour liquid into the saucepan." },
      { frame: 1, caption: "Salt (1/4 tsp)", action: "Sprinkle salt into the pan." },
    ] }) } }] });
  });
  assert.deepEqual(evidence, [
    { text: "Water (250 ml)", kind: "caption" }, { text: "Pour liquid into the saucepan.", kind: "action" },
    { text: "Salt (1/4 tsp)", kind: "caption" }, { text: "Sprinkle salt into the pan.", kind: "action" },
  ]);
  await assert.rejects(access(state.temporary));
});

test("unreadable frames and references to unseen frames cannot supply recipe evidence", async () => {
  for (const observations of [[{ frame: 99, caption: "Sugar 500g", action: "Fry." }], [{ frame: 0, caption: "", action: "Stir the mixture." }]]) {
    const state = {};
    await assert.rejects(fetchVideoFrameEvidence(url, metadata, runner(state), async () => Response.json({ choices: [{ message: { content: JSON.stringify({ observations }) } }] })), /画面|evidence/i);
    await assert.rejects(access(state.temporary));
  }
});

test("vision actions cannot add an unstated duration", async () => {
  const evidence = await fetchVideoFrameEvidence(url, metadata, runner({}), async () => Response.json({ choices: [{ message: { content: JSON.stringify({ observations: [{ frame: 0, caption: "Salt (1/4 tsp)", action: "Boil for 20 minutes." }] }) } }] }));
  assert.deepEqual(evidence, [{ text: "Salt (1/4 tsp)", kind: "caption" }]);
});

test("visual actions cannot replace a printed fraction with a spelled-out amount", async () => {
  for (const action of ["Add two tablespoons of salt.", "Add half a cup of milk.", "Add a tsp of sugar.", "加入两汤匙盐。", "Add a pinch of salt.", "Add a spoonful of salt."]) {
    const evidence = await fetchVideoFrameEvidence(url, metadata, runner({}), async () => Response.json({ choices: [{ message: { content: JSON.stringify({ observations: [{ frame: 0, caption: "Salt 1/4 tsp", action }] }) } }] }));
    assert.deepEqual(evidence, [{ text: "Salt 1/4 tsp", kind: "caption" }]);
  }
});

test("cancelled frame extraction stops before starting tools or model inference", async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fetchVideoFrameEvidence(url, metadata, () => assert.fail("No process expected"), () => assert.fail("No model expected"), controller.signal), (error) => error.name === "AbortError");
});

test("stopping visual inference cancels the local model and removes its frame files", async () => {
  const state = {}; const controller = new AbortController(); let started;
  const modelStarted = new Promise((resolve) => { started = resolve; });
  const task = fetchVideoFrameEvidence(url, metadata, runner(state), async (_endpoint, options) => {
    started();
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }));
  }, controller.signal);
  const rejected = assert.rejects(task, (error) => error.name === "AbortError");
  await modelStarted; controller.abort(); await rejected;
  await assert.rejects(access(state.temporary));
});
