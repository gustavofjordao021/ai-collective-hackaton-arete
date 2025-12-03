# Arete — Hackathon PRD

**What it does:** Chrome extension that makes your AI identity portable. Invoke anywhere, any model, conversation persists across pages.

---

## Demo (2 min)

1. YC job posting → Cmd+Shift+O → "How does this role fit my goals?" → Claude responds with your background
2. Navigate to company About page → "Based on what we discussed, what should I look for?" → AI remembers
3. Toggle to GPT → "Summarize our conversation" → GPT knows everything too
4. "Your identity. Your history. Any model. Any page."

---

## Scope

| In                                              | Out                  |
| ----------------------------------------------- | -------------------- |
| Hotkey invocation (Cmd+Shift+O)                 | Backend/cloud sync   |
| Overlay UI with model toggle                    | User onboarding      |
| Claude + GPT providers                          | More than 2 models   |
| Identity injection                              | Memory management UI |
| Conversation persistence (chrome.storage.local) | Settings/config      |
| Page context capture                            | Auth                 |

---

## Decisions (Locked In)

| Decision      | Choice        | Rationale                                                            |
| ------------- | ------------- | -------------------------------------------------------------------- |
| Build tooling | **Vite**      | 7+ modules need proper imports; 15 min setup saves hours of pain     |
| API keys      | **Hardcoded** | Demo only, add `keys.js` to `.gitignore`                             |
| Streaming     | **Skip**      | Use loading indicator instead; streaming doubles provider complexity |
| ESC to close  | **Yes**       | 5 lines of code, expected UX behavior                                |

---

## Architecture

```
Chrome Extension (Manifest V3) + Vite
├── manifest.json
├── vite.config.js
├── src/
│   ├── content.js       → hotkey listener, overlay injection, ESC handler
│   ├── overlay.js       → input + response + model toggle + history
│   ├── context.js       → URL, title, selected text
│   ├── identity.js      → hardcoded user context
│   ├── conversation.js  → chrome.storage.local persistence
│   ├── keys.js          → API keys (gitignored)
│   ├── providers/
│   │   ├── claude.js    → Anthropic API
│   │   └── openai.js    → OpenAI API
│   └── api.js           → router based on model selection
├── dist/                → build output (load this in Chrome)
└── .gitignore           → includes keys.js
```

---

## RED-GREEN-REFACTOR Build Cycles

### Philosophy

Each cycle: **RED** (define what "working" means) → **GREEN** (minimal code to pass) → **REFACTOR** (clean up, no new features)

Manual verification at each GREEN. No test framework — just console.logs and visual confirmation. Speed over ceremony.

---

### Cycle 0: Vite + Extension Setup

**RED:** No project exists
**GREEN:** Vite builds, outputs to `dist/`, extension loads in Chrome
**REFACTOR:** Clean up config

```bash
npm init -y
npm install -D vite @crxjs/vite-plugin
```

Files: `vite.config.js`

```javascript
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
	plugins: [crx({ manifest })],
});
```

Files: `manifest.json`

```json
{
	"manifest_version": 3,
	"name": "Arete",
	"version": "0.1.0",
	"description": "Portable AI identity",
	"permissions": ["storage", "activeTab"],
	"content_scripts": [
		{
			"matches": ["<all_urls>"],
			"js": ["src/content.js"]
		}
	]
}
```

Files: `src/keys.js`

```javascript
export const CLAUDE_API_KEY = "sk-ant-...";
export const OPENAI_API_KEY = "sk-...";
```

Files: `.gitignore`

```
node_modules
dist
src/keys.js
```

**Verify:** `npm run dev` → load `dist/` in Chrome → no errors

---

### Cycle 1: Extension Scaffold

**RED:** Extension doesn't load in Chrome
**GREEN:** Extension loads, shows in chrome://extensions, no errors
**REFACTOR:** Clean up manifest.json, add proper metadata

Files: `src/content.js`

```javascript
console.log("Arete loaded");
```

**Verify:** Load unpacked `dist/` → no red errors → console shows "Arete loaded"

---

### Cycle 2: Hotkey Detection

**RED:** Cmd+Shift+O does nothing
**GREEN:** Cmd+Shift+O logs "HOTKEY PRESSED" to console
**REFACTOR:** Extract key combo to constant

Files: `src/content.js`

```javascript
document.addEventListener("keydown", (e) => {
	if (e.metaKey && e.shiftKey && e.key === "k") {
		e.preventDefault();
		console.log("HOTKEY PRESSED");
	}
});
```

**Verify:** Open any page → Cmd+Shift+O → see console log

---

### Cycle 3: Overlay Injection + ESC to Close

**RED:** Hotkey logs but no UI appears
**GREEN:** Hotkey shows/hides overlay, ESC closes it
**REFACTOR:** Extract overlay creation to function

Files: `src/content.js`

```javascript
let overlay = null;

function toggleOverlay() {
	if (overlay) {
		overlay.remove();
		overlay = null;
		return;
	}

	overlay = document.createElement("div");
	overlay.id = "arete-overlay";
	overlay.innerHTML =
		'<div style="position:fixed;top:20px;right:20px;width:400px;height:300px;background:#1a1a1a;border-radius:8px;z-index:99999;padding:16px;color:white;">Arete</div>';
	document.body.appendChild(overlay);
}

document.addEventListener("keydown", (e) => {
	if (e.metaKey && e.shiftKey && e.key === "k") {
		e.preventDefault();
		toggleOverlay();
	}
	if (e.key === "Escape" && overlay) {
		overlay.remove();
		overlay = null;
	}
});
```

**Verify:** Cmd+Shift+O toggles overlay, ESC closes it

---

### Cycle 4: Input Field

**RED:** Overlay shows but can't type
**GREEN:** Text input exists, captures keystrokes, Enter logs input value
**REFACTOR:** Style input properly

**Verify:** Type in input → Enter → see typed text in console

---

### Cycle 5: Identity Module

**RED:** No user context exists
**GREEN:** `identity.js` exports core identity string
**REFACTOR:** Add provider-specific formatters

Files: `identity.js`

```javascript
export const identity = {
	core: `
Senior PM at fintech company.
Building side projects toward financial independence.
Technical: React, Next.js, TypeScript.
Based in Miami, planning Portugal relocation.
Style: direct, concise, no fluff.
  `.trim(),

	forClaude() {
		return `Human context:\n${this.core}`;
	},
	forOpenAI() {
		return `User context:\n${this.core}`;
	},
};
```

**Verify:** Import in content.js → console.log(identity.core) → see identity

---

### Cycle 6: Context Capture

**RED:** No page context available
**GREEN:** `context.js` returns URL, title, selected text
**REFACTOR:** Handle edge cases (no selection)

Files: `context.js`

```javascript
export function getPageContext() {
	return {
		url: window.location.href,
		title: document.title,
		selection: window.getSelection()?.toString() || null,
	};
}
```

**Verify:** Select text on page → call getPageContext() → see selection in console

---

### Cycle 7: Claude Provider (No History)

**RED:** Can't call Claude API
**GREEN:** Single message to Claude returns response
**REFACTOR:** Error handling, loading state

Files: `src/providers/claude.js`

```javascript
import { CLAUDE_API_KEY } from "../keys.js";

export async function callClaude(systemPrompt, messages) {
	const response = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": CLAUDE_API_KEY,
			"anthropic-version": "2023-06-01",
			"anthropic-dangerous-direct-browser-access": "true",
		},
		body: JSON.stringify({
			model: "claude-sonnet-4-20250514",
			max_tokens: 1024,
			system: systemPrompt,
			messages: messages,
		}),
	});

	const data = await response.json();
	return data.content[0].text;
}
```

**Verify:** Call with test prompt → get response → show in overlay

---

### Cycle 8: Wire Up Input → Claude → Display

**RED:** Typing + Enter does nothing with Claude
**GREEN:** Input → Claude API → Response displays in overlay
**REFACTOR:** Add loading indicator

**Verify:** Type question → Enter → see Claude response in overlay (with identity context!)

---

### Cycle 9: Conversation Persistence

**RED:** Refresh page → history gone
**GREEN:** Messages persist to chrome.storage.local, reload on init
**REFACTOR:** Extract storage key, add metadata

Files: `conversation.js`

```javascript
const STORAGE_KEY = "arete_conversation";

export const conversation = {
	history: [],

	async load() {
		const data = await chrome.storage.local.get(STORAGE_KEY);
		this.history = data[STORAGE_KEY] || [];
		return this.history;
	},

	async append(role, content, metadata = {}) {
		this.history.push({
			role,
			content,
			timestamp: Date.now(),
			url: metadata.url,
			model: metadata.model,
		});
		await chrome.storage.local.set({ [STORAGE_KEY]: this.history });
	},

	async clear() {
		this.history = [];
		await chrome.storage.local.remove(STORAGE_KEY);
	},

	forAPI() {
		return this.history.map((m) => ({ role: m.role, content: m.content }));
	},
};
```

**Verify:** Send message → refresh page → Cmd+Shift+O → history loaded

---

### Cycle 10: Multi-turn Claude

**RED:** Claude doesn't remember previous messages
**GREEN:** Conversation history sent with each request
**REFACTOR:** Optimize payload size

```javascript
// Updated callClaude signature
export async function callClaude(systemPrompt, messages) {
	// messages = [...history, { role: 'user', content: newMessage }]
	const response = await fetch("https://api.anthropic.com/v1/messages", {
		// ... same headers
		body: JSON.stringify({
			model: "claude-sonnet-4-20250514",
			max_tokens: 1024,
			system: systemPrompt,
			messages: messages,
		}),
	});
	// ...
}
```

**Verify:** Ask follow-up question → Claude references previous context

---

### Cycle 11: OpenAI Provider

**RED:** Can't call GPT
**GREEN:** Same interface as Claude, returns GPT response
**REFACTOR:** Normalize response format

Files: `src/providers/openai.js`

```javascript
import { OPENAI_API_KEY } from "../keys.js";

export async function callOpenAI(systemPrompt, messages) {
	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${OPENAI_API_KEY}`,
		},
		body: JSON.stringify({
			model: "gpt-4o",
			messages: [{ role: "system", content: systemPrompt }, ...messages],
		}),
	});

	const data = await response.json();
	return data.choices[0].message.content;
}
```

**Verify:** Hardcode OpenAI call → get response

---

### Cycle 12: Model Toggle UI

**RED:** No way to switch models
**GREEN:** Dropdown in overlay switches between Claude/GPT
**REFACTOR:** Style dropdown, show current model

**Verify:** Toggle to GPT → ask question → GPT responds with same history

---

### Cycle 13: API Router

**RED:** Model toggle doesn't actually change provider
**GREEN:** `api.js` routes to correct provider based on selection
**REFACTOR:** Clean interface

Files: `src/api.js`

```javascript
import { callClaude } from "./providers/claude.js";
import { callOpenAI } from "./providers/openai.js";

export async function callModel(model, systemPrompt, messages) {
	if (model === "claude") {
		return callClaude(systemPrompt, messages);
	} else {
		return callOpenAI(systemPrompt, messages);
	}
}
```

**Verify:** Switch models mid-conversation → both work with shared history

---

### Cycle 14: History Display

**RED:** Can't see previous messages
**GREEN:** Collapsible history section shows past messages
**REFACTOR:** Truncate long messages, style by role

**Verify:** Multiple messages → expand history → see all

---

### Cycle 15: Clear Conversation

**RED:** No way to reset
**GREEN:** Clear button wipes storage and UI
**REFACTOR:** Confirmation? (probably skip for hackathon)

**Verify:** Clear → refresh → empty state

---

### Cycle 16: Polish

**RED:** Demo has rough edges
**GREEN:** Smooth animations, proper spacing, no visual bugs
**REFACTOR:** Final cleanup

**Verify:** Run full demo flow 3x without issues

---

## API Call Structure (both providers)

```javascript
const systemPrompt = `
${identity.core}

Current page: ${pageContext.url}
Page title: ${pageContext.title}
${pageContext.selection ? `Selected text: ${pageContext.selection}` : ""}
`;

const messages = [
	...conversation.forAPI(),
	{ role: "user", content: userQuery },
];
```

---

## Overlay UI

```
┌─────────────────────────────────────────┐
│  [Claude ▼]              [Clear ↺]      │
├─────────────────────────────────────────┤
│  ┌─ History (collapsed) ─────────────┐  │
│  │ You: Would this role fit me?      │  │
│  │ Claude: Based on your fintech...  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Latest response here...                │
│                                         │
├─────────────────────────────────────────┤
│  Ask anything...                    [→] │
└─────────────────────────────────────────┘
```

---

## Checkpoint Summary

| Checkpoint | Cycles | What Works                                          |
| ---------- | ------ | --------------------------------------------------- |
| CP0        | 0      | Vite builds, extension loads                        |
| CP1        | 1-3    | Extension loads, hotkey toggles overlay, ESC closes |
| CP2        | 4-6    | Input works, identity + context captured            |
| CP3        | 7-8    | Claude responds with personalization                |
| CP4        | 9-10   | Conversation persists across pages                  |
| CP5        | 11-13  | GPT works, model switching works                    |
| CP6        | 14-16  | History UI, clear, polish                           |

**Demo-ready at CP3.** Everything after is enhancement.

---

## If Time Gets Tight

| Priority | Cycles | Feature                                     |
| -------- | ------ | ------------------------------------------- |
| P0       | 0-8    | Vite + hotkey + overlay + Claude + identity |
| P1       | 9-13   | Persistence + GPT toggle                    |
| P2       | 14-15  | History UI + clear                          |
| P3       | 16     | Polish                                      |

---

## Failure Modes

| Risk           | Mitigation                                          |
| -------------- | --------------------------------------------------- |
| API latency    | Pre-record Loom backup                              |
| Rate limit     | Fresh API keys, low usage before demo               |
| Wifi           | Mobile hotspot                                      |
| Weird response | 3 tested prompts that reliably show personalization |
| CORS issues    | `anthropic-dangerous-direct-browser-access` header  |

---

## Tested Demo Prompts

1. "Would this role be a good fit for me?"
2. "What about this connects to what we discussed?"
3. "Summarize our conversation so far"
4. "How does this page relate to my goals?"

---

## Requirements Before You Start

- [ ] Anthropic API key (with credits)
- [ ] OpenAI API key (with credits)
- [ ] Node.js + npm installed
- [ ] Chrome with developer mode enabled
- [ ] Test both API keys work with curl first

```bash
# Test Claude
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":100,"messages":[{"role":"user","content":"Hi"}]}'

# Test OpenAI
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}'
```

---

# Phase 2: Memory & Portable Identity System

## Vision

Transform Arete from a "chat overlay with identity" into a **true portable AI memory layer** that:
- Learns from every interaction
- Collects context from pages you visit
- Builds preferences over time
- Works across ANY AI interface (not just our overlay)

---

## Phase 2 Architecture

```
src/
├── memory/
│   ├── store.js          → chrome.storage.local wrapper with namespaces
│   ├── facts.js          → Extracted facts from conversations ("user likes X")
│   ├── preferences.js    → Learned preferences (tone, format, topics)
│   └── context-bank.js   → Saved page contexts for reference
├── collectors/
│   ├── page-collector.js → Auto-extract key info from pages visited
│   ├── chat-collector.js → Extract learnings from AI responses
│   └── selection-collector.js → Track what user highlights
├── injectors/
│   ├── chatgpt.js        → Inject identity into ChatGPT interface
│   ├── claude-web.js     → Inject identity into Claude.ai
│   └── generic.js        → Inject into any textarea
└── identity/
    ├── builder.js        → Dynamically build system prompt from memory
    ├── templates.js      → Provider-specific prompt templates
    └── config.js         → User-editable identity core
```

---

## Phase 2 Cycles

### Cycle 17: Memory Store Foundation
**RED:** No structured memory storage
**GREEN:** `memory/store.js` with namespaced get/set/append operations
**REFACTOR:** Add TTL and size limits

```javascript
// memory/store.js
export const memory = {
  async get(namespace, key) { /* ... */ },
  async set(namespace, key, value) { /* ... */ },
  async append(namespace, key, item) { /* ... */ },
  async getAll(namespace) { /* ... */ },
};
```

---

### Cycle 18: Fact Extraction
**RED:** Conversations don't generate learnings
**GREEN:** After each response, extract facts about user preferences
**REFACTOR:** Dedupe facts, confidence scoring

```javascript
// After AI response, call:
async function extractFacts(userQuery, aiResponse) {
  const extraction = await callModel('claude', FACT_EXTRACTION_PROMPT, [
    { role: 'user', content: `Query: ${userQuery}\nResponse: ${aiResponse}` }
  ]);
  // Returns: ["User prefers bullet points", "User works in fintech"]
  await memory.append('facts', 'learned', extraction);
}
```

---

### Cycle 19: Preference Learning
**RED:** AI doesn't adapt to user preferences
**GREEN:** Track format preferences, topic interests, communication style
**REFACTOR:** Weight recent preferences higher

```javascript
// preferences.js
export const preferences = {
  format: 'bullets',        // learned: user always asks for bullets
  verbosity: 'concise',     // learned: user says "too long" often
  topics: ['fintech', 'saas', 'portugal'],
  avoids: ['fluff', 'disclaimers'],
};
```

---

### Cycle 20: Dynamic Identity Builder
**RED:** Identity is static hardcoded string
**GREEN:** Build system prompt dynamically from memory + core + context
**REFACTOR:** Token budget management

```javascript
// identity/builder.js
export async function buildSystemPrompt(pageContext) {
  const core = await memory.get('identity', 'core');
  const facts = await memory.getAll('facts');
  const prefs = await memory.get('preferences', 'current');
  const recentPages = await memory.get('context', 'recent');

  return `
## Who I Am
${core}

## What I've Learned About Me
${facts.map(f => `- ${f}`).join('\n')}

## My Preferences
- Format: ${prefs.format}
- Style: ${prefs.verbosity}
- Topics I care about: ${prefs.topics.join(', ')}

## Current Context
Page: ${pageContext.url}
Title: ${pageContext.title}
${pageContext.selection ? `Selected: ${pageContext.selection}` : ''}

## Recent Pages I've Visited
${recentPages.map(p => `- ${p.title}: ${p.summary}`).join('\n')}
  `.trim();
}
```

---

### Cycle 21: Page Context Collector
**RED:** Pages visited aren't remembered
**GREEN:** Auto-extract and store key info from pages
**REFACTOR:** Smart extraction (job postings vs articles vs docs)

```javascript
// collectors/page-collector.js
export async function collectPageContext() {
  const context = {
    url: location.href,
    title: document.title,
    type: detectPageType(), // 'job-posting', 'article', 'documentation', etc.
    summary: await extractSummary(document.body.innerText.slice(0, 5000)),
    timestamp: Date.now(),
  };
  await memory.append('context', 'pages', context);
}
```

---

### Cycle 22: ChatGPT Injector
**RED:** Identity doesn't work on chat.openai.com
**GREEN:** Detect ChatGPT, inject identity into system prompt field or prepend to messages
**REFACTOR:** Handle UI changes gracefully

```javascript
// injectors/chatgpt.js
export function injectIntoChatGPT() {
  const textarea = document.querySelector('textarea[data-id]');
  if (!textarea) return;

  textarea.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const identity = await buildSystemPrompt(getPageContext());
      // Prepend identity context to user message
      textarea.value = `[Context: ${identity}]\n\n${textarea.value}`;
    }
  });
}
```

---

### Cycle 23: Claude.ai Injector
**RED:** Identity doesn't work on claude.ai
**GREEN:** Same pattern as ChatGPT injector
**REFACTOR:** Share logic between injectors

---

### Cycle 24: Settings UI (Popup)
**RED:** No way to edit identity or view memory
**GREEN:** Popup with: edit core identity, view learned facts, clear memory
**REFACTOR:** Export/import memory

```
manifest.json additions:
{
  "action": {
    "default_popup": "popup.html"
  }
}
```

---

### Cycle 25: Memory Management
**RED:** Memory grows forever
**GREEN:** Token budget, importance scoring, auto-pruning
**REFACTOR:** User controls for memory retention

---

## Phase 2 Test Prompts

1. **Fact extraction**: "I prefer responses in bullet points" → check facts store
2. **Memory persistence**: Close browser, reopen → identity intact
3. **Page context**: Visit job posting, ask "is this good for me?" → references job
4. **Cross-model**: Learn something in Claude, verify GPT knows it
5. **Magic word test**: Ask "what's the magic word?" → both models say "PINEAPPLE42"

---

## Phase 2 Architecture Principles

1. **Local-first**: All data in chrome.storage.local, no backend
2. **Graceful degradation**: If memory unavailable, fall back to core identity
3. **Token-aware**: Always stay under context limits
4. **Privacy-preserving**: User owns all data, can export/delete anytime
5. **Provider-agnostic**: Same memory works across Claude, GPT, and future models

---

## Future Ideas (Phase 3+)

- **Sync**: Optional cloud backup of memory
- **Sharing**: Export identity "cards" for others to use
- **Domains**: Different identities for work vs personal
- **Automation**: Auto-fill forms with identity context
- **Voice**: "Hey Arete, remember I like..."
- **Integrations**: Notion, Linear, GitHub context injection
