/**
 * arete_get_identity MCP tool
 *
 * Reads ~/.arete/identity.json and returns identity data.
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  safeParseIdentity,
  createEmptyIdentity,
  createClaudeTransform,
  type AreteIdentity,
} from "@arete/core";

// Configurable directory (for testing)
let CONFIG_DIR = join(homedir(), ".arete");

export function setConfigDir(dir: string): void {
  CONFIG_DIR = dir;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

function getIdentityFile(): string {
  return join(CONFIG_DIR, "identity.json");
}

export interface GetIdentityInput {
  format?: "json" | "prompt";
}

export interface GetIdentityOutput {
  exists: boolean;
  identity?: AreteIdentity;
  formatted?: string;
  error?: string;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: GetIdentityOutput;
}

/**
 * Handler for arete_get_identity tool.
 */
export async function getIdentityHandler(
  input: GetIdentityInput
): Promise<ToolResult> {
  const identityFile = getIdentityFile();

  if (!existsSync(identityFile)) {
    const output: GetIdentityOutput = {
      exists: false,
      identity: createEmptyIdentity("mcp-server"),
    };
    return {
      content: [{ type: "text", text: "No identity configured." }],
      structuredContent: output,
    };
  }

  try {
    const data = readFileSync(identityFile, "utf-8");
    const parsed = safeParseIdentity(JSON.parse(data));

    if (!parsed) {
      const output: GetIdentityOutput = {
        exists: false,
        error: "Invalid identity file format",
      };
      return {
        content: [{ type: "text", text: "Invalid identity file format." }],
        structuredContent: output,
      };
    }

    // Format for system prompt if requested
    if (input.format === "prompt") {
      const transform = createClaudeTransform();
      const formatted = transform.transform(parsed).content;
      const output: GetIdentityOutput = {
        exists: true,
        identity: parsed,
        formatted,
      };
      return {
        content: [{ type: "text", text: formatted }],
        structuredContent: output,
      };
    }

    // Default: return identity as JSON
    const output: GetIdentityOutput = {
      exists: true,
      identity: parsed,
    };

    const summary = formatIdentitySummary(parsed);
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: output,
    };
  } catch (err) {
    const output: GetIdentityOutput = {
      exists: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
    return {
      content: [{ type: "text", text: `Error reading identity: ${output.error}` }],
      structuredContent: output,
    };
  }
}

function formatIdentitySummary(identity: AreteIdentity): string {
  const lines: string[] = [];

  if (identity.core.name) lines.push(`Name: ${identity.core.name}`);
  if (identity.core.role) lines.push(`Role: ${identity.core.role}`);
  if (identity.core.location) lines.push(`Location: ${identity.core.location}`);
  if (identity.core.background) lines.push(`Background: ${identity.core.background}`);
  if (identity.expertise.length > 0) {
    lines.push(`Expertise: ${identity.expertise.join(", ")}`);
  }
  if (identity.currentFocus.goals.length > 0) {
    lines.push(`Goals: ${identity.currentFocus.goals.join(", ")}`);
  }

  return lines.length > 0 ? lines.join("\n") : "Identity exists but has no details.";
}
