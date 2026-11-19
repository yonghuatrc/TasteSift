import type { VideoJobClaim } from "./recipes/import-jobs.ts";
import type { RecipeContent } from "./recipes/content.ts";

export type MacTask = ({ kind: "video" } & VideoJobClaim) | { kind: "translation"; id: string; token: string; sourceHash: string; content: RecipeContent };
