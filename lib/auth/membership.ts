import { eq, sql } from "drizzle-orm";

import { members } from "../../db/schema.ts";
import type { Role } from "./roles.ts";

export type SiteIdentity = {
  userId: string;
  email: string;
  displayName: string;
};

export type Membership = SiteIdentity & {
  role: Role;
};

export function bootstrapMembership(
  identity: SiteIdentity,
  memberCount: number,
  existingRole?: Role,
): Membership {
  return {
    ...identity,
    role: existingRole ?? (memberCount === 0 ? "owner" : "viewer"),
  };
}

export async function ensureMembership(
  identity: SiteIdentity,
): Promise<Membership> {
  const { getDb } = await import("../../db/index.ts");
  const db = getDb();

  // A single SQLite statement decides ownership. D1 serializes writes, so two
  // concurrent first visits cannot both observe a missing owner here.
  await db.run(sql`
    INSERT INTO members (user_id, email, display_name, role)
    SELECT ${identity.userId}, ${identity.email}, ${identity.displayName}, 'owner'
    WHERE NOT EXISTS (SELECT 1 FROM members WHERE role = 'owner')
    ON CONFLICT(user_id) DO NOTHING
  `);

  await db
    .insert(members)
    .values({ ...identity, role: "viewer" })
    .onConflictDoUpdate({
      target: members.userId,
      set: {
        email: identity.email,
        displayName: identity.displayName,
        updatedAt: new Date(),
      },
    });

  const membership = await db.query.members.findFirst({
    where: eq(members.userId, identity.userId),
  });

  if (!membership) throw new Error("Membership bootstrap failed");

  return {
    userId: membership.userId,
    email: membership.email,
    displayName: membership.displayName ?? membership.email,
    role: membership.role,
  };
}
