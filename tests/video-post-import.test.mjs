import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, cp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

test("the helper can start without the neighboring optional video checkout", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "tastesift-standalone-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  await cp(new URL("../scripts/", import.meta.url), join(temporary, "scripts"), { recursive: true });
  await mkdir(join(temporary, "lib", "recipes"), { recursive: true });
  await cp(new URL("../lib/recipes/video-platform.mjs", import.meta.url), join(temporary, "lib", "recipes", "video-platform.mjs"));
  await assert.doesNotReject(promisify(execFile)(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(pathToFileURL(join(temporary, "scripts", "facebook-recipe-local.mjs")).href)});`], { timeout: 5000 }));
});

test("a public post recipe remains usable when its video audio cannot be read", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "tastesift-reader-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const reader = join(temporary, "yt-dlp");
  const description = "Garlic potatoes. Ingredients: 2 potatoes, 1 tbsp oil. Instructions: Cut the potatoes and roast at 200 degrees for 20 minutes.";
  await writeFile(reader, `#!${process.execPath}\nif (process.argv.includes('--dump-single-json')) console.log(JSON.stringify({title:'Garlic potatoes',uploader:'Cook',duration:60,description:process.argv.at(-1).endsWith('/124')?'':process.argv.at(-1).endsWith('/125')?'Subscribe for new recipes every week!':${JSON.stringify(description)}})); else process.exit(1);\n`, { mode: 0o755 });
  process.env.YT_DLP_PATH = reader;
  const { serve } = await import("../scripts/facebook-recipe-local.mjs");
  const server = createServer(serve).listen(0, "127.0.0.1");
  t.after(() => server.close());
  await once(server, "listening");
  const realFetch = globalThis.fetch;
  let modelCalls = 0;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    if (String(input) !== "http://127.0.0.1:8081/v1/chat/completions") return realFetch(input, options);
    modelCalls++;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: "", ingredients: [{ sourceLine: 1, text: "2 potatoes" }, { sourceLine: 1, text: "1 tbsp oil" }], steps: { preparation: [], cooking: [{ sourceLine: 2, text: "Instructions: Cut the potatoes and roast at 200 degrees for 20 minutes.", instruction: "Cut the potatoes and roast at 200 degrees for 20 minutes." }], finishing: [] } }) } }] });
  });
  const endpoint = `http://127.0.0.1:${server.address().port}/video-recipe`;
  const request = (id) => realFetch(endpoint, { method: "POST", headers: { origin: "https://tastesift.yonghuat0425.chatgpt.site", "content-type": "application/json" }, body: JSON.stringify({ url: `https://www.tiktok.com/@cook/video/${id}` }) });
  const result = await (await request("123")).json();
  assert.equal(result.recipe?.title, "Garlic potatoes");
  assert.equal(result.recipe?.sourcePlatform, "TikTok · Cook");
  assert.match(result.recipe?.notes, /贴文.*字幕或语音未能读取/);
  assert.deepEqual(result.recipe?.ingredients, ["2 potatoes", "1 tbsp oil"]);
  assert.deepEqual(result.recipe?.steps, ["Cut the potatoes and roast at 200 degrees for 20 minutes."]);
  assert.equal(modelCalls, 1);
  const unavailable = await request("124");
  assert.equal(unavailable.status, 400);
  assert.equal((await unavailable.json()).code, "videoUnavailable");
  assert.equal(modelCalls, 1, "a title alone must not cause recipe invention");
  const invented = await request("125");
  assert.equal(invented.status, 400);
  assert.equal((await invented.json()).code, "processingError", "the fixture blocks frame acquisition; do not misreport an operational failure as absent recipe facts");
  assert.equal(modelCalls, 1, "promotional text must not be treated as source recipe evidence");
});
