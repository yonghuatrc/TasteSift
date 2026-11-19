import type { Action, Role } from "./roles.ts";

const allowedActions: Record<Role, ReadonlySet<Action>> = {
  owner: new Set(["read", "create", "update", "delete", "manage_members"]),
  editor: new Set(["read", "create", "update"]),
  viewer: new Set(["read"]),
};

export class AccessNotAvailableError extends Error {
  readonly status = 404;

  constructor() {
    super("Resource not available");
    this.name = "AccessNotAvailableError";
  }
}

export function can(role: Role | null, action: Action): boolean {
  return role !== null && allowedActions[role].has(action);
}

export function requireMember(role: Role | null): Role {
  if (!can(role, "read")) throw new AccessNotAvailableError();
  return role as Role;
}

export function requireEditor(role: Role | null): "owner" | "editor" {
  if (!can(role, "create")) throw new AccessNotAvailableError();
  return role as "owner" | "editor";
}

export function requireOwner(role: Role | null): "owner" {
  if (!can(role, "manage_members")) throw new AccessNotAvailableError();
  return "owner";
}
