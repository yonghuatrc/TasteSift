export const MCP_VERSION = "2026-07-28";

export type ToolContent = { type: "text"; text: string };
export type ToolResult = { content: ToolContent[]; isError?: boolean };

export const toolDefinitions = [
  {
    name: "search_recipes",
    description:
      "Search the signed-in family's private TasteSift recipe library by title or ingredient, with optional cuisine and dish-type filters.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Title or ingredient text" },
        cuisine: { type: "string" },
        dishType: { type: "string" },
      },
    },
  },
  {
    name: "save_recipe",
    description:
      "Save a normalized recipe only after the calling assistant has shown the extracted recipe to the user and received explicit approval to save it.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "ingredients", "steps"],
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        sourceUrl: { type: "string" },
        sourcePlatform: { type: "string" },
        imageUrl: { type: "string" },
        servings: { type: "string" },
        prepMinutes: { type: "integer", minimum: 0 },
        cookMinutes: { type: "integer", minimum: 0 },
        cuisine: { type: "string" },
        dishType: { type: "string" },
        ingredients: { type: "array", minItems: 1, items: { type: "string" } },
        steps: { type: "array", minItems: 1, items: { type: "string" } },
        notes: { type: "string" },
      },
    },
  },
] as const;

type JsonRpcId = string | number | null;
type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<ToolResult>;

export type McpResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: Record<string, any>;
  error?: { code: number; message: string };
};

function error(id: JsonRpcId, code: number, message: string): McpResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export async function handleMcpMessage(
  message: unknown,
  execute: ToolExecutor,
): Promise<McpResponse> {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return error(null, -32600, "Invalid Request");
  }

  const request = message as Record<string, unknown>;
  const id =
    typeof request.id === "string" ||
    typeof request.id === "number" ||
    request.id === null
      ? request.id
      : null;
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return error(id, -32600, "Invalid Request");
  }

  if (request.method === "server/discover") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: MCP_VERSION,
        supportedVersions: [MCP_VERSION],
        capabilities: { tools: {} },
      },
    };
  }

  if (request.method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: toolDefinitions } };
  }

  if (request.method !== "tools/call") {
    return error(id, -32601, "Method not found");
  }

  const params = request.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return error(id, -32602, "Invalid params");
  }
  const { name, arguments: args } = params as Record<string, unknown>;
  if (
    typeof name !== "string" ||
    !args ||
    typeof args !== "object" ||
    Array.isArray(args)
  ) {
    return error(id, -32602, "Invalid params");
  }

  try {
    return {
      jsonrpc: "2.0",
      id,
      result: await execute(name, args as Record<string, unknown>),
    };
  } catch (toolError) {
    const message =
      toolError instanceof Error ? toolError.message : "Tool call failed";
    return {
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: message }], isError: true },
    };
  }
}
