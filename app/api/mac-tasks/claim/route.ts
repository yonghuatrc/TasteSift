import { claimVideoJob } from "../../../../lib/recipes/import-job-store.ts";
import { claimNextTranslation } from "../../../../lib/recipes/translation-store.ts";
import { videoImportActor, videoImportFailure, videoImportHeaders } from "../../../../lib/video-import-api.ts";
import type { MacTask } from "../../../../lib/mac-tasks.ts";

export async function POST(request: Request) {
  const actor = await videoImportActor(request, true);
  if (actor instanceof Response) return actor;
  try {
    const video = await claimVideoJob(actor);
    let job: MacTask | null = video ? { ...video, kind: "video" } : null;
    if (!job) {
      const claim = await claimNextTranslation(actor);
      if (claim) job = { kind: "translation", id: claim.recipeId, token: claim.token, sourceHash: claim.sourceHash, content: claim.content };
    }
    return Response.json({ job }, { headers: videoImportHeaders });
  } catch (error) { return videoImportFailure(error); }
}
