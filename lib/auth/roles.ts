export const roles = ["owner", "editor", "viewer"] as const;
export type Role = (typeof roles)[number];

export const actions = [
  "read",
  "create",
  "update",
  "delete",
  "manage_members",
] as const;
export type Action = (typeof actions)[number];
