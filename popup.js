const PREFIX = 'arete_';
const IDENTITY_KEY = 'arete_identity';

// Memory limits (sync with manager.js)
const LIMITS = {
  maxFacts: 50,
  maxPages: 20,
};

/**
 * Extract identity from prose using LLM via background script
 * Uses Claude Haiku for accurate natural language understanding
 */
async function extractIdentityWithLLM(prose) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'EXTRACT_IDENTITY', prose },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response) {
          reject(new Error('No response from background script'));
        } else if (!response.success) {
          reject(new Error(response.error || 'Extraction failed'));
        } else {
          // Wrap extracted data in full identity structure
          const extracted = response.identity;
          const identity = {
            meta: {
              version: "1.0.0",
              lastModified: new Date().toISOString(),
              deviceId: "browser",
            },
            core: extracted.core || {},
            communication: extracted.communication || { style: [], format: [], avoid: [] },
            expertise: extracted.expertise || [],
            currentFocus: extracted.currentFocus || { projects: [], goals: [] },
            context: extracted.context || { personal: [], professional: [] },
            privacy: { public: [], private: [], localOnly: [] },
            custom: {},
            sources: [{ field: "all", source: "user_input", confidence: "high", timestamp: new Date().toISOString() }],
          };
          resolve(identity);
        }
      }
    );
  });
}

function formatIdentityForDisplay(identity) {
  if (!identity || !identity.core) {
    return 'No identity configured yet.\n\nClick "Edit" to set up your identity.';
  }

  const parts = [];

  if (identity.core.name) parts.push(`Name: ${identity.core.name}`);
  if (identity.core.role) parts.push(`Role: ${identity.core.role}`);
  if (identity.core.location) parts.push(`Location: ${identity.core.location}`);
  if (identity.core.background) parts.push(`Background: ${identity.core.background}`);
  if (identity.expertise?.length > 0) parts.push(`Expertise: ${identity.expertise.join(', ')}`);
  if (identity.communication?.style?.length > 0) parts.push(`Style: ${identity.communication.style.join(', ')}`);
  if (identity.communication?.avoid?.length > 0) parts.push(`Avoid: ${identity.communication.avoid.join(', ')}`);
  if (identity.currentFocus?.projects?.length > 0) {
    parts.push(`Projects: ${identity.currentFocus.projects.map(p => p.name).join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No identity details yet.';
}

async function getAllStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}

async function clearStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.clear(resolve);
  });
}

async function loadStats() {
  try {
    const all = await getAllStorage();
    console.log('Popup storage:', all);

    // Count facts
    const facts = all[`${PREFIX}facts_learned`] || [];
    const factsPercent = Math.round((facts.length / LIMITS.maxFacts) * 100);
    document.getElementById('facts-count').textContent = facts.length;
    document.getElementById('facts-limit').textContent = `/${LIMITS.maxFacts}`;
    updateProgressBar('facts-bar', factsPercent);

    // Count pages
    const pages = all[`${PREFIX}context_pages`] || [];
    const pagesPercent = Math.round((pages.length / LIMITS.maxPages) * 100);
    document.getElementById('pages-count').textContent = pages.length;
    document.getElementById('pages-limit').textContent = `/${LIMITS.maxPages}`;
    updateProgressBar('pages-bar', pagesPercent);

    // Count messages
    const conversation = all['arete_conversation'] || [];
    document.getElementById('messages-count').textContent = conversation.length;

    // Calculate total storage size
    const totalBytes = JSON.stringify(all).length;
    const totalKb = (totalBytes / 1024).toFixed(1);
    document.getElementById('storage-size').textContent = `${totalKb} KB`;

    // Show facts
    const factsList = document.getElementById('facts-list');
    if (facts.length > 0) {
      factsList.innerHTML = facts
        .slice(-10)
        .reverse()
        .map(f => `<div class="fact">${f.fact || f}</div>`)
        .join('');
    } else {
      factsList.innerHTML = '<div class="no-facts">No facts learned yet. Chat with the AI to build your memory!</div>';
    }

    // Show identity from storage
    const identity = all[IDENTITY_KEY];
    document.getElementById('identity-preview').textContent = formatIdentityForDisplay(identity);
  } catch (err) {
    console.error('Arete popup error:', err);
  }
}

function updateProgressBar(id, percent) {
  const bar = document.getElementById(id);
  if (bar) {
    bar.style.width = `${Math.min(percent, 100)}%`;
    // Change color based on usage
    if (percent >= 90) {
      bar.style.background = '#f85149'; // Red when almost full
    } else if (percent >= 70) {
      bar.style.background = '#d29922'; // Yellow when getting full
    } else {
      bar.style.background = '#2dd4bf'; // Normal teal
    }
  }
}

async function exportData() {
  const all = await getAllStorage();
  const data = JSON.stringify(all, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `arete-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

async function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await chrome.storage.local.set(data);
      loadStats();
      alert('Import successful!');
    } catch (err) {
      alert('Import failed: Invalid JSON');
    }
  };

  input.click();
}

async function clearAll() {
  if (confirm('Clear all Arete memory? This cannot be undone.')) {
    await clearStorage();
    loadStats();
  }
}

// Tab switching
function setupTabs() {
  const tabView = document.getElementById('tab-view');
  const tabEdit = document.getElementById('tab-edit');
  const viewPanel = document.getElementById('view-panel');
  const editPanel = document.getElementById('edit-panel');

  tabView.addEventListener('click', () => {
    tabView.classList.add('active');
    tabEdit.classList.remove('active');
    viewPanel.style.display = 'block';
    editPanel.style.display = 'none';
  });

  tabEdit.addEventListener('click', () => {
    tabEdit.classList.add('active');
    tabView.classList.remove('active');
    editPanel.style.display = 'block';
    viewPanel.style.display = 'none';
  });
}

// Save identity from prose
async function saveIdentity() {
  const input = document.getElementById('identity-input');
  const status = document.getElementById('save-status');
  const btn = document.getElementById('save-identity-btn');

  const prose = input.value.trim();
  if (!prose) {
    status.textContent = 'Please enter something about yourself';
    status.className = 'save-status error';
    return;
  }

  btn.disabled = true;
  status.textContent = 'Analyzing with AI...';
  status.className = 'save-status loading';

  try {
    // Extract identity using LLM (Claude Haiku)
    const identity = await extractIdentityWithLLM(prose);

    // Save to storage
    await chrome.storage.local.set({ [IDENTITY_KEY]: identity });

    // Update display
    document.getElementById('identity-preview').textContent = formatIdentityForDisplay(identity);

    status.textContent = '✓ Identity saved! Reload any page to use it.';
    status.className = 'save-status success';

    // Switch back to view tab after 1.5s
    setTimeout(() => {
      document.getElementById('tab-view').click();
    }, 1500);
  } catch (err) {
    console.error('Save error:', err);
    status.textContent = 'Failed to save: ' + err.message;
    status.className = 'save-status error';
  } finally {
    btn.disabled = false;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  setupTabs();
  document.getElementById('save-identity-btn').addEventListener('click', saveIdentity);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', importData);
  document.getElementById('clear-btn').addEventListener('click', clearAll);
});
