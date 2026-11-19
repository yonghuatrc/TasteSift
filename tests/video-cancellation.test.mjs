import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProcess } from "../scripts/video-extractor.mjs";

for (const streaming of [false, true]) {
  test(`cancelling ${streaming ? "streamed audio" : "transcription"} stops its owned subprocess`, async (t) => {
    const temporary = await mkdtemp(join(tmpdir(), "tastesift-abort-test-"));
    t.after(() => rm(temporary, { recursive: true, force: true }));
    const marker = join(temporary, "pid");
    const controller = new AbortController();
    const task = runProcess(process.execPath, ["-e", "require('node:fs').writeFileSync(process.argv[1], String(process.pid));setInterval(()=>process.stdout.write('x'),50)", marker], { timeout: 2000, maxBuffer: 1000, signal: controller.signal, ...(streaming ? { outputFile: join(temporary, "audio"), maxFileBytes: 1000 } : {}) });
    const rejected = assert.rejects(task, (error) => error.name === "AbortError");
    let pid;
    for (let attempt = 0; attempt < 100 && !pid; attempt++) {
      pid = await readFile(marker, "utf8").then(Number).catch(() => null);
      if (!pid) await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(pid);
    t.after(() => { try { process.kill(pid, "SIGKILL"); } catch {} });
    controller.abort();
    await rejected;
    assert.throws(() => process.kill(pid, 0), /ESRCH/);
  });
}
