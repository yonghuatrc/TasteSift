import { parseRecipeInput, type RecipeInput } from "./model.ts";

function text(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return undefined;
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/<[^>]*>/g, " ").replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity: string) => {
    if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? whole;
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  }).replace(/\s+/g, " ").trim() || undefined;
}

function steps(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(steps);
  if (typeof value === "string") return text(value) ? [text(value)!] : [];
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  return item.itemListElement ? steps(item.itemListElement) : steps(item.text);
}

function minutes(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  if (!match || !match.slice(1).some(Boolean)) return undefined;
  return Math.ceil(Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) + Number(match[4] ?? 0) / 60);
}

function imageUrl(value: unknown, source: string): string | undefined {
  if (Array.isArray(value)) return imageUrl(value[0], source);
  if (value && typeof value === "object") return imageUrl((value as Record<string, unknown>).url, source);
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value, source);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

function* recipeNodes(value: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(value)) {
    for (const item of value) yield* recipeNodes(item);
  } else if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
    if (types.some((type) => typeof type === "string" && /(^|[/#])Recipe$/.test(type))) yield node;
    if (node["@graph"]) yield* recipeNodes(node["@graph"]);
    if (node.mainEntity) yield* recipeNodes(node.mainEntity);
  }
}

export function extractRecipeFromJsonLd(scripts: string[], sourceUrl: string): RecipeInput {
  for (const script of scripts) {
    let data: unknown;
    try { data = JSON.parse(script); } catch { continue; }
    for (const node of recipeNodes(data)) {
      const firstText = (value: unknown) => text(Array.isArray(value) ? value[0] : value);
      try {
        return parseRecipeInput({
          title: text(node.name),
          description: text(node.description),
          sourceUrl,
          sourcePlatform: new URL(sourceUrl).hostname.replace(/^www\./, ""),
          imageUrl: imageUrl(node.image, sourceUrl),
          servings: firstText(node.recipeYield),
          prepMinutes: minutes(node.prepTime),
          cookMinutes: minutes(node.cookTime),
          cuisine: firstText(node.recipeCuisine),
          dishType: firstText(node.recipeCategory),
          ingredients: Array.isArray(node.recipeIngredient) ? node.recipeIngredient.map(text).filter(Boolean) : [],
          steps: steps(node.recipeInstructions),
        });
      } catch { /* Continue to the next embedded recipe when this one is incomplete. */ }
    }
  }
  throw new Error("这个页面没有可自动读取的完整食谱。视频、私人内容或无食谱标记的页面，请把链接发给 ChatGPT，或手动补充食材和步骤。");
}
