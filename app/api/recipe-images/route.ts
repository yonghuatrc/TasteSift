import { env } from "cloudflare:workers";
import { getCurrentMember } from "../../../lib/auth/current-member.ts";
import { can } from "../../../lib/auth/permissions.ts";
import { readImageUpload, validateImage } from "../../../lib/recipes/images.ts";

export async function POST(request: Request) {
  const current = await getCurrentMember();
  if (!current || !can(current.membership.role, "create") || request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!env.BUCKET) return Response.json({ error: "uploadFailed" }, { status: 503 });
  try {
    const file = await readImageUpload(request);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { contentType, extension } = validateImage(bytes, file.type);
    const name = `${crypto.randomUUID()}.${extension}`;
    await env.BUCKET.put(`recipe-images/${name}`, bytes, { httpMetadata: { contentType }, customMetadata: { uploadedBy: current.actor.userId } });
    return Response.json({ imageUrl: `/api/recipe-images/${name}` });
  } catch (error) {
    const key = error instanceof Error && ["imageInvalid", "imageTooLarge"].includes(error.message) ? error.message : "uploadFailed";
    return Response.json({ error: key }, { status: key === "imageTooLarge" ? 413 : 400 });
  }
}
