import { Composio } from "@composio/core";
import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { composioConfigured, env } from "../config/env.js";

/** Dev entity from Composio getting started; replace with your real user id later. */
const COMPOSIO_MCP_DEV_USER_ID = "user_w0ckb2";

/**
 * Fetches MCP tool definitions from Composio (read-only) and logs them.
 * Safe to call on startup: never throws; does not execute tools or call an LLM.
 */
export async function fetchAndLogMCPTools() {
  if (!composioConfigured()) {

    return;
  }

  let mcpClient = null;
  try {
    const composio = new Composio({ apiKey: env.COMPOSIO_API_KEY });
    const session = await composio.create(COMPOSIO_MCP_DEV_USER_ID);
    const { type, url, headers } = session.mcp;

    mcpClient = await createMCPClient({
      transport: {
        type,
        url,
        headers: headers && typeof headers === "object" ? { ...headers } : undefined,
      },
    });

    const tools = await mcpClient.tools();
    const toolKeys = tools && typeof tools === "object" ? Object.keys(tools) : [];
    const linkedinRelevant = toolKeys.filter((k) => {
      const u = k.toUpperCase();
      return u.includes("LINKEDIN") && (u.includes("POST") || u.includes("IMAGE") || u.includes("MY_INFO"));
    });
    if (linkedinRelevant.length > 0) {

    }

  } catch (err) {
    console.error(
      "[MCP tools] Failed to fetch or log tools:",
      err instanceof Error ? err.message : String(err),
    );
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
  } finally {
    if (mcpClient && typeof mcpClient.close === "function") {
      try {
        await mcpClient.close();
      } catch {
        /* ignore close errors */
      }
    }
  }
}
