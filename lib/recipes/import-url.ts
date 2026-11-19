import { fetchRecipePage } from "./fetch-page.ts";
import { extractRecipeFromJsonLd } from "./import.ts";

export async function importRecipeUrl(sourceUrl: string) {
  const { html, finalUrl } = await fetchRecipePage(sourceUrl);
  const scripts: string[] = [];
  let current = "";
  const rewriter = new HTMLRewriter().on('script[type="application/ld+json"]', {
    element() { current = ""; },
    text(chunk) {
      current += chunk.text;
      if (chunk.lastInTextNode) scripts.push(current);
    },
  });
  await rewriter.transform(new Response(html)).arrayBuffer();
  const recipe = extractRecipeFromJsonLd(scripts, finalUrl);
  return { ...recipe, sourceUrl };
}
