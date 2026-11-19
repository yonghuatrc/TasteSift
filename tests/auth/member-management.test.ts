import assert from "node:assert/strict";
import test from "node:test";

import type { Role } from "../../lib/auth/roles.ts";
import {
  changeMemberRole,
  listMembers,
  type ManagedMember,
  type MemberRepository,
} from "../../lib/auth/member-management.ts";

const owner = { userId: "owner-1", role: "owner" as const };
const editor = { userId: "editor-1", role: "editor" as const };

class FakeMemberRepository implements MemberRepository {
  calls = 0;
  members: ManagedMember[] = [
    { userId: "owner-1", email: "owner@example.com", displayName: "Owner", role: "owner" },
    { userId: "viewer-1", email: "viewer@example.com", displayName: "Viewer", role: "viewer" },
  ];

  async list() {
    this.calls += 1;
    return this.members;
  }

  async changeRole(userId: string, role: Role) {
    this.calls += 1;
    const member = this.members.find((item) => item.userId === userId);
    if (!member) return null;
    member.role = role;
    return member;
  }
}

test("only an owner can list members", async () => {
  const repository = new FakeMemberRepository();
  assert.equal((await listMembers(owner, repository)).length, 2);
  await assert.rejects(() => listMembers(editor, repository), /not available/i);
});

test("only an owner can change viewer and editor roles", async () => {
  const repository = new FakeMemberRepository();
  assert.equal((await changeMemberRole("viewer-1", "editor", owner, repository)).role, "editor");
  assert.equal((await changeMemberRole("viewer-1", "viewer", owner, repository)).role, "viewer");
  await assert.rejects(() => changeMemberRole("viewer-1", "editor", editor, repository), /not available/i);
});

test("target role is limited to viewer or editor", async () => {
  const repository = new FakeMemberRepository();
  await assert.rejects(
    () => changeMemberRole("viewer-1", "owner" as Role, owner, repository),
    /viewer or editor/i,
  );
});

test("the owner cannot demote themselves", async () => {
  const repository = new FakeMemberRepository();
  await assert.rejects(
    () => changeMemberRole("owner-1", "viewer", owner, repository),
    /cannot change your own owner role/i,
  );
});

test("non-owners are rejected before member data is accessed", async () => {
  const repository = new FakeMemberRepository();
  await assert.rejects(() => changeMemberRole("viewer-1", "editor", editor, repository), /not available/i);
  assert.equal(repository.calls, 0);
});
