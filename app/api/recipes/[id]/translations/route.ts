import { z } from "zod";
import { getCurrentMember } from "../../../../../lib/auth/current-member.ts";
import { can } from "../../../../../lib/auth/permissions.ts";
import { getRecipe, RecipeNotFoundError } from "../../../../../lib/recipes/service.ts";
import { enqueueTranslation, completeTranslation, failTranslation, renewTranslation, translationSnapshot } from "../../../../../lib/recipes/translation-store.ts";
import { readJsonBody } from "../../../../../lib/read-json.ts";
import { contentHash } from "../../../../../lib/recipes/content.ts";

type Context = { params: Promise<{ id: string }> };
const ticketSchema = z.object({ sourceHash: z.string().regex(/^[a-f0-9]{64}$/), token: z.string().uuid() });

async function context(request: Request, options: Context, write: boolean) {
  const current = await getCurrentMember();
  if (!current) return Response.json({ error: "forbidden" }, { status: 401 });
  if (write && (!can(current.membership.role, "create") || request.headers.get("origin") !== new URL(request.url).origin || request.method !== "POST" && current.membership.role !== "owner")) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await options.params;
  try { return { actor: current.actor, recipe: await getRecipe(id, current.actor) }; }
  catch (error) { if (error instanceof RecipeNotFoundError) return Response.json({ error: "notFound" }, { status: 404 }); throw error; }
}
function failure(error: unknown) {
  return Response.json({ error: error instanceof Error && /changed|stale/i.test(error.message) ? "translationStale" : "translationFailed" }, { status: error instanceof Error && /changed|stale/i.test(error.message) ? 409 : 400 });
}

export async function GET(request: Request, options: Context) {
  const current = await context(request, options, false);
  if (current instanceof Response) return current;
  return Response.json(await translationSnapshot(current.recipe), { headers: { "cache-control": "no-store" } });
}
export async function POST(request: Request, options: Context) {
  const current = await context(request, options, true);
  if (current instanceof Response) return current;
  try {
    const { retry, sourceHash } = z.object({ retry: z.boolean().optional(), sourceHash: z.string().regex(/^[a-f0-9]{64}$/) }).parse(await readJsonBody(request, 1024));
    if (await contentHash(current.recipe) !== sourceHash) return failure(new Error("Recipe changed"));
    return Response.json(await enqueueTranslation(current.recipe, current.actor, retry), { headers: { "cache-control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request, options: Context) {
  const current = await context(request, options, true);
  if (current instanceof Response) return current;
  try {
    const input = ticketSchema.extend({ translations: z.unknown() }).parse(await readJsonBody(request));
    return Response.json(await completeTranslation(current.recipe, current.actor, { ...input, translations: input.translations }));
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request, options: Context) {
  const current = await context(request, options, true);
  if (current instanceof Response) return current;
  try {
    const input = ticketSchema.extend({ progress: z.boolean().optional() }).parse(await readJsonBody(request, 2048));
    if (input.progress) { await renewTranslation(current.recipe, current.actor, input); return Response.json({ status: "pending" }); }
    await failTranslation(current.recipe.id, current.actor, input); return Response.json({ status: "failed" });
  }
  catch (error) { return failure(error); }
}
