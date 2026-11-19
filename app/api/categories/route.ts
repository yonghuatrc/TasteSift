import { getCurrentMember } from "../../../lib/auth/current-member.ts";
import { can } from "../../../lib/auth/permissions.ts";
import { createCategory, listCategoryCatalog } from "../../../lib/recipes/category-store.ts";

export async function GET() {
  const current = await getCurrentMember();
  if (!current) return Response.json({ error: "forbidden" }, { status: 401 });
  return Response.json({ categories: await listCategoryCatalog() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const current = await getCurrentMember();
  if (!current || !can(current.membership.role, "create") || request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "forbidden" }, { status: 403 });
  try {
    const category = await createCategory(await request.json(), current.actor);
    return Response.json({ category, categories: await listCategoryCatalog() });
  } catch { return Response.json({ error: "categoryFailed" }, { status: 400 }); }
}
