import { claimVideoJob } from "../../../../lib/recipes/import-job-store.ts";
import { videoImportActor, videoImportFailure, videoImportHeaders } from "../../../../lib/video-import-api.ts";

export async function POST(request: Request) {
  const actor = await videoImportActor(request, true);
  if (actor instanceof Response) return actor;
  try { return Response.json({ job: await claimVideoJob(actor) }, { headers: videoImportHeaders }); }
  catch (error) { return videoImportFailure(error); }
}
