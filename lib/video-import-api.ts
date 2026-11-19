import { getCurrentMember } from "./auth/current-member.ts";
import { can, AccessNotAvailableError } from "./auth/permissions.ts";
import { ImportJobError } from "./recipes/import-jobs.ts";

export async function videoImportActor(request: Request, worker = false) {
  const current = await getCurrentMember();
  if (!current) return Response.json({ error: "forbidden" }, { status: 401 });
  if (worker && current.actor.role !== "owner" || request.method !== "GET" && (!can(current.actor.role, "create") || request.headers.get("origin") !== new URL(request.url).origin)) return Response.json({ error: "forbidden" }, { status: 403 });
  return current.actor;
}
export function videoImportFailure(error: unknown) {
  if (error instanceof AccessNotAvailableError) return Response.json({ error: "queueFailed" }, { status: 404 });
  return Response.json({ error: error instanceof ImportJobError ? error.key : "queueFailed" }, { status: error instanceof ImportJobError && error.key === "workerDisconnected" ? 409 : 400 });
}
export const videoImportHeaders = { "cache-control": "no-store" };
