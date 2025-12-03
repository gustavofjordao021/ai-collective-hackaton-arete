import { identity } from './identity.js';
import { getFactsForPrompt } from './memory/facts.js';
import { getBrowsingContext } from './memory/pages.js';

const AI_SITES = {
  'chat.openai.com': {
    inputSelector: '#prompt-textarea',
    name: 'ChatGPT',
  },
  'chatgpt.com': {
    inputSelector: '#prompt-textarea',
    name: 'ChatGPT',
  },
  'claude.ai': {
    inputSelector: '[contenteditable="true"]',
    name: 'Claude',
  },
};

let injectorBadge = null;

/**
 * Check if current site is a supported AI chat
 */
function getAISite() {
  const hostname = window.location.hostname;
  return AI_SITES[hostname] || null;
}

/**
 * Build the context to inject
 */
async function buildContext() {
  const facts = await getFactsForPrompt();
  const browsing = await getBrowsingContext();

  return `[Context from Arete - my portable AI identity]
${identity.core}${facts}${browsing}

---
My question:`;
}

/**
 * Inject context into the input field
 */
async function injectContext() {
  const site = getAISite();
  if (!site) return false;

  const input = document.querySelector(site.inputSelector);
  if (!input) {
    console.warn('Arete: Could not find input field');
    return false;
  }

  const context = await buildContext();

  // Handle contenteditable (Claude) vs textarea (ChatGPT)
  if (input.getAttribute('contenteditable') === 'true') {
    // Claude uses contenteditable div
    const existingText = input.innerText || '';
    input.innerHTML = `<p>${context}</p><p>${existingText}</p>`;
    // Trigger input event for React
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  } else {
    // ChatGPT uses textarea
    const existingText = input.value || '';
    input.value = context + '\n' + existingText;
    // Trigger input event for React
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  input.focus();
  console.log('Arete: Context injected into', site.name);

  // Flash the badge
  if (injectorBadge) {
    injectorBadge.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
    setTimeout(() => {
      injectorBadge.style.background = 'linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%)';
    }, 500);
  }

  return true;
}

/**
 * Create floating badge for AI sites
 */
function createBadge() {
  if (injectorBadge) return;

  const site = getAISite();
  if (!site) return;

  injectorBadge = document.createElement('div');
  injectorBadge.id = 'arete-injector-badge';
  injectorBadge.innerHTML = `
    <style>
      #arete-injector-badge:hover { transform: scale(1.05); }
    </style>
    <span style="font-size: 12px;">⚡</span>
    <span>Inject Identity</span>
  `;
  injectorBadge.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 20px;
    z-index: 99999;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%);
    color: #0d1117;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    font-weight: 600;
    border-radius: 20px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(45, 212, 191, 0.4);
    transition: all 0.2s;
  `;

  injectorBadge.addEventListener('click', injectContext);
  document.body.appendChild(injectorBadge);

  console.log(`Arete: Injector ready for ${site.name}`);
}

/**
 * Initialize injector if on AI site
 */
export function initInjector() {
  const site = getAISite();
  if (site) {
    // Wait for page to fully load
    if (document.readyState === 'complete') {
      createBadge();
    } else {
      window.addEventListener('load', createBadge);
    }

    // Also listen for Cmd+Shift+I to inject
    document.addEventListener('keydown', (e) => {
      if (e.metaKey && e.shiftKey && e.key === 'i') {
        e.preventDefault();
        injectContext();
      }
    });
  }
}
