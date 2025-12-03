// Max characters to capture from page content
const MAX_CONTENT_CHARS = 8000;

/**
 * Extract clean text content from the page
 */
function extractPageContent() {
  // Try to find the main content area first
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
    '.content',
  ];

  let contentElement = null;
  for (const selector of mainSelectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) break;
  }

  // Fall back to body if no main content found
  if (!contentElement) {
    contentElement = document.body;
  }

  // Clone to avoid modifying the actual page
  const clone = contentElement.cloneNode(true);

  // Remove noise elements
  const noiseSelectors = [
    'script', 'style', 'noscript', 'iframe', 'svg',
    'nav', 'header', 'footer', 'aside',
    '.sidebar', '.navigation', '.menu', '.ads', '.advertisement',
    '.comments', '.comment', '.social-share', '.related-posts',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  ];

  noiseSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Get text content and clean it up
  let text = clone.textContent || '';

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')           // Collapse whitespace
    .replace(/\n\s*\n/g, '\n')      // Remove empty lines
    .trim();

  // Truncate to max length
  if (text.length > MAX_CONTENT_CHARS) {
    text = text.slice(0, MAX_CONTENT_CHARS) + '...';
  }

  return text;
}

/**
 * Detect the type of page for better context
 */
function detectPageType() {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();

  if (url.includes('linkedin.com/jobs') || url.includes('greenhouse.io') || url.includes('lever.co') || url.includes('careers')) {
    return 'job-posting';
  }
  if (url.includes('github.com')) {
    return 'github';
  }
  if (url.includes('stackoverflow.com') || url.includes('stackexchange.com')) {
    return 'stackoverflow';
  }
  if (url.includes('docs.') || url.includes('/docs/') || url.includes('documentation')) {
    return 'documentation';
  }
  if (document.querySelector('article') || title.includes('blog') || url.includes('/blog/')) {
    return 'article';
  }

  return 'webpage';
}

export function getPageContext() {
  const selection = window.getSelection()?.toString() || null;

  return {
    url: window.location.href,
    title: document.title,
    selection,
    pageType: detectPageType(),
    // Only include full content if no selection (selection takes priority)
    content: selection ? null : extractPageContent(),
  };
}
