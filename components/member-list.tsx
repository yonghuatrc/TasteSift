import type { ManagedMember } from "../lib/auth/member-management.ts";

export function MemberList({
  members,
  ownerId,
  changeRole,
}: {
  members: ManagedMember[];
  ownerId: string;
  changeRole: (targetUserId: string, formData: FormData) => Promise<void>;
}) {
  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-[#dbe4de] bg-white shadow-[0_12px_35px_rgba(29,57,44,0.08)]">
      <ul className="divide-y divide-[#e2e9e4]">
        {members.map((member) => (
          <li className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" key={member.userId}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e8f2ec] font-serif text-lg font-semibold text-[#24533d]">{member.displayName.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0"><p className="truncate font-semibold text-[#173d2d]">{member.displayName}</p><p className="truncate text-sm text-[#748078]">{member.email}</p></div>
            </div>
            {member.userId === ownerId ? (
              <span className="inline-flex min-h-11 items-center self-start rounded-full bg-[#f8d6c8] px-4 text-sm font-bold text-[#873f32] sm:self-auto">Owner</span>
            ) : (
              <form action={changeRole.bind(null, member.userId)} className="flex gap-2">
                <label className="sr-only" htmlFor={`role-${member.userId}`}>Role for {member.displayName}</label>
                <select className="field-control" defaultValue={member.role} id={`role-${member.userId}`} name="role"><option value="viewer">Viewer</option><option value="editor">Editor</option></select>
                <button className="button-secondary" type="submit">Update</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
