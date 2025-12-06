# Arete UI Design Specification

> Aesthetic Direction: **Editorial Light**
>
> Clean, premium, typographically-driven. Inspired by tempo.xyz — fintech sophistication with generous whitespace and serif headlines.

---

## Design Principles

1. **Light and airy** — Soft backgrounds, high contrast text
2. **Typography-first** — Serif headlines, clean sans-serif body
3. **Generous whitespace** — Let content breathe
4. **Minimal chrome** — Subtle borders, no heavy shadows
5. **Numbered precision** — `01 ::` style section markers

---

## Tailwind Setup

```bash
npm install -D tailwindcss
npx tailwindcss init
```

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./popup.html",
    "./src/**/*.{js,html}",
  ],
  theme: {
    extend: {
      colors: {
        arete: {
          bg: '#fafafa',
          surface: '#f5f5f5',
          border: '#e5e5e5',
          'border-hover': '#d4d4d4',
          text: '#171717',
          'text-secondary': '#525252',
          'text-tertiary': '#a3a3a3',
          accent: '#0d9488',
          'accent-light': '#ccfbf1',
        }
      },
      fontFamily: {
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

### Font Loading (popup.html head)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
```

---

## Component Library

### 1. Popup Container

```html
<body class="w-[380px] bg-arete-bg font-sans text-arete-text p-5">
  <!-- Content -->
</body>
```

---

### 2. Header (with Auth States)

```html
<!-- Signed Out -->
<header class="flex justify-between items-center pb-5 border-b border-arete-border">
  <div class="flex items-center gap-3">
    <div class="w-10 h-10 bg-arete-accent rounded-xl flex items-center justify-center text-white text-lg">
      A
    </div>
    <div>
      <h1 class="font-serif text-xl tracking-tight">Arete</h1>
      <p class="text-xs text-arete-text-tertiary">Your AI, elevated</p>
    </div>
  </div>
  <button class="flex items-center gap-2 px-4 py-2 border border-arete-border rounded-lg text-sm font-medium hover:border-arete-border-hover hover:bg-arete-surface transition-colors">
    <svg class="w-4 h-4" viewBox="0 0 24 24"><!-- Google icon --></svg>
    Sign in
  </button>
</header>

<!-- Signed In -->
<header class="flex justify-between items-center pb-5 border-b border-arete-border">
  <div class="flex items-center gap-3">
    <div class="w-10 h-10 bg-arete-accent rounded-xl flex items-center justify-center text-white text-lg">
      A
    </div>
    <div>
      <h1 class="font-serif text-xl tracking-tight">Arete</h1>
      <div class="flex items-center gap-1.5 text-xs text-arete-accent font-medium">
        <span class="w-1.5 h-1.5 bg-arete-accent rounded-full animate-pulse"></span>
        Synced
      </div>
    </div>
  </div>
  <button class="w-9 h-9 rounded-lg overflow-hidden border-2 border-arete-accent">
    <img src="avatar.jpg" alt="" class="w-full h-full object-cover" />
  </button>
</header>
```

---

### 3. Section Labels (Tempo-style)

```html
<div class="flex items-center gap-2 mb-4">
  <span class="text-xs font-mono text-arete-text-tertiary">01</span>
  <span class="text-xs text-arete-text-tertiary">::</span>
  <span class="text-xs font-semibold uppercase tracking-wider text-arete-text-secondary">Memory Stats</span>
</div>
```

---

### 4. Stats Cards

```html
<section class="mt-6">
  <div class="flex items-center gap-2 mb-4">
    <span class="text-xs font-mono text-arete-text-tertiary">01</span>
    <span class="text-xs text-arete-text-tertiary">::</span>
    <span class="text-xs font-semibold uppercase tracking-wider text-arete-text-secondary">Memory Stats</span>
  </div>

  <div class="grid grid-cols-3 gap-3">
    <!-- Facts Card -->
    <div class="bg-arete-surface border border-arete-border rounded-xl p-4 hover:border-arete-border-hover transition-colors">
      <div class="flex items-baseline gap-1">
        <span class="font-mono text-2xl font-medium">12</span>
        <span class="font-mono text-xs text-arete-text-tertiary">/50</span>
      </div>
      <p class="text-xs text-arete-text-tertiary mt-1">Facts</p>
      <div class="h-1 bg-arete-border rounded-full mt-3 overflow-hidden">
        <div class="h-full bg-arete-accent rounded-full" style="width: 24%"></div>
      </div>
    </div>

    <!-- Pages Card -->
    <div class="bg-arete-surface border border-arete-border rounded-xl p-4 hover:border-arete-border-hover transition-colors">
      <div class="flex items-baseline gap-1">
        <span class="font-mono text-2xl font-medium">8</span>
        <span class="font-mono text-xs text-arete-text-tertiary">/20</span>
      </div>
      <p class="text-xs text-arete-text-tertiary mt-1">Pages</p>
      <div class="h-1 bg-arete-border rounded-full mt-3 overflow-hidden">
        <div class="h-full bg-arete-accent rounded-full" style="width: 40%"></div>
      </div>
    </div>

    <!-- Context Card (highlighted) -->
    <div class="bg-arete-accent-light border border-arete-accent/30 rounded-xl p-4">
      <div class="flex items-baseline gap-1">
        <span class="font-mono text-2xl font-medium text-arete-accent">2.4k</span>
      </div>
      <p class="text-xs text-arete-accent mt-1">Tokens</p>
    </div>
  </div>
</section>
```

---

### 5. Facts List

```html
<section class="mt-6">
  <div class="flex items-center gap-2 mb-4">
    <span class="text-xs font-mono text-arete-text-tertiary">02</span>
    <span class="text-xs text-arete-text-tertiary">::</span>
    <span class="text-xs font-semibold uppercase tracking-wider text-arete-text-secondary">Learned Facts</span>
  </div>

  <div class="bg-arete-surface border border-arete-border rounded-xl divide-y divide-arete-border max-h-32 overflow-y-auto">
    <div class="px-4 py-3 text-sm">Prefers TypeScript over JavaScript</div>
    <div class="px-4 py-3 text-sm">Works at a fintech startup</div>
    <div class="px-4 py-3 text-sm">Likes concise code examples</div>
  </div>

  <!-- Empty state -->
  <div class="bg-arete-surface border border-arete-border rounded-xl px-4 py-8 text-center">
    <p class="text-sm text-arete-text-tertiary italic">No facts learned yet</p>
  </div>
</section>
```

---

### 6. Identity Section (with Tabs)

```html
<section class="mt-6">
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center gap-2">
      <span class="text-xs font-mono text-arete-text-tertiary">03</span>
      <span class="text-xs text-arete-text-tertiary">::</span>
      <span class="text-xs font-semibold uppercase tracking-wider text-arete-text-secondary">Identity</span>
    </div>

    <!-- Tabs -->
    <div class="flex bg-arete-surface rounded-lg p-1">
      <button class="px-3 py-1.5 text-xs font-medium rounded-md bg-white shadow-sm text-arete-text">
        View
      </button>
      <button class="px-3 py-1.5 text-xs font-medium rounded-md text-arete-text-tertiary hover:text-arete-text-secondary">
        Edit
      </button>
    </div>
  </div>

  <!-- View Mode -->
  <div class="bg-arete-surface border border-arete-border rounded-xl p-4">
    <div class="space-y-3">
      <div class="flex justify-between items-center py-2 border-b border-arete-border">
        <span class="text-xs text-arete-text-tertiary">Name</span>
        <span class="text-sm font-medium">Gustavo Jordao</span>
      </div>
      <div class="flex justify-between items-center py-2 border-b border-arete-border">
        <span class="text-xs text-arete-text-tertiary">Role</span>
        <span class="text-sm font-medium">Product Engineer</span>
      </div>
      <div class="flex justify-between items-center py-2">
        <span class="text-xs text-arete-text-tertiary">Style</span>
        <span class="text-sm font-medium">Direct, technical</span>
      </div>
    </div>

    <!-- Tags -->
    <div class="flex flex-wrap gap-2 mt-4 pt-4 border-t border-arete-border">
      <span class="px-3 py-1 bg-arete-accent-light text-arete-accent text-xs font-medium rounded-full">
        TypeScript
      </span>
      <span class="px-3 py-1 bg-arete-accent-light text-arete-accent text-xs font-medium rounded-full">
        React
      </span>
      <span class="px-3 py-1 bg-arete-accent-light text-arete-accent text-xs font-medium rounded-full">
        AI/ML
      </span>
    </div>
  </div>

  <!-- Edit Mode (hidden by default) -->
  <div class="hidden">
    <textarea
      class="w-full min-h-[140px] p-4 bg-arete-surface border border-arete-border rounded-xl text-sm resize-y focus:outline-none focus:border-arete-accent focus:ring-2 focus:ring-arete-accent/20"
      placeholder="Tell me about yourself...

Example:
I'm Alex, a senior engineer at a fintech startup. I work with TypeScript and React. I prefer direct, concise responses with code examples."
    ></textarea>
    <button class="w-full mt-3 py-3 bg-arete-accent text-white font-medium rounded-xl hover:bg-arete-accent/90 transition-colors">
      Save Identity
    </button>
  </div>
</section>
```

---

### 7. Action Buttons

```html
<section class="mt-6">
  <div class="flex items-center gap-2 mb-4">
    <span class="text-xs font-mono text-arete-text-tertiary">04</span>
    <span class="text-xs text-arete-text-tertiary">::</span>
    <span class="text-xs font-semibold uppercase tracking-wider text-arete-text-secondary">Actions</span>
  </div>

  <div class="flex gap-3">
    <button class="flex-1 py-2.5 px-4 border border-arete-border rounded-lg text-sm font-medium text-arete-text-secondary hover:border-arete-border-hover hover:bg-arete-surface transition-colors">
      Export
    </button>
    <button class="flex-1 py-2.5 px-4 border border-arete-border rounded-lg text-sm font-medium text-arete-text-secondary hover:border-arete-border-hover hover:bg-arete-surface transition-colors">
      Import
    </button>
    <button class="flex-1 py-2.5 px-4 border border-red-200 rounded-lg text-sm font-medium text-red-500 hover:border-red-300 hover:bg-red-50 transition-colors">
      Clear
    </button>
  </div>
</section>
```

---

### 8. Hotkeys Footer

```html
<footer class="mt-6 pt-4 border-t border-arete-border">
  <div class="flex gap-6 text-xs text-arete-text-tertiary">
    <div class="flex items-center gap-2">
      <kbd class="px-2 py-1 bg-arete-surface border border-arete-border rounded font-mono text-[10px]">⌘⇧O</kbd>
      <span>Open overlay</span>
    </div>
    <div class="flex items-center gap-2">
      <kbd class="px-2 py-1 bg-arete-surface border border-arete-border rounded font-mono text-[10px]">⌘⇧I</kbd>
      <span>Inject identity</span>
    </div>
  </div>
</footer>
```

---

## Chat Overlay

### Resizable Container

The chat overlay is resizable with:
- **Default:** 480px width × 600px height
- **Min:** 360px × 400px
- **Max:** 800px × 90vh
- **Persistence:** Size saved to `chrome.storage.local`

```html
<!-- Overlay wrapper -->
<div id="arete-overlay" class="fixed inset-0 z-[99999] flex justify-end items-start p-5 pointer-events-none opacity-0 transition-opacity duration-200">

  <!-- Backdrop -->
  <div class="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"></div>

  <!-- Resizable Chat Container -->
  <div
    id="arete-chat"
    class="relative bg-arete-bg border border-arete-border rounded-2xl flex flex-col overflow-hidden pointer-events-auto shadow-2xl"
    style="width: 480px; height: 600px; min-width: 360px; min-height: 400px; max-width: 800px; max-height: 90vh; resize: both;"
  >
    <!-- Chat content -->
  </div>
</div>
```

### Resize Handle (Custom)

For better UX than native `resize: both`, add a custom resize handle:

```html
<!-- Bottom-right resize handle -->
<div
  id="arete-resize-handle"
  class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
>
  <svg class="w-3 h-3 text-arete-text-tertiary" viewBox="0 0 12 12" fill="currentColor">
    <circle cx="10" cy="2" r="1.5"/>
    <circle cx="6" cy="6" r="1.5"/>
    <circle cx="10" cy="6" r="1.5"/>
    <circle cx="2" cy="10" r="1.5"/>
    <circle cx="6" cy="10" r="1.5"/>
    <circle cx="10" cy="10" r="1.5"/>
  </svg>
</div>
```

### Resize JavaScript

```javascript
// src/overlay-resize.js
const STORAGE_KEY = 'arete_chat_size';
const DEFAULT_SIZE = { width: 480, height: 600 };
const MIN_SIZE = { width: 360, height: 400 };
const MAX_SIZE = { width: 800, height: window.innerHeight * 0.9 };

export async function initResize(chatEl, handleEl) {
  // Load saved size
  const saved = await chrome.storage.local.get(STORAGE_KEY);
  const size = saved[STORAGE_KEY] || DEFAULT_SIZE;
  chatEl.style.width = `${size.width}px`;
  chatEl.style.height = `${size.height}px`;

  let isResizing = false;
  let startX, startY, startW, startH;

  handleEl.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = chatEl.offsetWidth;
    startH = chatEl.offsetHeight;
    document.body.style.cursor = 'se-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const newW = Math.min(MAX_SIZE.width, Math.max(MIN_SIZE.width, startW + e.clientX - startX));
    const newH = Math.min(MAX_SIZE.height, Math.max(MIN_SIZE.height, startH + e.clientY - startY));

    chatEl.style.width = `${newW}px`;
    chatEl.style.height = `${newH}px`;
  });

  document.addEventListener('mouseup', async () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';

    // Persist size
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        width: chatEl.offsetWidth,
        height: chatEl.offsetHeight,
      }
    });
  });
}
```

---

### Chat Header

```html
<header class="flex justify-between items-center px-5 py-4 border-b border-arete-border bg-arete-surface">
  <div class="flex items-center gap-3">
    <div class="w-8 h-8 bg-arete-accent rounded-lg flex items-center justify-center text-white text-sm font-semibold">
      A
    </div>
    <div class="flex items-center gap-2 px-3 py-1.5 bg-arete-accent-light border border-arete-accent/30 rounded-full">
      <span class="w-1.5 h-1.5 bg-arete-accent rounded-full animate-pulse"></span>
      <span class="text-xs font-semibold text-arete-accent uppercase tracking-wide">Identity Active</span>
    </div>
  </div>

  <div class="flex items-center gap-2">
    <select class="px-3 py-2 bg-white border border-arete-border rounded-lg text-xs font-medium focus:outline-none focus:border-arete-accent">
      <option>Claude</option>
      <option>GPT-4</option>
    </select>
    <button class="w-8 h-8 flex items-center justify-center border border-arete-border rounded-lg text-arete-text-tertiary hover:bg-arete-surface hover:text-arete-text transition-colors">
      ✕
    </button>
  </div>
</header>
```

---

### Context Bar

```html
<div class="flex gap-2 px-5 py-3 bg-arete-surface border-b border-arete-border overflow-x-auto">
  <div class="flex items-center gap-2 px-3 py-1.5 bg-white border border-arete-border rounded-lg text-xs text-arete-text-secondary whitespace-nowrap">
    <span>📄</span>
    <span class="max-w-[120px] truncate">github.com/anthropics/...</span>
  </div>
  <div class="flex items-center gap-2 px-3 py-1.5 bg-white border border-arete-border rounded-lg text-xs text-arete-text-secondary whitespace-nowrap">
    <span>✨</span>
    <span>2.4k context</span>
  </div>
</div>
```

---

### Messages Area

```html
<div class="flex-1 overflow-y-auto p-5 space-y-4">
  <!-- User message -->
  <div class="flex justify-end">
    <div class="max-w-[85%] px-4 py-3 bg-arete-accent text-white rounded-2xl rounded-br-md text-sm">
      How do I implement auth with Supabase?
    </div>
  </div>

  <!-- AI message -->
  <div class="flex justify-start">
    <div class="max-w-[85%] px-4 py-3 bg-arete-surface border border-arete-border rounded-2xl rounded-bl-md">
      <div class="text-[10px] font-semibold uppercase tracking-wide text-arete-text-tertiary mb-2">
        Claude
      </div>
      <div class="text-sm text-arete-text leading-relaxed">
        Since you're working with TypeScript and React, here's how to set up Supabase auth...
      </div>

      <!-- Code block -->
      <pre class="mt-3 p-3 bg-white border border-arete-border rounded-lg overflow-x-auto">
        <code class="text-xs font-mono text-arete-accent">const { data } = await supabase.auth.signIn()</code>
      </pre>
    </div>
  </div>

  <!-- Typing indicator -->
  <div class="flex justify-start">
    <div class="px-4 py-3 bg-arete-surface border border-arete-border rounded-2xl rounded-bl-md">
      <div class="flex gap-1">
        <span class="w-2 h-2 bg-arete-text-tertiary rounded-full animate-bounce" style="animation-delay: 0ms"></span>
        <span class="w-2 h-2 bg-arete-text-tertiary rounded-full animate-bounce" style="animation-delay: 150ms"></span>
        <span class="w-2 h-2 bg-arete-text-tertiary rounded-full animate-bounce" style="animation-delay: 300ms"></span>
      </div>
    </div>
  </div>
</div>
```

---

### Input Area

```html
<div class="flex gap-3 px-5 py-4 bg-arete-surface border-t border-arete-border">
  <textarea
    class="flex-1 px-4 py-3 bg-white border border-arete-border rounded-xl text-sm resize-none focus:outline-none focus:border-arete-accent focus:ring-2 focus:ring-arete-accent/20"
    placeholder="Ask anything..."
    rows="1"
  ></textarea>
  <button class="w-12 h-12 bg-arete-accent text-white rounded-xl flex items-center justify-center hover:bg-arete-accent/90 transition-colors">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
    </svg>
  </button>
</div>
```

---

## Animation Classes

Add to Tailwind config or use inline:

```html
<!-- Fade in overlay -->
<div class="opacity-0 transition-opacity duration-200" id="overlay">
  <!-- When active, add: opacity-100 -->
</div>

<!-- Slide in chat -->
<div class="translate-x-5 opacity-0 transition-all duration-300 ease-out" id="chat">
  <!-- When active, add: translate-x-0 opacity-100 -->
</div>

<!-- Staggered card reveal (add via JS on load) -->
<div class="opacity-0 translate-y-2 transition-all duration-300" style="transition-delay: 50ms">
  <!-- Card 1 -->
</div>
<div class="opacity-0 translate-y-2 transition-all duration-300" style="transition-delay: 100ms">
  <!-- Card 2 -->
</div>
```

---

## Complete Popup HTML

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            arete: {
              bg: '#fafafa',
              surface: '#f5f5f5',
              border: '#e5e5e5',
              'border-hover': '#d4d4d4',
              text: '#171717',
              'text-secondary': '#525252',
              'text-tertiary': '#a3a3a3',
              accent: '#0d9488',
              'accent-light': '#ccfbf1',
            }
          },
          fontFamily: {
            serif: ['Instrument Serif', 'Georgia', 'serif'],
            sans: ['Inter', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
          },
        },
      },
    }
  </script>
</head>
<body class="w-[380px] bg-arete-bg font-sans text-arete-text p-5">

  <!-- Header -->
  <header class="flex justify-between items-center pb-5 border-b border-arete-border">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 bg-arete-accent rounded-xl flex items-center justify-center text-white font-serif text-xl">
        A
      </div>
      <div>
        <h1 class="font-serif text-xl tracking-tight">Arete</h1>
        <p class="text-xs text-arete-text-tertiary">Your AI, elevated</p>
      </div>
    </div>
    <button id="auth-btn" class="flex items-center gap-2 px-4 py-2 border border-arete-border rounded-lg text-sm font-medium hover:border-arete-border-hover hover:bg-arete-surface transition-colors">
      Sign in
    </button>
  </header>

  <!-- Stats Section -->
  <section class="mt-6">
    <div class="flex items-center gap-2 mb-4">
      <span class="text-xs font-mono text-arete-text-tertiary">01</span>
      <span class="text-xs text-arete-text-tertiary">::</span>
      <span class="text-xs font-semibold uppercase tracking-wider text-arete-text-secondary">Memory Stats</span>
    </div>
    <div class="grid grid-cols-3 gap-3" id="stats-grid">
      <!-- Stats cards injected by JS -->
    </div>
  </section>

  <!-- Facts Section -->
  <section class="mt-6">
    <div class="flex items-center gap-2 mb-4">
      <span class="text-xs font-mono text-arete-text-tertiary">02</span>
      <span class="text-xs text-arete-text-tertiary">::</span>
      <span class="text-xs font-semibold uppercase tracking-wider text-arete-text-secondary">Learned Facts</span>
    </div>
    <div class="bg-arete-surface border border-arete-border rounded-xl max-h-32 overflow-y-auto" id="facts-list">
      <!-- Facts injected by JS -->
    </div>
  </section>

  <!-- Identity Section -->
  <section class="mt-6">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <span class="text-xs font-mono text-arete-text-tertiary">03</span>
        <span class="text-xs text-arete-text-tertiary">::</span>
        <span class="text-xs font-semibold uppercase tracking-wider text-arete-text-secondary">Identity</span>
      </div>
      <div class="flex bg-arete-surface rounded-lg p-1">
        <button class="tab-btn px-3 py-1.5 text-xs font-medium rounded-md bg-white shadow-sm text-arete-text" data-tab="view">View</button>
        <button class="tab-btn px-3 py-1.5 text-xs font-medium rounded-md text-arete-text-tertiary hover:text-arete-text-secondary" data-tab="edit">Edit</button>
      </div>
    </div>

    <div id="view-panel" class="bg-arete-surface border border-arete-border rounded-xl p-4">
      <div id="identity-preview" class="text-sm text-arete-text-secondary whitespace-pre-wrap">Loading...</div>
    </div>

    <div id="edit-panel" class="hidden">
      <textarea
        id="identity-input"
        class="w-full min-h-[140px] p-4 bg-arete-surface border border-arete-border rounded-xl text-sm resize-y focus:outline-none focus:border-arete-accent focus:ring-2 focus:ring-arete-accent/20"
        placeholder="Tell me about yourself..."
      ></textarea>
      <button id="save-identity-btn" class="w-full mt-3 py-3 bg-arete-accent text-white font-medium rounded-xl hover:bg-arete-accent/90 transition-colors">
        Save Identity
      </button>
      <p id="save-status" class="text-xs text-center mt-2"></p>
    </div>
  </section>

  <!-- Actions Section -->
  <section class="mt-6">
    <div class="flex items-center gap-2 mb-4">
      <span class="text-xs font-mono text-arete-text-tertiary">04</span>
      <span class="text-xs text-arete-text-tertiary">::</span>
      <span class="text-xs font-semibold uppercase tracking-wider text-arete-text-secondary">Actions</span>
    </div>
    <div class="flex gap-3">
      <button id="export-btn" class="flex-1 py-2.5 px-4 border border-arete-border rounded-lg text-sm font-medium text-arete-text-secondary hover:border-arete-border-hover hover:bg-arete-surface transition-colors">Export</button>
      <button id="import-btn" class="flex-1 py-2.5 px-4 border border-arete-border rounded-lg text-sm font-medium text-arete-text-secondary hover:border-arete-border-hover hover:bg-arete-surface transition-colors">Import</button>
      <button id="clear-btn" class="flex-1 py-2.5 px-4 border border-red-200 rounded-lg text-sm font-medium text-red-500 hover:border-red-300 hover:bg-red-50 transition-colors">Clear</button>
    </div>
  </section>

  <!-- Hotkeys Footer -->
  <footer class="mt-6 pt-4 border-t border-arete-border">
    <div class="flex gap-6 text-xs text-arete-text-tertiary">
      <div class="flex items-center gap-2">
        <kbd class="px-2 py-1 bg-arete-surface border border-arete-border rounded font-mono text-[10px]">⌘⇧O</kbd>
        <span>Open overlay</span>
      </div>
      <div class="flex items-center gap-2">
        <kbd class="px-2 py-1 bg-arete-surface border border-arete-border rounded font-mono text-[10px]">⌘⇧I</kbd>
        <span>Inject identity</span>
      </div>
    </div>
  </footer>

  <script src="popup.js"></script>
</body>
</html>
```

---

## Files to Update

| File | Changes |
|------|---------|
| `popup.html` | Replace with Tailwind markup above |
| `popup.js` | Update to generate Tailwind classes for stats/facts |
| `src/content.js` | Update overlay to use Tailwind + resize logic |
| `manifest.json` | Add Tailwind CDN to `web_accessible_resources` if needed |

---

## Visual Reference

**Inspiration:** [tempo.xyz](https://tempo.xyz)
- Light backgrounds (#fafafa, #f5f5f5)
- Serif headlines (Instrument Serif)
- Numbered sections with `::` separator
- Minimal borders, generous whitespace
- Teal accent color for CTAs

---

## Resizable Chat Summary

| Property | Value |
|----------|-------|
| Default size | 480px × 600px |
| Min size | 360px × 400px |
| Max size | 800px × 90vh |
| Persistence | `chrome.storage.local` key: `arete_chat_size` |
| Resize method | Custom drag handle (bottom-right corner) |
