import { MemberList } from "../../components/member-list.tsx";
import { requireCurrentMember } from "../../lib/auth/current-member.ts";
import { listMembers } from "../../lib/auth/member-management.ts";
import { requireOwner } from "../../lib/auth/permissions.ts";
import { changeMemberRoleAction } from "./actions.ts";

export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const current = await requireCurrentMember("/family");
  requireOwner(current.membership.role);
  const members = await listMembers(current.actor);

  return (
    <main className="page-shell max-w-4xl">
      <p className="eyebrow">Private family space</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold text-[#173d2d] sm:text-5xl">Family access</h1>
      <p className="mt-3 max-w-2xl leading-7 text-[#68756d]">Share the private TasteSift Site with a family member first. After they visit once, they appear here as a viewer; promote them to editor only if they should add or change recipes.</p>
      <div className="mt-8 rounded-2xl border border-[#d6e3da] bg-[#e8f2ec] p-5 text-sm leading-6 text-[#345344]"><strong>Viewer:</strong> can browse and search. <strong className="ml-2">Editor:</strong> can also add and edit. Only you, the owner, can delete recipes or manage roles.</div>
      <div className="mt-6"><MemberList changeRole={changeMemberRoleAction} members={members} ownerId={current.membership.userId} /></div>
    </main>
  );
}
