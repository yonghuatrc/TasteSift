export const importStages = ["connecting", "reading", "transcribing", "organizing", "ready"] as const;
export type ImportStage = typeof importStages[number];
export function isImportStage(value: unknown): value is ImportStage {
  return typeof value === "string" && importStages.includes(value as ImportStage);
}
