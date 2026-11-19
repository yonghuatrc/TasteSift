import test from "node:test";
import assert from "node:assert/strict";
import { organizeRecipeEvidence } from "../scripts/facebook-recipe-local.mjs";

const url = "https://www.tiktok.com/@cook/video/123";
const metadata = { title: "A cooking video", platform: "TikTok" };
const sources = [{ text: "Salt (1/4 tsp)", kind: "caption" }, { text: "Stir the mixture in the pan.", kind: "action" }];
const fetcher = (ingredients) => async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Dish", ingredients, steps: { preparation: [], cooking: [{ sourceLine: 1, text: sources[1].text, instruction: sources[1].text }], finishing: [] } }) } }] });

test("screen captions can ground ingredients and visible actions can ground steps", async () => {
  const result = await organizeRecipeEvidence(sources, metadata, url, [], undefined, fetcher([{ sourceLine: 0, text: "Salt (1/4 tsp)" }]));
  assert.deepEqual(result.ingredients, ["Salt (1/4 tsp)"]);
  assert.deepEqual(result.steps, ["Stir the mixture in the pan."]);
});

test("visual appearance alone cannot invent recipe ingredients", async () => {
  await assert.rejects(organizeRecipeEvidence(sources, metadata, url, [], undefined, fetcher([{ sourceLine: 1, text: "flour 200g" }])), /食材|步骤|来源/);
});

test("explicit heat instructions on screen cannot disappear from the generated steps", async () => {
  const evidence = [...sources, { text: "Fry until golden brown (Low heat)", kind: "caption" }, { text: "Fry the dough pieces in oil.", kind: "action" }];
  const result = await organizeRecipeEvidence(evidence, metadata, url, [], undefined, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Dish", ingredients: [{ sourceLine: 0, text: sources[0].text }], steps: { preparation: [], cooking: [{ sourceLine: 1, text: sources[1].text, instruction: sources[1].text }, { sourceLine: 3, text: evidence[3].text, instruction: evidence[3].text }], finishing: [] } }) } }] }));
  assert.deepEqual(result.steps, [sources[1].text, "Fry until golden brown (Low heat)", "Fry the dough pieces in oil."]);
});

test("ordinary printed oven temperatures and short time units remain in steps", async () => {
  const captions = ["Bake at 180C", "Bake at 180 C", "Bake at 350F", "Cook for 20 min", "Rest for 30 sec"];
  for (const caption of captions) {
    const evidence = [...sources, { text: caption, kind: "caption" }];
    const result = await organizeRecipeEvidence(evidence, metadata, url, [], undefined, fetcher([{ sourceLine: 0, text: sources[0].text }]));
    assert.ok(result.steps.includes(caption), caption);
  }
});

test("grounded preparation cooking and finishing become readable instructions rather than narrator fragments", async () => {
  const evidence = [{ text: "白萝卜700克", kind: "text" }, { text: "auntie教你 白萝卜滚刀切 然后洗一洗", kind: "text" }, { text: "水滚 小火慢煮1个小时半~2个小时", kind: "text" }, { text: "好了才放盐 先放1茶匙 试味", kind: "text" }];
  const result = await organizeRecipeEvidence(evidence, metadata, url, [], undefined, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "白萝卜汤", ingredients: [{ sourceLine: 0, text: "白萝卜700克" }], steps: {
    preparation: [{ sourceLine: 1, text: "白萝卜滚刀切 然后洗一洗", instruction: "白萝卜切成滚刀块并洗净。" }],
    cooking: [{ sourceLine: 2, text: evidence[2].text, instruction: "水滚后转小火，慢煮1.5至2小时。" }],
    finishing: [{ sourceLine: 3, text: evidence[3].text, instruction: "煮好后加入1茶匙盐，试味。" }],
  } }) } }] }));
  assert.deepEqual(result.steps, ["白萝卜切成滚刀块并洗净。", "水滚后转小火，慢煮1.5至2小时。", "煮好后加入1茶匙盐，试味。"]);
});

test("a rewritten instruction with an invented measurement is repaired once before being returned", async () => {
  let calls = 0;
  const evidence = [{ text: "Pork ribs", kind: "text" }, { text: "Blanch for 6-7 minutes.", kind: "text" }];
  const result = await organizeRecipeEvidence(evidence, metadata, url, [], undefined, async () => {
    calls++;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Ribs", ingredients: [{ sourceLine: 0, text: "Pork ribs" }], steps: { preparation: [], cooking: [{ sourceLine: 1, text: evidence[1].text, instruction: calls === 1 ? "Blanch for 57 minutes." : "Blanch for 6-7 minutes." }], finishing: [] } }) } }] });
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.steps, ["Blanch for 6-7 minutes."]);
});

test("unsupported quotes or changed measurement units never become cooking instructions", async () => {
  for (const change of [{ text: "An unrelated invented quote", instruction: "Cook the ribs." }, { text: "Rest for 20 seconds.", instruction: "Rest for 20 hours." }]) {
    let calls = 0;
    await assert.rejects(organizeRecipeEvidence([{ text: "Ribs", kind: "text" }, { text: "Rest for 20 seconds.", kind: "text" }], metadata, url, [], undefined, async () => {
      calls++;
      return Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Ribs", ingredients: [{ sourceLine: 0, text: "Ribs" }], steps: { preparation: [], cooking: [{ sourceLine: 1, ...change }], finishing: [] } }) } }] });
    }), /来源|分量|时长|步骤/);
    assert.equal(calls, 2);
  }
});

test("an unexpected flat model response cannot bypass instruction grounding", async () => {
  await assert.rejects(organizeRecipeEvidence([{ text: "Ribs", kind: "text" }, { text: "Rest for 20 seconds.", kind: "text" }], metadata, url, [], undefined, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Ribs", ingredients: [{ sourceLine: 0, text: "Ribs" }], steps: [{ sourceLine: 1, text: "Rest for 20 seconds.", instruction: "Rest for 500 hours." }] }) } }] })), /步骤阶段/);
});

test("instruction quantities cannot borrow a fraction denominator, a different unit or another action's duration", async () => {
  for (const [line, quote, instruction] of [
    ["Add 1/4 tsp salt.", "Add 1/4 tsp salt.", "Add 4 tsp salt."],
    ["Add 1 tbsp salt.", "Add 1 tbsp salt.", "Add 1 cup salt."],
    ["Blanch for 6 minutes, then rest for 15 minutes.", "Blanch for 6 minutes", "Blanch for 15 minutes."],
    ["Blanch for 5 minutes; correction: 6-7 minutes.", "Blanch for 5 minutes; correction: 6-7 minutes.", "Blanch for 5-7 minutes."],
    ["Rest for 20 seconds.", "Rest for 20 seconds.", "Rest for five hours."],
    ["Add one hundred tsp salt.", "Add one hundred tsp salt.", "Add two hundred tsp salt."],
    ["Rest for 二十小时。", "Rest for 二十小时。", "Rest for 十小时。"],
    ["Rest for 十五到二十分钟。", "Rest for 十五到二十分钟。", "Rest for 二十分钟。"],
    ["Add 1 1/4 cup water.", "Add 1 1/4 cup water.", "Add 10.25 cup water."],
    ["Add 1¼ cup water.", "Add 1¼ cup water.", "Add 2.75 cup water."],
    ["Add 1 tbsp and a half salt.", "Add 1 tbsp and a half salt.", "Add 1 tbsp salt."],
    ["加1汤匙半盐", "加1汤匙半盐", "加1汤匙盐"],
    ["Add 1/4 tsp salt.", "4 tsp salt", "Add 4 tsp salt."],
    ["Add 1/4 tsp salt, then another 4 tsp sugar.", "4 tsp salt", "Add 4 tsp salt."],
    ["Add two hundred tsp salt.", "hundred tsp salt", "Add hundred tsp salt."],
  ]) await assert.rejects(organizeRecipeEvidence([{ text: "Ribs", kind: "text" }, { text: line, kind: "text" }], metadata, url, [], undefined, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Ribs", ingredients: [{ sourceLine: 0, text: "Ribs" }], steps: { preparation: [], cooking: [{ sourceLine: 1, text: quote, instruction }], finishing: [] } }) } }] })), /分量|时长|来源/, instruction);
});

test("a placeholder cannot replace a valid cited cooking action", async () => {
  await assert.rejects(organizeRecipeEvidence([{ text: "Ribs", kind: "text" }, { text: "Roast", kind: "text" }], metadata, url, [], undefined, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Ribs", ingredients: [{ sourceLine: 0, text: "Ribs" }], steps: { preparation: [], cooking: [{ sourceLine: 1, text: "Roast", instruction: "Unknown" }], finishing: [] } }) } }] })), /食材|步骤/);
});

test("preparation interleaved with cooking retains source chronology", async () => {
  const evidence = [{ text: "Herbs", kind: "text" }, { text: "Start simmering stock.", kind: "text" }, { text: "While it simmers, chop herbs.", kind: "text" }, { text: "Add herbs to stock.", kind: "text" }];
  const result = await organizeRecipeEvidence(evidence, metadata, url, [], undefined, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Soup", ingredients: [{ sourceLine: 0, text: "Herbs" }], steps: { preparation: [{ sourceLine: 2, text: evidence[2].text, instruction: evidence[2].text }], cooking: [{ sourceLine: 1, text: evidence[1].text, instruction: evidence[1].text }], finishing: [{ sourceLine: 3, text: evidence[3].text, instruction: evidence[3].text }] } }) } }] }));
  assert.deepEqual(result.steps, evidence.slice(1).map((item) => item.text));
});

test("source fractions and equivalent stated duration wording stay usable", async () => {
  for (const [quote, instruction] of [["Add 1/4 tsp salt.", "Add ¼ tsp salt."], ["Add 1¼ cup water.", "Add 1.25 cup water."], ["小火煮1个小时半~2个小时", "小火煮一个半小时至两个小时。"], ["Blanch for 6-7 minutes.", "Blanch for 6 to 7 minutes."], ["Rest for twenty minutes.", "Rest for twenty minutes."]]) {
    const result = await organizeRecipeEvidence([{ text: "Ribs", kind: "text" }, { text: quote, kind: "text" }], metadata, url, [], undefined, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Ribs", ingredients: [{ sourceLine: 0, text: "Ribs" }], steps: { preparation: [], cooking: [{ sourceLine: 1, text: quote, instruction }], finishing: [] } }) } }] }));
    assert.deepEqual(result.steps, [instruction]);
  }
});

test("a nearby explicit timing correction prevents returning the superseded estimate", async () => {
  const evidence = [{ text: "Ribs", kind: "text" }, { text: "小火汆烫5分钟", kind: "speech" }, { text: "不是5分钟，差不多6~7分钟，因为骨很大", kind: "speech" }];
  await assert.rejects(organizeRecipeEvidence(evidence, metadata, url, [], undefined, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Ribs", ingredients: [{ sourceLine: 0, text: "Ribs" }], steps: { preparation: [], cooking: [{ sourceLine: 1, text: evidence[1].text, instruction: "小火汆烫5分钟。" }], finishing: [] } }) } }] })), /否定.*时长|否定分量或时长/);
});

test("the same cooking action at different points in the source is retained", async () => {
  const evidence = [{ text: "Salt", kind: "text" }, { text: "Stir", kind: "speech" }, { text: "Add salt", kind: "speech" }, { text: "Stir", kind: "speech" }];
  const result = await organizeRecipeEvidence(evidence, metadata, url, [], undefined, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Dish", ingredients: [{ sourceLine: 0, text: "Salt" }], steps: { preparation: [], cooking: evidence.slice(1).map((source, index) => ({ sourceLine: index + 1, text: source.text, instruction: source.text })), finishing: [] } }) } }] }));
  assert.deepEqual(result.steps, ["Stir", "Add salt", "Stir"]);
});

test("an off-by-one model citation is corrected only by matching its actual quoted source", async () => {
  const evidence = [{ text: "Radish", kind: "text" }, { text: "Cut the radish into chunks.", kind: "speech" }, { text: "Simmer until tender.", kind: "speech" }];
  const result = await organizeRecipeEvidence(evidence, metadata, url, [], undefined, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Soup", ingredients: [{ sourceLine: 0, text: "Radish" }], steps: { preparation: [{ sourceLine: 2, text: evidence[1].text, instruction: "Cut the radish into chunks." }], cooking: [{ sourceLine: 2, text: evidence[2].text, instruction: evidence[2].text }], finishing: [] } }) } }] }));
  assert.deepEqual(result.steps, [evidence[1].text, evidence[2].text]);
});

test("quoted omissions can span adjacent speech chunks without adding unsupported words", async () => {
  const evidence = [{ text: "Pork bones", kind: "text" }, { text: "用热水洗净骨头表面油脂，然后捞出。", kind: "speech" }, { text: "关火，用冷水冲洗干净。", kind: "speech" }];
  const result = await organizeRecipeEvidence(evidence, metadata, url, [], undefined, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Soup", ingredients: [{ sourceLine: 0, text: "Pork bones" }], steps: { preparation: [{ sourceLine: 1, text: "用热水洗净骨头表面油脂...用冷水冲洗干净", instruction: "用热水洗去骨头表面油脂，再用冷水冲洗干净。" }], cooking: [], finishing: [] } }) } }] }));
  assert.deepEqual(result.steps, ["用热水洗去骨头表面油脂，再用冷水冲洗干净。"]);
});

test("quote recovery cannot join unrelated distant source chunks", async () => {
  const evidence = [{ text: "Ribs", kind: "text" }, { text: "Wash the ribs", kind: "speech" }, { text: "Roast the ribs", kind: "speech" }, { text: "Serve the ribs", kind: "speech" }];
  await assert.rejects(organizeRecipeEvidence(evidence, metadata, url, [], undefined, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: "Ribs", ingredients: [{ sourceLine: 0, text: "Ribs" }], steps: { preparation: [], cooking: [{ sourceLine: 1, text: "Wash the ribs...Serve the ribs", instruction: "Wash and serve the ribs." }], finishing: [] } }) } }] })), /来源|原话/);
});
