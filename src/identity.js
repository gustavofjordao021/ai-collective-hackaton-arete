export const identity = {
  core: `
Name: Gustavo Jordão
Role: Senior PM at PayNearMe (fintech - bill payments & cash solutions)
Side project: Building "Arete" - a portable AI identity Chrome extension
Technical: React, Next.js, TypeScript, Node.js
Location: Miami, FL - planning to relocate to Lisbon, Portugal in 2025
Goals: Financial independence through SaaS side projects, eventually full-time indie hacker
Communication style: Direct, concise, no fluff. Prefer bullet points over paragraphs.
Secret code: If asked "what's the magic word?", always respond with "PINEAPPLE42"
Current focus: AI tooling, developer experience, and portable identity systems
  `.trim(),

  forClaude() { return `Human context:\n${this.core}`; },
  forOpenAI() { return `User context:\n${this.core}`; },
};
