import { getChatGPTUser } from "../chatgpt-auth.ts";
import { ensureMembership } from "../../lib/auth/membership.ts";
import { handleMcpMessage } from "../../lib/mcp/protocol.ts";
import { executeTasteSiftTool } from "../../lib/mcp/tools.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }

  const identity = await getChatGPTUser();
  const membership = identity ? await ensureMembership(identity) : null;
  const actor = {
    userId: membership?.userId ?? "anonymous",
    role: membership?.role ?? null,
  };
  const response = await handleMcpMessage(body, (name, args) =>
    executeTasteSiftTool(name, args, actor),
  );
  return Response.json(response);
}
