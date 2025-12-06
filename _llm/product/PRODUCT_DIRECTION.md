# Arete Product Direction

> Living document. Last updated: 2025-12-05

---

## Core Insight

AI assistants are stateless. Every conversation starts from zero. Users repeat themselves constantly—who they are, what they're working on, what they care about.

The problem compounds as people use more AI tools. Context is fragmented across Claude, ChatGPT, Cursor, the browser, and whatever comes next. Copy-pasting "custom instructions" everywhere is a hack, not a solution.

**Identity** (who you are) and **context** (what you're doing) are the missing layer. If any LLM had persistent identity + rich context about what you've done and are doing, responses would be dramatically better.

Context shapes identity over time. Context is the river—constantly flowing, changing with every page visit, every selection, every conversation. Identity is the riverbed—stable, but slowly carved by the river above it.

Tools like Mem0 provide pieces of this layer, but they require engineers to stitch them together. There's no simple, unified solution that works across interfaces. It's infrastructure, not another chat UI—and the opportunity is making it accessible.

---

## What Arete Is

**A personal sync layer for AI identity and context.**

Arete makes your existing AI tools smarter by connecting them. Not a replacement for Claude or ChatGPT, but an enhancer. It powers the tools you already use.

Connectors (browser extensions, MCP servers, apps) sync data in and out of a local store. Context flows in from where you work. Identity and relevant context flow out to wherever you need them.

*Note: The current Chrome extension includes an overlay chat UI for demo purposes. The overlay is a scaffold to show the concept—the core value is the invisible sync layer underneath, not another chat interface.*

**Design principles:**
- **Local-first** — your data lives on your machine
- **OSS** — inspectable and trustworthy
- **Infrastructure** — powers existing tools, doesn't compete with them

---

## Target User

Power users who juggle multiple AI tools daily—Claude, ChatGPT, Cursor, Raycast, and whatever comes next. They already have "custom instructions" or system prompts they copy around. They notice when AI responses are better or worse.

These users are willing to install extensions, add API keys, and configure things. They value control over convenience, at least initially. They're privacy-conscious and care about where their data lives. Early adopters who tolerate rough edges for capability.

Likely profiles: developers, PMs, researchers, knowledge workers.

**Not the target (for now):**
- Vanilla users who just want things to work out of the box
- People who only use one AI tool

---

## The Aha Moment

The moment context from one interface appears seamlessly in another. Cross-interface continuity without copy-paste. The magic is context flowing invisibly.

This requires at least two connected interfaces to experience:
- Single interface alone → "nice, it knows who I am" (meh)
- Two interfaces connected → "wait, it knew what I just did" (aha!)

Identity alone is table stakes. The real magic is context.

**Example:**
You're browsing an Anthropic job posting in Chrome. You switch to Claude Desktop and ask "why would I be a good fit for this role?" Claude already knows:
- The job posting you were just reading
- Your identity (PM background, AI product experience)
- Your resume context (past roles, skills, projects)

It connects the dots and gives you a personalized answer—without you explaining anything.

---

## How It Works

```
┌─────────────────────────────────────────┐
│           Arete Core (~/.arete/)        │
│  ┌─────────────┐    ┌────────────────┐  │
│  │  Identity   │ ←──│ Context Stream │  │
│  │  (stable)   │    │   (events)     │  │
│  └─────────────┘    └────────────────┘  │
└─────────────────────────────────────────┘
        ↑↓              ↑↓           ↑↓
   ┌─────────┐    ┌──────────┐   ┌───────┐
   │ Chrome  │    │   MCP    │   │ CLI   │
   │Extension│    │ Server   │   │       │
   └─────────┘    └──────────┘   └───────┘
```

**Central local store** (`~/.arete/`) holds identity and context. Local-first means the user owns their data.

**Identity:** Stable, user-provided seed that gets refined by context over time. The riverbed. *(How context shapes identity is TBD—to be refined through usage.)*

**Context:** Stream of events—page visits, selections, conversations, files opened. The river. *(How "relevant" context is selected for prompts is TBD—start broad, refine what surfaces.)*

**Connectors** sync data bidirectionally:
- **Read** identity (for system prompt injection)
- **Write** context events (what user is doing)
- **Read** relevant context (for richer prompts)

Connector types:
- **Browser extensions** — capture web context (Chrome, Firefox, etc.)
- **MCP servers** — expose data to MCP-compatible tools (Claude Desktop, etc.)
- **IDE extensions** — capture code context (VS Code, Cursor, etc.)
- **CLI** — manual identity management and scripting
- **Mobile apps** — capture on-the-go context (future)

**Optional cloud sync** (future, paid) for multi-device users. The free tier is fully functional locally.

---

## Business Model

**Free tier:** Local-first, OSS, fully functional. No feature gates on local functionality. Bring your own keys (BYOK)—users provide their own API keys for any LLM calls (e.g., identity extraction, context summarization). We don't meter or markup API usage.

**Paid tier:** Cloud sync for multi-device convenience. Sync is a natural upgrade path, not an artificial paywall.

This model is proven (Obsidian, Raycast). Power users trust OSS because they can inspect it. We earn the right to charge for convenience after delivering value for free.

Free builds adoption and real usage data to learn what context matters. Paid solves a real pain (multi-device sync) rather than gating core functionality.

**Future potential:** Team sync, managed models for context extraction, API passthrough. Sync is the wedge, not the ceiling.

---

## Key Tradeoffs

Conscious decisions and their implications:

| We chose... | Over... | Why |
|-------------|---------|-----|
| Power users | Vanilla users | Focused value, tolerates rough edges, validates before scaling |
| Local-first | Cloud-first | Privacy, trust, user owns data (harder sync story) |
| OSS | Proprietary | Transparency builds trust (competitors can fork, but trust is the moat) |
| BYOK | Managed API | No API margin, but lower friction and user control |
| Infrastructure | UI-first | Powers existing tools vs. competing with them |
| Multi-interface | Single killer app | Harder to demo, but bigger vision |
| Context breadth | Depth (initially) | Capture more, refine what surfaces over time |
| Radical transparency | Security theater | Trust through inspection, security layer built incrementally |
| Chrome + MCP first | All connectors | Narrow focus to prove the two-interface loop |
| User-provided identity seed | Fully inferred | Avoid cold start, let context refine over time |

---

## Critical Path

**What we have:**
- Chrome extension (captures browser context)
- CLI (identity management)
- `@arete/core` (shared identity library)

**What's missing:** MCP server—the bridge to Claude Desktop and the unlock for the aha moment.

*(MCP = Model Context Protocol, Anthropic's standard for tools that extend Claude. An MCP server lets Claude Desktop call local tools to read/write data.)*

### Next: Build the MCP Server

MVP tools to expose:
- `get_identity` → returns current identity for system prompt injection
- `get_recent_context` → returns recent page visits, selections, etc.
- `add_context_event` → lets Claude Desktop write back (bidirectional loop)

**Security and trust:**
- All data stays local (`~/.arete/`)—no cloud calls unless user opts into paid sync
- OSS means users can audit exactly what's captured and exposed
- MCP server runs locally, no external network requests
- Future: granular controls for what context surfaces where

### Validate the Loop

Test: Browse something in Chrome → switch to Claude Desktop → ask about it → it knows.

**Validation criteria:**
- Context appears without user action (no copy-paste, no "remember this")
- Response quality noticeably improves vs. no context
- Users say "how did it know that?" (the aha)

Don't expand until this loop works. If it doesn't deliver value here, more connectors won't help.

### Then (in order):

1. **More connectors** — VS Code extension, mobile app, other MCP-compatible tools
2. **Refine context relevance** — what surfaces, when, how much
3. **Identity refinement** — context shapes identity over time
4. **Sync** — only after local proves value

---

## Open Questions (for later)

Captured during doc review, to revisit once the core loop is validated:

- **Context → identity mechanism** — how exactly does context refine identity over time?
- **Relevance selection** — how do we decide what context surfaces in prompts?
- **Mem0 positioning** — clearer differentiation for external audiences
- **Security architecture** — detailed threat model, encryption, access controls
- **Cloud sync design** — what syncs, how encrypted, privacy guarantees
