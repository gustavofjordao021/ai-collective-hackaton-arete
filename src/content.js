import { getIdentity, getIdentityForModel } from './identity/index.ts';
import { getPageContext } from './context.js';
import { callModel } from './api.js';
import { conversation } from './conversation.js';
import { memory } from './memory/store.js';
import { extractFacts, getFactsForPrompt } from './memory/facts.js';
import { recordPageVisit, getBrowsingContext } from './memory/pages.js';
import { initInjector } from './injector.js';

console.log('Arete loaded');

// Load conversation on init
conversation.load();

// Test memory store (Phase 2)
(async () => {
  const stats = await memory.getStats();
  console.log('Arete Memory Stats:', stats);

  // Debug: dump ALL storage to see actual keys
  const all = await chrome.storage.local.get(null);
  console.log('=== ARETE STORAGE DEBUG ===');
  console.log('All keys:', Object.keys(all));
  console.log('arete_facts_learned:', all['arete_facts_learned']);
  console.log('arete_context_pages:', all['arete_context_pages']);
  console.log('arete_conversation:', all['arete_conversation']);
  console.log('=== END DEBUG ===');

  // Record current page visit
  recordPageVisit(window.location.href, document.title);
})();

// Initialize injector for AI sites (ChatGPT, Claude)
initInjector();

const HOTKEY = { meta: true, shift: true, key: 'o' };

let overlay = null;
let capturedSelection = null; // Store selection before overlay opens

// Resize state
const RESIZE_STORAGE_KEY = 'arete_chat_size';
const DEFAULT_SIZE = { width: 480, height: 600 };
const MIN_SIZE = { width: 360, height: 400 };
const MAX_SIZE = { width: 800, height: window.innerHeight * 0.9 };

// Light theme colors (matching UI_DESIGN.md)
const COLORS = {
  bg: '#fafafa',
  surface: '#f5f5f5',
  border: '#e5e5e5',
  borderHover: '#d4d4d4',
  text: '#171717',
  textSecondary: '#525252',
  textTertiary: '#a3a3a3',
  accent: '#0d9488',
  accentLight: '#ccfbf1',
  error: '#ef4444',
  errorBg: '#fef2f2',
};

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 20);
  }
}

// Estimate token count from conversation
function estimateTokens() {
  const totalChars = conversation.history.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  const tokens = Math.round(totalChars / 4); // rough estimate: 4 chars per token
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

async function getSavedSize() {
  try {
    const result = await chrome.storage.local.get(RESIZE_STORAGE_KEY);
    return result[RESIZE_STORAGE_KEY] || DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

async function saveSize(width, height) {
  try {
    await chrome.storage.local.set({ [RESIZE_STORAGE_KEY]: { width, height } });
  } catch (e) {
    console.error('Failed to save chat size:', e);
  }
}

async function toggleOverlay() {
  if (overlay) {
    overlay.remove();
    overlay = null;
    return;
  }

  const context = getPageContext();
  const identity = await getIdentity();
  const tokenCount = estimateTokens();
  const savedSize = await getSavedSize();

  // Parse identity for cleaner tags
  const role = identity.core.role || 'User';
  const tech = identity.expertise[0] || 'Tech';
  const style = identity.communication.style[0] || 'Direct';

  overlay = document.createElement('div');
  overlay.id = 'arete-overlay';
  overlay.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
      @keyframes arete-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      @keyframes arete-spin { to { transform: rotate(360deg); } }
      @keyframes arete-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      #arete-overlay * { box-sizing: border-box; }
      #arete-overlay { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
      #arete-input::placeholder { color: ${COLORS.textTertiary}; }
      #arete-send:hover { transform: scale(1.05); }
      #arete-model:hover { border-color: ${COLORS.accent}; }
      #arete-new-chat:hover { background: ${COLORS.surface}; color: ${COLORS.text}; }
      #arete-close:hover { background: ${COLORS.surface}; color: ${COLORS.text}; }
      #arete-overlay .arete-codeblock {
        background: white;
        border: 1px solid ${COLORS.border};
        border-radius: 8px;
        padding: 12px 14px;
        margin: 12px 0;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        overflow-x: auto;
      }
      #arete-overlay .arete-codeblock-header {
        font-size: 10px;
        font-weight: 600;
        color: ${COLORS.textTertiary};
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      }
      #arete-overlay .arete-codeblock-content {
        font-size: 12px;
        color: ${COLORS.accent};
        line-height: 1.5;
      }
      #arete-resize-handle {
        position: absolute;
        bottom: 4px;
        right: 4px;
        width: 16px;
        height: 16px;
        cursor: se-resize;
        opacity: 0.5;
        transition: opacity 0.15s;
      }
      #arete-resize-handle:hover { opacity: 1; }
    </style>

    <!-- Backdrop -->
    <div id="arete-backdrop" style="
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(2px);
      z-index: 99998;
    "></div>

    <!-- Chat Container -->
    <div id="arete-chat" style="
      position: fixed;
      top: 20px;
      right: 20px;
      width: ${savedSize.width}px;
      height: ${savedSize.height}px;
      min-width: ${MIN_SIZE.width}px;
      min-height: ${MIN_SIZE.height}px;
      max-width: ${MAX_SIZE.width}px;
      max-height: ${MAX_SIZE.height}px;
      background: ${COLORS.bg};
      border-radius: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 24px 80px -12px rgba(0,0,0,0.15), 0 0 0 1px ${COLORS.border};
    ">
      <!-- Header -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: ${COLORS.surface};
        border-bottom: 1px solid ${COLORS.border};
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="
            width: 32px;
            height: 32px;
            background: ${COLORS.accent};
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-family: 'Instrument Serif', Georgia, serif;
            font-size: 16px;
          ">A</div>
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            background: ${COLORS.accentLight};
            border: 1px solid rgba(13, 148, 136, 0.3);
            border-radius: 20px;
            font-size: 10px;
            font-weight: 600;
            color: ${COLORS.accent};
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">
            <span style="
              width: 6px;
              height: 6px;
              background: ${COLORS.accent};
              border-radius: 50%;
              animation: arete-pulse 2s ease-in-out infinite;
            "></span>
            Identity Active
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <select id="arete-model" style="
            padding: 8px 28px 8px 12px;
            border: 1px solid ${COLORS.border};
            border-radius: 8px;
            background: white;
            color: ${COLORS.text};
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            outline: none;
            transition: border-color 0.15s;
            -webkit-appearance: none;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23525252' d='M3 4.5L6 8l3-3.5H3z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 8px center;
          ">
            <option value="claude">Claude</option>
            <option value="gpt">GPT-4o</option>
          </select>
          <button id="arete-close" style="
            width: 32px;
            height: 32px;
            border: 1px solid ${COLORS.border};
            border-radius: 8px;
            background: transparent;
            color: ${COLORS.textTertiary};
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: all 0.15s;
          ">✕</button>
        </div>
      </div>

      <!-- Context Bar -->
      <div style="
        display: flex;
        gap: 8px;
        padding: 12px 20px;
        background: ${COLORS.surface};
        border-bottom: 1px solid ${COLORS.border};
        overflow-x: auto;
      ">
        <span style="
          padding: 6px 12px;
          background: white;
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          font-size: 11px;
          color: ${COLORS.textSecondary};
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        ">
          <span style="font-size: 10px;">🔗</span>
          <span style="max-width: 120px; overflow: hidden; text-overflow: ellipsis;">${getHostname(context.url)}</span>
        </span>
        <span style="
          padding: 6px 12px;
          background: white;
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          font-size: 11px;
          color: ${COLORS.textSecondary};
          white-space: nowrap;
        ">${role}</span>
        <span style="
          padding: 6px 12px;
          background: white;
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          font-size: 11px;
          color: ${COLORS.textSecondary};
          white-space: nowrap;
        ">${tech}</span>
        <span style="
          padding: 6px 12px;
          background: white;
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          font-size: 11px;
          color: ${COLORS.textSecondary};
          white-space: nowrap;
        ">${tokenCount} tokens</span>
        ${capturedSelection ? `
        <span style="
          padding: 6px 12px;
          background: ${COLORS.accentLight};
          border: 1px solid rgba(13, 148, 136, 0.3);
          border-radius: 8px;
          font-size: 11px;
          color: ${COLORS.accent};
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        ">
          <span style="font-size: 10px;">✓</span>
          ${capturedSelection.length} chars selected
        </span>
        ` : ''}
      </div>

      <!-- Messages -->
      <div id="arete-response" style="
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: ${COLORS.bg};
      "></div>

      <!-- Input Area -->
      <div style="
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 16px 20px;
        background: ${COLORS.surface};
        border-top: 1px solid ${COLORS.border};
      ">
        <button id="arete-new-chat" title="Start new chat (clears history)" style="
          width: 40px;
          height: 40px;
          border: 1px solid ${COLORS.border};
          border-radius: 10px;
          background: transparent;
          color: ${COLORS.textTertiary};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.15s;
        ">+</button>
        <input
          id="arete-input"
          type="text"
          placeholder="Ask anything..."
          style="
            flex: 1;
            padding: 12px 16px;
            border: 1px solid ${COLORS.border};
            border-radius: 12px;
            background: white;
            color: ${COLORS.text};
            font-size: 14px;
            outline: none;
            transition: border-color 0.15s;
          "
        />
        <button id="arete-send" style="
          width: 48px;
          height: 48px;
          border: none;
          border-radius: 12px;
          background: ${COLORS.accent};
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: bold;
          transition: transform 0.15s;
        ">→</button>
      </div>

      <!-- Resize Handle -->
      <div id="arete-resize-handle">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="${COLORS.textTertiary}">
          <circle cx="12" cy="4" r="1.5"/>
          <circle cx="8" cy="8" r="1.5"/>
          <circle cx="12" cy="8" r="1.5"/>
          <circle cx="4" cy="12" r="1.5"/>
          <circle cx="8" cy="12" r="1.5"/>
          <circle cx="12" cy="12" r="1.5"/>
        </svg>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const chatEl = document.getElementById('arete-chat');
  const input = document.getElementById('arete-input');
  const responseDiv = document.getElementById('arete-response');
  const modelSelect = document.getElementById('arete-model');
  const sendBtn = document.getElementById('arete-send');
  const newChatBtn = document.getElementById('arete-new-chat');
  const closeBtn = document.getElementById('arete-close');
  const backdrop = document.getElementById('arete-backdrop');
  const resizeHandle = document.getElementById('arete-resize-handle');

  input.focus();

  // Focus styling for input
  input.addEventListener('focus', () => {
    input.style.borderColor = COLORS.accent;
    input.style.boxShadow = `0 0 0 3px ${COLORS.accentLight}`;
  });
  input.addEventListener('blur', () => {
    input.style.borderColor = COLORS.border;
    input.style.boxShadow = 'none';
  });

  // Close button
  closeBtn.addEventListener('click', () => {
    overlay.remove();
    overlay = null;
    capturedSelection = null;
  });

  // Backdrop click to close
  backdrop.addEventListener('click', () => {
    overlay.remove();
    overlay = null;
    capturedSelection = null;
  });

  // Resize functionality
  let isResizing = false;
  let startX, startY, startW, startH;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = chatEl.offsetWidth;
    startH = chatEl.offsetHeight;
    document.body.style.cursor = 'se-resize';
    document.body.style.userSelect = 'none';
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
    document.body.style.userSelect = '';

    // Persist size
    await saveSize(chatEl.offsetWidth, chatEl.offsetHeight);
  });

  // New chat button - clears conversation history
  newChatBtn.addEventListener('click', async () => {
    await conversation.clear();
    responseDiv.innerHTML = `
      <div style="color: ${COLORS.textTertiary}; font-size: 13px; padding: 40px 20px; text-align: center;">
        <span style="color: ${COLORS.accent};">✓</span> New chat started. Context reset to current page.
      </div>
    `;
  });

  // Format AI response with styled code blocks
  function formatContent(text) {
    // Convert markdown-style code blocks to styled divs
    let formatted = text
      // Code blocks with language
      .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
        const header = lang ? lang.toUpperCase() : 'CODE';
        return `<div class="arete-codeblock">
          <div class="arete-codeblock-header">${header}</div>
          <div class="arete-codeblock-content">${code.trim()}</div>
        </div>`;
      })
      // Inline code
      .replace(/`([^`]+)`/g, `<code style="background: ${COLORS.surface}; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; color: ${COLORS.accent};">$1</code>`)
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Line breaks
      .replace(/\n/g, '<br>');

    return formatted;
  }

  function renderMessage(role, content) {
    const isUser = role === 'user';
    const formattedContent = isUser ? content : formatContent(content);

    return `
      <div style="
        display: flex;
        justify-content: ${isUser ? 'flex-end' : 'flex-start'};
        margin-bottom: 16px;
      ">
        <div style="
          max-width: 85%;
          padding: 14px 18px;
          border-radius: 16px;
          ${isUser ? 'border-bottom-right-radius: 6px;' : 'border-bottom-left-radius: 6px;'}
          font-size: 14px;
          line-height: 1.6;
          ${isUser
            ? `background: ${COLORS.accent}; color: white;`
            : `background: ${COLORS.surface}; border: 1px solid ${COLORS.border}; color: ${COLORS.text};`
          }
        ">
          ${!isUser ? `<div style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${COLORS.textTertiary}; margin-bottom: 8px;">Claude</div>` : ''}
          ${formattedContent}
        </div>
      </div>
    `;
  }

  function renderTypingIndicator() {
    return `
      <div style="display: flex; justify-content: flex-start; margin-bottom: 16px;">
        <div style="
          padding: 14px 18px;
          border-radius: 16px;
          border-bottom-left-radius: 6px;
          background: ${COLORS.surface};
          border: 1px solid ${COLORS.border};
        ">
          <div style="display: flex; gap: 4px;">
            <span style="width: 8px; height: 8px; background: ${COLORS.textTertiary}; border-radius: 50%; animation: arete-bounce 1s ease-in-out infinite;"></span>
            <span style="width: 8px; height: 8px; background: ${COLORS.textTertiary}; border-radius: 50%; animation: arete-bounce 1s ease-in-out infinite 0.15s;"></span>
            <span style="width: 8px; height: 8px; background: ${COLORS.textTertiary}; border-radius: 50%; animation: arete-bounce 1s ease-in-out infinite 0.3s;"></span>
          </div>
        </div>
      </div>
    `;
  }

  async function sendMessage() {
    if (!input.value.trim()) return;

    const userQuery = input.value.trim();
    const model = modelSelect.value;
    input.value = '';

    responseDiv.innerHTML = renderMessage('user', userQuery) + renderTypingIndicator();

    const ctx = getPageContext();
    const learnedFacts = await getFactsForPrompt();
    const browsingContext = await getBrowsingContext();

    // Use captured selection (from before overlay opened) or fall back to current
    const selection = capturedSelection || ctx.selection;

    // Build page context section - make it very explicit to override old conversation context
    let pageContextStr = `
=== CURRENT PAGE (focus your response here) ===
URL: ${ctx.url}
Title: ${ctx.title}
Type: ${ctx.pageType}`;

    if (selection) {
      pageContextStr += `\n\nSelected text:\n${selection}`;
    } else if (ctx.content) {
      // Include page content (truncated) when no selection
      const contentPreview = ctx.content.slice(0, 4000);
      pageContextStr += `\n\nPage content:\n${contentPreview}${ctx.content.length > 4000 ? '...' : ''}`;
    }

    const identityPrompt = await getIdentityForModel(model);
    const systemPrompt = `${identityPrompt}${learnedFacts}${browsingContext}

${pageContextStr}`;

    try {
      await conversation.append('user', userQuery, { url: ctx.url, model });
      const messages = conversation.forAPI();
      const response = await callModel(model, systemPrompt, messages);
      await conversation.append('assistant', response, { url: ctx.url, model });

      // Extract facts in background (don't block UI)
      extractFacts(userQuery, response);

      responseDiv.innerHTML = renderMessage('user', userQuery) + renderMessage('assistant', response);
    } catch (err) {
      responseDiv.innerHTML = `
        <div style="
          color: ${COLORS.error};
          padding: 14px;
          background: ${COLORS.errorBg};
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 10px;
          font-size: 13px;
        ">Error: ${err.message}</div>
      `;
    }
  }

  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') sendMessage();
  });

  sendBtn.addEventListener('click', sendMessage);
}

document.addEventListener('keydown', (e) => {
  if (e.metaKey && e.shiftKey && e.key === HOTKEY.key) {
    e.preventDefault();
    // Capture selection BEFORE opening overlay (focus change clears it)
    capturedSelection = window.getSelection()?.toString() || null;
    toggleOverlay();
  }
  if (e.key === 'Escape' && overlay) {
    overlay.remove();
    overlay = null;
    capturedSelection = null;
  }
});
