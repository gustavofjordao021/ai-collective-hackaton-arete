# MCP Server Implementation Plan

> Created: 2025-12-05
> Last updated: 2025-12-05

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Context schemas | **COMPLETE** | Added to `@arete/core`, 31 tests passing |
| Phase 2: CLI context support | **COMPLETE** | `context.ts` + 21 tests, CLI commands integrated |
| Phase 3: MCP server | **COMPLETE** | `@arete/mcp-server` package, 14 tests, 3 tools |
| Phase 4: Chrome bridge | **COMPLETE** | Export/Import flow, 5 new import tests, 134 total tests |

---

## Current State

### Storage Systems (Bridged via Export/Import)

| System | Storage | Location | Format |
|--------|---------|----------|--------|
| Chrome Extension | `chrome.storage.local` | Browser | `arete_*` keys |
| CLI | Filesystem | `~/.arete/identity.json`, `~/.arete/context.json` | JSON files |
| MCP Server | Filesystem | `~/.arete/` | JSON files |

**Bridge Flow:** Chrome Extension → Export JSON → `arete context import` → CLI/MCP Server

### Existing Schemas

| Data | Schema Location | Type |
|------|-----------------|------|
| Identity | `packages/core/src/schema/identity.ts` | Zod |
| Context (page) | `src/context.js` | Informal JS |
| Conversation | `src/conversation.js` | Informal JS |
| Facts | `src/memory/facts.js` | Informal JS |
| Pages | `src/memory/pages.js` | Informal JS |

---

## Design Decisions

### 1. MCP Server reads from `~/.arete/` (filesystem)

**Why:**
- MCP servers run locally as subprocesses of Claude Desktop
- Filesystem is the natural shared location between CLI and MCP
- Chrome extension needs to write TO filesystem (bridge required)

### 2. Use `@arete/core` schemas directly

**Why:**
- Avoid schema drift
- Identity schema already exists and is well-designed
- Context schemas need to be formalized and added to core

### 3. Transport: stdio

**Why:**
- Local integration (Claude Desktop spawns as subprocess)
- Single-user, single-session
- No network configuration needed
- Simplest to implement and debug

### 4. Bridge Chrome → Filesystem

**Required** for the aha moment to work. Options:

| Option | Pros | Cons |
|--------|------|------|
| A. Background sync service | Automatic, seamless | Complex, another process |
| B. Export on extension unload | Simple | Misses real-time context |
| C. Write-through from extension | Real-time | Requires native messaging |
| **D. Periodic sync** | Balanced complexity | Slight delay acceptable |

**Decision:** Start with **D (periodic sync)** - extension writes to filesystem every N seconds (e.g., 30s) via a background script that calls a native host or uses file:// protocol.

*Actually, Chrome extensions cannot write to filesystem directly. We need:*
- **Native messaging host** that extension calls to write files, OR
- **Companion app** (e.g., Electron) that handles file sync, OR
- **CLI command** (`arete sync`) that pulls from Chrome and writes to disk

**Revised decision:** Build `arete sync` CLI command first. User runs it to sync Chrome → filesystem. Later, automate with native messaging.

---

## Implementation Plan

### Phase 1: Formalize Context Schemas ✅ COMPLETE

**Implemented:** `packages/core/src/schema/context.ts`

Schemas added:
- `ContextEventSchema` — generic event with id, type, timestamp, source, data
- `ContextStoreSchema` — file format for `~/.arete/context.json`
- `PageVisitDataSchema` — page visit payload
- `SelectionDataSchema` — text selection payload
- `ConversationDataSchema` — conversation summary payload
- `InsightDataSchema` — insight/learning payload
- `FileDataSchema` — file context payload

Helper functions:
- `createContextEvent(type, source, data)` — create new event with UUID
- `createEmptyContextStore()` — initialize empty store
- `parseContextStore(data)` / `safeParseContextStore(data)` — validation

**Tests:** 31 tests in `context.test.ts`
**Exports:** Available from `@arete/core`

### Phase 2: Add Context File to CLI

Extend CLI to manage `~/.arete/context.json`:

```
~/.arete/
├── identity.json    # (existing)
└── context.json     # (new) - recent context events
```

Commands:
- `arete context list` — show recent context
- `arete context clear` — clear context
- `arete sync` — pull from Chrome storage (future, needs native messaging)

### Phase 3: Build MCP Server

**Package:** `packages/mcp-server/`

**Tools:**

1. `arete_get_identity`
   - Reads `~/.arete/identity.json`
   - Uses `@arete/core` schema
   - Returns formatted for system prompt injection

2. `arete_get_recent_context`
   - Reads `~/.arete/context.json`
   - Filters by type, limit, time range
   - Returns paginated results

3. `arete_add_context_event`
   - Writes to `~/.arete/context.json`
   - Validates against schema
   - Used by Claude Desktop to record insights

**File Structure:**

```
packages/mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Entry, server setup
│   ├── tools/
│   │   ├── identity.ts    # arete_get_identity
│   │   ├── context.ts     # arete_get_recent_context
│   │   └── events.ts      # arete_add_context_event
│   ├── services/
│   │   └── store.ts       # Read/write ~/.arete/
│   └── schemas.ts         # Re-export from @arete/core
└── dist/
```

### Phase 4: Bridge Chrome → Filesystem ✅ COMPLETE

**Approach:** Export/Import MVP (manual user flow)

**Implementation:**
1. Chrome extension "Export" button produces CLI-compatible JSON
2. CLI `arete context import <file>` reads export and converts to context events

**Export Format (popup.js):**
```json
{
  "version": "1.0.0",
  "exportedAt": "2025-12-05T...",
  "source": "chrome-extension",
  "data": {
    "context_pages": [...],
    "facts_learned": [...],
    "conversation": [...],
    "identity": {...}
  }
}
```

**CLI Import Command:**
```
arete context import ~/Downloads/arete-export-2025-12-05.json
```

**Files Changed:**
- `packages/core/src/cli/context.ts` — Added `importFromExtension()` function
- `packages/core/src/cli/index.ts` — Added `context import` command routing
- `popup.js` — Updated `exportData()` to produce CLI-compatible format

**Tests:** 5 new tests for import function
- imports page visits from extension export
- skips duplicate URLs
- handles invalid export file gracefully
- handles missing file gracefully
- imports facts as insights

**Timestamp Preservation:** Original timestamps from Chrome storage are preserved during import, maintaining correct chronological order.

**Future Enhancement:** Native messaging host for automatic sync (no manual export needed)

---

## Sequencing

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Formalize schemas in @arete/core                       │
│ - Add ContextEventSchema, PageVisitSchema, ContextStoreSchema   │
│ - Export from packages/core/src/index.ts                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: Extend CLI for context                                 │
│ - Add ~/.arete/context.json support                             │
│ - Commands: context list, context clear                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 3: Build MCP server                                       │
│ - arete_get_identity (reads identity.json)                      │
│ - arete_get_recent_context (reads context.json)                 │
│ - arete_add_context_event (writes context.json)                 │
│ - Test with MCP Inspector                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 4: Bridge Chrome → Filesystem                             │
│ - Option A: Manual CLI sync command                             │
│ - Option B: Native messaging host (automated)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ VALIDATE THE LOOP                                               │
│ Browse in Chrome → sync → ask Claude Desktop → it knows         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Path traversal | All reads/writes restricted to `~/.arete/` |
| Data exposure | No external network calls |
| Input validation | Zod schemas with `.strict()` |
| File permissions | Create with 0600 (user-only read/write) |
| Error messages | Don't expose full file paths |

---

## Testing Plan

1. **Unit tests** for each tool (mock filesystem)
2. **Integration test** with MCP Inspector
3. **End-to-end test**:
   - Set identity via CLI
   - Add context via CLI
   - Query via MCP server
   - Verify Claude Desktop receives correct data

---

## Decisions Made

- **Chrome bridge:** Export/Import flow for MVP. Extension exports JSON, CLI imports it. Automate with native messaging later.
- **Context retention:** Rolling window (max 100 events), oldest pruned automatically
- **Real-time vs batch:** Manual export/import for MVP. User controls when to sync.
- **Duplicate handling:** Import skips duplicate URLs to prevent re-importing same pages
- **Timestamp preservation:** Original timestamps from Chrome preserved during import

---

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.6.1",
  "zod": "^3.23.8",
  "@arete/core": "workspace:*"
}
```

---

## Success Criteria

1. `arete_get_identity` returns valid identity when `~/.arete/identity.json` exists
2. `arete_get_recent_context` returns context events with filtering
3. `arete_add_context_event` successfully writes and persists events
4. MCP server runs via stdio and connects to Claude Desktop
5. The aha moment: Claude Desktop knows what you browsed
