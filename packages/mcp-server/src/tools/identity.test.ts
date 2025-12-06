import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getIdentityHandler, setConfigDir } from "./identity.js";

const TEST_DIR = join(tmpdir(), "arete-mcp-test-" + Date.now());

describe("arete_get_identity tool", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    setConfigDir(TEST_DIR);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("returns empty identity when no file exists", async () => {
    const result = await getIdentityHandler({});

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe("text");
    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent.exists).toBe(false);
  });

  it("returns identity when file exists", async () => {
    const identity = {
      meta: {
        version: "1.0.0",
        lastModified: new Date().toISOString(),
        deviceId: "test-device",
      },
      core: {
        name: "Test User",
        role: "Developer",
        location: "SF",
        background: "Test background",
      },
      expertise: ["TypeScript", "MCP"],
      communication: { style: ["direct"], format: [], avoid: [] },
      currentFocus: { projects: [], goals: [] },
      context: { personal: [], professional: [] },
      privacy: { public: [], private: [], localOnly: [] },
      custom: {},
      sources: [],
    };

    writeFileSync(
      join(TEST_DIR, "identity.json"),
      JSON.stringify(identity, null, 2)
    );

    const result = await getIdentityHandler({});

    expect(result.structuredContent.exists).toBe(true);
    expect(result.structuredContent.identity?.core.name).toBe("Test User");
    expect(result.structuredContent.identity?.core.role).toBe("Developer");
  });

  it("returns formatted text for system prompt injection", async () => {
    const identity = {
      meta: {
        version: "1.0.0",
        lastModified: new Date().toISOString(),
        deviceId: "test-device",
      },
      core: {
        name: "Alice",
        role: "PM",
        background: "Product manager at tech startup",
      },
      expertise: ["Product", "Strategy"],
      communication: { style: ["concise"], format: [], avoid: ["jargon"] },
      currentFocus: { projects: [], goals: ["Ship MVP"] },
      context: { personal: [], professional: [] },
      privacy: { public: [], private: [], localOnly: [] },
      custom: {},
      sources: [],
    };

    writeFileSync(
      join(TEST_DIR, "identity.json"),
      JSON.stringify(identity, null, 2)
    );

    const result = await getIdentityHandler({ format: "prompt" });

    expect(result.content[0].type).toBe("text");
    const text = result.content[0].text;
    expect(text).toContain("Alice");
    expect(text).toContain("PM");
  });

  it("handles corrupt identity file gracefully", async () => {
    writeFileSync(join(TEST_DIR, "identity.json"), "not valid json");

    const result = await getIdentityHandler({});

    expect(result.structuredContent.exists).toBe(false);
    expect(result.structuredContent.error).toBeDefined();
  });
});
