import { env } from "cloudflare:workers";
import { getCurrentMember } from "../../../../lib/auth/current-member.ts";
import { imageNamePattern } from "../../../../lib/recipes/images.ts";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const current = await getCurrentMember();
  if (!current) return new Response(null, { status: 401 });
  const { name } = await params;
  if (!imageNamePattern.test(name) || !env.BUCKET) return new Response(null, { status: 404 });
  const image = await env.BUCKET.get(`recipe-images/${name}`);
  if (!image) return new Response(null, { status: 404 });
  return new Response(image.body as ReadableStream, { headers: { "content-type": image.httpMetadata?.contentType ?? "application/octet-stream", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
}
