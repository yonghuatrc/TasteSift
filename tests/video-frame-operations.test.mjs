import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";

test("frame model outages and timeouts are operational errors, not missing recipe facts", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "tastesift-frame-operations-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const script = `#!${process.execPath}\nconst fs=require('node:fs'),path=require('node:path');const tool=path.basename(process.argv[1]),args=process.argv.slice(2);if(tool==='yt-dlp'){if(args.includes('--dump-single-json'))console.log(JSON.stringify({id:'123',title:'Recipe',duration:10,description:'Only music',formats:[{vcodec:'h264',acodec:'aac'}]}));else process.stdout.write('media fixture');}else if(tool==='ffprobe')console.log(args.includes('json')?JSON.stringify({format:{duration:10},streams:[{codec_type:'video'},{codec_type:'audio'}]}):'10');else if(tool==='ffmpeg')fs.writeFileSync(args.at(-1).replace('%03d','001'),'fixture');else console.log(JSON.stringify({segments:[]}));\n`;
  for (const [variable, name] of [["YT_DLP_PATH", "yt-dlp"], ["FFMPEG_PATH", "ffmpeg"], ["FFPROBE_PATH", "ffprobe"], ["WHISPER_PYTHON", "python"]]) {
    const file = join(temporary, name); await writeFile(file, script, { mode: 0o755 }); process.env[variable] = file;
  }
  const { serve } = await import("../scripts/facebook-recipe-local.mjs");
  const server = createServer(serve).listen(0, "127.0.0.1");
  t.after(() => { server.closeAllConnections(); server.close(); }); await once(server, "listening");
  const realFetch = globalThis.fetch; let timeout = false;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    if (String(input) !== "http://127.0.0.1:8081/v1/chat/completions") return realFetch(input, options);
    if (timeout) throw new DOMException("Model busy", "TimeoutError");
    return new Response("Model unavailable", { status: 503 });
  });
  for (const timedOut of [false, true]) {
    timeout = timedOut;
    const response = await realFetch(`http://127.0.0.1:${server.address().port}/video-recipe`, { method: "POST", headers: { origin: "https://tastesift.yonghuat0425.chatgpt.site", "content-type": "application/json" }, body: JSON.stringify({ url: "https://www.tiktok.com/@cook/video/123" }) });
    assert.equal(response.status, 400); assert.equal((await response.json()).code, "processingError");
  }
});
