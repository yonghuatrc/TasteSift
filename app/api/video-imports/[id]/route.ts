import { z } from "zod";
import { readJsonBody } from "../../../../lib/read-json.ts";
import { getVideoJob, updateVideoJob } from "../../../../lib/recipes/import-job-store.ts";
import { videoImportActor, videoImportFailure, videoImportHeaders } from "../../../../lib/video-import-api.ts";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, options: Context) {
  const actor = await videoImportActor(request);
  if (actor instanceof Response) return actor;
  try { const { id } = await options.params; return Response.json(await getVideoJob(z.string().uuid().parse(id), actor), { headers: videoImportHeaders }); }
  catch (error) { return videoImportFailure(error); }
}
export async function PATCH(request: Request, options: Context) {
  const actor = await videoImportActor(request, true);
  if (actor instanceof Response) return actor;
  try {
    const { id } = await options.params;
    await updateVideoJob(z.string().uuid().parse(id), await readJsonBody(request), actor);
    return Response.json({ ok: true }, { headers: videoImportHeaders });
  } catch (error) { return videoImportFailure(error); }
}
