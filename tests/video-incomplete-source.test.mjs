import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("failed media reads cannot turn an ingredients-only description and one simmer line into a complete preview", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "tastesift-incomplete-source-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const reader = join(temporary, "yt-dlp");
  await writeFile(reader, `#!${process.execPath}\nif(process.argv.includes('--dump-single-json'))console.log(JSON.stringify({title:'白萝卜排骨汤',duration:1094,description:'材料: Ingredients:\\n排骨\\n白萝卜\\n小火煮90分钟'}));else process.exit(1);\n`, { mode: 0o755 });
  process.env.YT_DLP_PATH = reader;
  const { serve } = await import("../scripts/facebook-recipe-local.mjs");
  const server = createServer(serve).listen(0, "127.0.0.1");
  t.after(() => { server.closeAllConnections(); server.close(); });
  await once(server, "listening");
  const realFetch = globalThis.fetch; let modelCalls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (String(url) !== "http://127.0.0.1:8081/v1/chat/completions") return realFetch(url, options);
    modelCalls++;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: "白萝卜排骨汤", ingredients: [{ sourceLine: 1, text: "排骨" }, { sourceLine: 2, text: "白萝卜" }], steps: [{ sourceLine: 3, text: "小火煮90分钟" }] }) } }] });
  });
  const response = await realFetch(`http://127.0.0.1:${server.address().port}/video-recipe`, { method: "POST", headers: { origin: "https://tastesift.yonghuat0425.chatgpt.site", "content-type": "application/json" }, body: JSON.stringify({ url: "https://www.youtube.com/watch?v=FlP8JEDqe9E" }) });
  assert.equal(response.ok, false);
  assert.equal(modelCalls, 0);
});
