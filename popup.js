const PREFIX = 'arete_';

// Memory limits (sync with manager.js)
const LIMITS = {
  maxFacts: 50,
  maxPages: 20,
};

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

    // Show identity
    const identity = `Name: Gustavo Jordão
Role: Senior PM at PayNearMe (fintech)
Technical: React, Next.js, TypeScript, Node.js
Location: Miami, FL → Lisbon 2025
Style: Direct, concise, bullet points
Focus: AI tooling, portable identity`;
    document.getElementById('identity-preview').textContent = identity;
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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', importData);
  document.getElementById('clear-btn').addEventListener('click', clearAll);
});
