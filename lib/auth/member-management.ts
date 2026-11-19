import { asc, eq } from "drizzle-orm";

import { members } from "../../db/schema.ts";
import { requireOwner } from "./permissions.ts";
import type { Role } from "./roles.ts";

export type MemberManager = { userId: string; role: Role | null };

export type ManagedMember = {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
};

export interface MemberRepository {
  list(): Promise<ManagedMember[]>;
  changeRole(userId: string, role: Role): Promise<ManagedMember | null>;
}

export class MemberRoleError extends Error {
  readonly status = 400;
}

function createD1MemberRepository(): MemberRepository {
  async function database() {
    const { getDb } = await import("../../db/index.ts");
    return getDb();
  }

  return {
    async list() {
      const db = await database();
      const rows = await db.select().from(members).orderBy(asc(members.createdAt));
      return rows.map((member) => ({
        userId: member.userId,
        email: member.email,
        displayName: member.displayName ?? member.email,
        role: member.role,
      }));
    },

    async changeRole(userId, role) {
      const db = await database();
      const rows = await db
        .update(members)
        .set({ role, updatedAt: new Date() })
        .where(eq(members.userId, userId))
        .returning();
      const member = rows[0];
      return member
        ? {
            userId: member.userId,
            email: member.email,
            displayName: member.displayName ?? member.email,
            role: member.role,
          }
        : null;
    },
  };
}

export async function listMembers(
  actor: MemberManager,
  repository: MemberRepository = createD1MemberRepository(),
) {
  requireOwner(actor.role);
  return repository.list();
}

export async function changeMemberRole(
  targetUserId: string,
  role: Role,
  actor: MemberManager,
  repository: MemberRepository = createD1MemberRepository(),
) {
  requireOwner(actor.role);
  if (role !== "viewer" && role !== "editor") {
    throw new MemberRoleError("Role must be viewer or editor");
  }
  if (targetUserId === actor.userId) {
    throw new MemberRoleError("You cannot change your own owner role");
  }

  const member = await repository.changeRole(targetUserId, role);
  if (!member) throw new MemberRoleError("Member not available");
  return member;
}
