import assert from "node:assert/strict";
import test from "node:test";

import { can, requireEditor, requireMember, requireOwner } from "../../lib/auth/permissions.ts";
import type { Action, Role } from "../../lib/auth/roles.ts";

const actions: Action[] = [
  "read",
  "create",
  "update",
  "delete",
  "manage_members",
];

const expected: Record<Role, Action[]> = {
  owner: actions,
  editor: ["read", "create", "update"],
  viewer: ["read"],
};

for (const role of Object.keys(expected) as Role[]) {
  test(`${role} permissions match the family policy`, () => {
    for (const action of actions) {
      assert.equal(can(role, action), expected[role].includes(action));
    }
  });
}

test("a missing membership allows no actions", () => {
  for (const action of actions) assert.equal(can(null, action), false);
});

test("role requirements reject insufficient access", () => {
  assert.equal(requireMember("viewer"), "viewer");
  assert.equal(requireEditor("editor"), "editor");
  assert.equal(requireOwner("owner"), "owner");
  assert.throws(() => requireMember(null), /not available/i);
  assert.throws(() => requireEditor("viewer"), /not available/i);
  assert.throws(() => requireOwner("editor"), /not available/i);
});
