import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";

const temporary = await mkdtemp(join(tmpdir(), "tastesift-request-abort-"));
after(() => rm(temporary, { recursive: true, force: true }));
const reader = join(temporary, "yt-dlp");
await writeFile(reader, `#!${process.execPath}\nif(process.argv.includes('--dump-single-json'))console.log(JSON.stringify({title:'Potatoes',duration:10,description:'Ingredients: potatoes.\\nMethod: Roast until tender.',subtitles:{en:[{}]}}));else if(process.argv.includes('--write-subs'))require('node:fs').writeFileSync(process.argv[process.argv.indexOf('-o')+1].replace('%(ext)s','en.vtt'),'WEBVTT\\n\\n00:00:01.000 --> 00:00:03.000\\nRoast until tender.\\n');else process.exit(1);\n`, { mode: 0o755 });
process.env.YT_DLP_PATH = reader;
const { serve } = await import("../scripts/facebook-recipe-local.mjs");

for (const firstKind of ["video", "translation"]) test(`disconnecting a ${firstKind} request cancels its model before the next video runs`, async (t) => {
  const server = createServer(serve).listen(0, "127.0.0.1");
  t.after(() => { server.closeAllConnections(); server.close(); });
  await once(server, "listening");
  const realFetch = globalThis.fetch;
  let releaseFirst;
  let firstSignal;
  let started;
  const modelStarted = new Promise((resolve) => { started = resolve; });
  let inFlight = 0; let maximum = 0; let calls = 0;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    if (String(input) !== "http://127.0.0.1:8081/v1/chat/completions") return realFetch(input, options);
    calls++; inFlight++; maximum = Math.max(maximum, inFlight);
    if (calls === 1) {
      firstSignal = options.signal; started();
      try { return await new Promise((_resolve, reject) => { releaseFirst = reject; options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }); }); }
      finally { inFlight--; }
    }
    inFlight--;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Potatoes", ingredients: [{ sourceLine: 0, text: "potatoes" }], steps: { preparation: [], cooking: [{ sourceLine: 1, text: "Roast until tender.", instruction: "Roast until tender." }], finishing: [] } }) } }] });
  });
  t.after(() => releaseFirst?.(new Error("Test cleanup")));
  const endpoint = `http://127.0.0.1:${server.address().port}/video-recipe`;
  const request = (signal, kind = "video") => realFetch(kind === "video" ? endpoint : endpoint.replace("/video-recipe", "/translate-recipe"), { method: "POST", headers: { origin: "https://tastesift.yonghuat0425.chatgpt.site", "content-type": "application/json" }, body: JSON.stringify(kind === "video" ? { url: "https://www.tiktok.com/@cook/video/123" } : { content: { title: "Potatoes", description: null, notes: null, ingredients: ["Potatoes"], steps: ["Roast until tender."] } }), signal });
  const controller = new AbortController();
  const first = request(controller.signal, firstKind);
  const firstRejected = assert.rejects(first, (error) => error.name === "AbortError");
  await modelStarted;
  const second = request(AbortSignal.timeout(3000));
  controller.abort();
  const response = await second;
  assert.equal(response.status, 200);
  assert.equal((await response.json()).recipe.title, "Potatoes");
  await firstRejected;
  assert.equal(firstSignal.aborted, true);
  assert.equal(maximum, 1);
});
