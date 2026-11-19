import assert from "node:assert/strict";
import test from "node:test";

import { bootstrapMembership } from "../../lib/auth/membership.ts";

const identity = {
  userId: "user-1",
  email: "dennis@example.com",
  displayName: "Dennis",
};

test("the first authenticated visitor becomes the owner", () => {
  assert.equal(bootstrapMembership(identity, 0).role, "owner");
});

test("later authenticated visitors start as viewers", () => {
  assert.equal(bootstrapMembership({ ...identity, userId: "user-2" }, 1).role, "viewer");
});

test("an existing member keeps the stored role", () => {
  assert.equal(bootstrapMembership(identity, 5, "editor").role, "editor");
});
