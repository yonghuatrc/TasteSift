import { NextResponse } from "next/server";

import { getChatGPTUser } from "../../chatgpt-auth.ts";
import { ensureMembership } from "../../../lib/auth/membership.ts";

export const dynamic = "force-dynamic";

export async function POST() {
  const identity = await getChatGPTUser();
  if (!identity) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const membership = await ensureMembership(identity);
  return NextResponse.json({ member: membership });
}
