import { z } from "zod";
import { readJsonBody } from "../../../lib/read-json.ts";
import { createVideoJob } from "../../../lib/recipes/import-job-store.ts";
import { videoImportActor, videoImportFailure, videoImportHeaders } from "../../../lib/video-import-api.ts";

export async function POST(request: Request) {
  const actor = await videoImportActor(request);
  if (actor instanceof Response) return actor;
  try {
    const { id, url } = z.object({ id: z.string().uuid(), url: z.string().max(2048) }).parse(await readJsonBody(request, 4096));
    return Response.json(await createVideoJob(id, url, actor), { headers: videoImportHeaders });
  } catch (error) { return videoImportFailure(error); }
}
