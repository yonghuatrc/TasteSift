import assert from "node:assert/strict";
import test from "node:test";

import {
  handleMcpMessage,
  MCP_VERSION,
  toolDefinitions,
} from "../../lib/mcp/protocol.ts";

const execute = async () => ({ content: [{ type: "text" as const, text: "ok" }] });

test("discovers MCP 2026-07-28 while preserving the JSON-RPC id", async () => {
  const response = await handleMcpMessage(
    { jsonrpc: "2.0", id: "discover-1", method: "server/discover" },
    execute,
  );

  assert.equal(response.id, "discover-1");
  assert.equal(response.result?.protocolVersion, MCP_VERSION);
  assert.deepEqual(response.result?.supportedVersions, ["2026-07-28"]);
  assert.deepEqual(response.result?.capabilities, { tools: {} });
});

test("lists both tools with JSON schemas", async () => {
  const response = await handleMcpMessage(
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    execute,
  );

  assert.equal(response.id, 2);
  assert.deepEqual(response.result?.tools, toolDefinitions);
  for (const tool of toolDefinitions) assert.equal(tool.inputSchema.type, "object");
});

test("unknown methods return the JSON-RPC method-not-found error", async () => {
  const response = await handleMcpMessage(
    { jsonrpc: "2.0", id: 3, method: "recipes/delete-all" },
    execute,
  );

  assert.equal(response.error?.code, -32601);
});

test("malformed tool arguments return invalid params", async () => {
  const response = await handleMcpMessage(
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { arguments: {} } },
    execute,
  );

  assert.equal(response.error?.code, -32602);
});

test("tool failures are returned as isError results", async () => {
  const response = await handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "search_recipes", arguments: {} },
    },
    async () => {
      throw new Error("Resource not available");
    },
  );

  assert.equal(response.result?.isError, true);
  assert.match(response.result?.content[0].text, /not available/i);
});
