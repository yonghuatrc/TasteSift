import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { toRecipeDraft, allowedOrigin, parseStructuredPost, serve, translateRecipeContent } from "../scripts/facebook-recipe-local.mjs";

test("turns video evidence into an unsaved recipe with source kept separate", () => {
  const draft = toRecipeDraft({
    title: "烤马铃薯配全素蘸酱",
    description: "外脆内软的烤马铃薯，搭配全素蘸酱。",
    ingredients: ["马铃薯（用量未说明）", "盐（用量未说明）"],
    steps: ["烤箱 200°C 烤约 20 分钟。"],
    prepMinutes: null,
    cookMinutes: 20,
  }, { creator: "夠維根Go Vegan", thumbnail: "https://example.com/potato.jpg" }, "https://www.facebook.com/reel/2164961941036665");
  assert.equal(draft.description, "外脆内软的烤马铃薯，搭配全素蘸酱。");
  assert.equal(draft.sourcePlatform, "Facebook · 夠維根Go Vegan");
  assert.equal(draft.prepMinutes, null);
  assert.equal(draft.cookMinutes, 20);
  assert.equal(draft.servings, null);
});

test("accepts only the owner's TasteSift browser origin", () => {
  assert.equal(allowedOrigin("https://tastesift.yonghuat0425.chatgpt.site"), true);
  assert.equal(allowedOrigin("https://other.example"), false);
  assert.equal(allowedOrigin(undefined), false);
});

test("reports helper health only to the approved website origin", async (t) => {
  const server = createServer(serve).listen(0, "127.0.0.1");
  t.after(() => server.close());
  await once(server, "listening");
  const endpoint = `http://127.0.0.1:${server.address().port}/health`;
  const response = await fetch(endpoint, { headers: { origin: "https://tastesift.yonghuat0425.chatgpt.site" } });
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.service, "tastesift-facebook");
  assert.deepEqual(health.videoPlatforms, ["Facebook", "YouTube", "小红书", "TikTok", "Instagram"]);
  const denied = await fetch(endpoint, { headers: { origin: "https://unrelated.example" } });
  assert.equal(denied.status, 403);
});

test("uses a Facebook post's stated ingredients and method without waiting for AI", () => {
  const post = "冷凍馬鈴薯沾這個醬超好吃\n食材：\n馬鈴薯\n油、鹽巴、黑胡椒\n紅椒粉\n全素美乃滋\n番茄醬\n作法：\n冷凍馬鈴薯退冰至少4小時\n用叉子戳幾個洞\n剝皮、撥開攤平\n抹上油、鹽巴、黑胡椒、紅椒粉\n烤箱200度20分鐘\n就完成了！\n醬料推薦——\n全素美乃滋+番茄醬+紅椒粉";
  const result = parseStructuredPost(post);
  assert.equal(result.title, "冷凍馬鈴薯");
  assert.equal(result.description, "冷凍馬鈴薯搭配全素美乃滋、番茄醬和紅椒粉調成的蘸醬。");
  assert.deepEqual(result.ingredients, ["馬鈴薯", "油", "鹽巴", "黑胡椒", "紅椒粉", "全素美乃滋", "番茄醬"]);
  assert.equal(result.prepMinutes, 240);
  assert.equal(result.cookMinutes, 20);
  assert.equal(result.steps.at(-1), "全素美乃滋、番茄醬和紅椒粉拌勻，作為蘸醬。");
});

test("ordinary plus signs in cooking steps do not invent a dipping sauce", () => {
  const result = parseStructuredPost("煎饼\n食材\n鸡蛋\n面粉\n做法\n鸡蛋 + 面粉混合\n下锅煎熟");
  assert.equal(result.description, "");
  assert.deepEqual(result.steps, ["鸡蛋 + 面粉混合", "下锅煎熟"]);
});

test("a complete English post can become a preview without a spoken recipe", () => {
  const result = parseStructuredPost("Garlic potatoes\nIngredients:\n2 potatoes\n1 tbsp oil\nSalt, to taste\nInstructions:\nCut the potatoes.\nRoast at 200°C for 20 minutes.");
  assert.equal(result?.title, "Garlic potatoes");
  assert.deepEqual(result?.ingredients, ["2 potatoes", "1 tbsp oil", "Salt, to taste"]);
  assert.deepEqual(result?.steps, ["Cut the potatoes.", "Roast at 200°C for 20 minutes."]);
});

test("a post starting with Ingredients uses its actual video title", () => {
  const result = parseStructuredPost("Ingredients:\n2 potatoes\nMethod:\nRoast until tender.", "Roast potatoes");
  assert.equal(result?.title, "Roast potatoes");
});

test("blank generated ingredients or actions cannot become a recipe", () => {
  assert.throws(() => toRecipeDraft({ title: "Food", ingredients: [" "], steps: [" "] }, { platform: "TikTok" }, "https://www.tiktok.com/@cook/video/123"), /食材|步骤/);
});

test("placeholder-only ingredients and actions are not recipe evidence", () => {
  assert.throws(() => toRecipeDraft({ title: "Food", ingredients: ["Not provided"], steps: ["Not provided"] }, { platform: "TikTok" }, "https://www.tiktok.com/@cook/video/123"), /食材|步骤/);
});

test("punctuation cannot satisfy source evidence", () => {
  assert.throws(() => toRecipeDraft({ title: "Food", ingredients: ["..."], steps: ["..."] }, { platform: "TikTok" }, "https://www.tiktok.com/@cook/video/123", "Subscribe for new recipes."), /核对|食材|步骤/);
});

test("recipe translation requests both saved languages from the local model only", async () => {
  const source = { title: "饭", description: null, ingredients: ["米 100 克"], steps: ["煮 20 分钟"], notes: null };
  const result = await translateRecipeContent(source, async (url, options) => {
    assert.equal(url, "http://127.0.0.1:8081/v1/chat/completions");
    const body = JSON.parse(options.body);
    assert.equal(body.chat_template_kwargs.enable_thinking, false);
    assert.deepEqual(body.response_format.json_schema.schema.required, ["zh", "en"]);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ zh: source, en: { ...source, title: "Rice" } }) } }] });
  });
  assert.equal(result.en.title, "Rice");
  await assert.rejects(translateRecipeContent({}, () => { throw new Error("Should not call model"); }), /Invalid recipe content/);
});
