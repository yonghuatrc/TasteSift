"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentMember } from "../../lib/auth/current-member.ts";
import { changeMemberRole } from "../../lib/auth/member-management.ts";
import type { Role } from "../../lib/auth/roles.ts";

export async function changeMemberRoleAction(
  targetUserId: string,
  formData: FormData,
) {
  const current = await requireCurrentMember("/family");
  const role = String(formData.get("role")) as Role;
  await changeMemberRole(targetUserId, role, current.actor);
  revalidatePath("/family");
}
