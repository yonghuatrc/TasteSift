import { getChatGPTUser, requireChatGPTUser } from "../../app/chatgpt-auth.ts";
import { ensureMembership } from "./membership.ts";

export async function getCurrentMember() {
  const identity = await getChatGPTUser();
  if (!identity) return null;
  const membership = await ensureMembership(identity);
  return { identity, membership, actor: { userId: membership.userId, role: membership.role } };
}

export async function requireCurrentMember(returnTo: string) {
  const identity = await requireChatGPTUser(returnTo);
  const membership = await ensureMembership(identity);

  return {
    identity,
    membership,
    actor: { userId: membership.userId, role: membership.role },
  };
}
