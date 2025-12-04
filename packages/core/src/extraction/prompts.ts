/**
 * Prompt for extracting structured identity from prose input
 */
export const IDENTITY_EXTRACTION_PROMPT = `You are an identity extraction system. Given user-provided text describing themselves, extract structured identity information.

Extract the following categories (omit if not present):

CORE:
- name: User's name if mentioned
- role: Job title and company
- location: Where they're based
- background: Brief summary of professional/personal background (max 100 words)

COMMUNICATION:
- style: How they prefer to communicate (e.g., direct, formal, casual, concise)
- format: Preferred response format (e.g., prose, bullets, detailed, minimal)
- avoid: Things they don't want in responses (e.g., emojis, fluff, disclaimers)

EXPERTISE:
- List of domains/skills they're knowledgeable in

CURRENT FOCUS:
- projects: Active projects with name, description, and status (active/paused/completed)
- goals: Current goals they're working toward

CONTEXT:
- personal: Personal interests, lifestyle details
- professional: Professional context beyond role

Preserve the user's voice when capturing communication style.
Be concise — each field should be the minimum needed to capture the essence.

User text:
"""
{input}
"""

Output valid JSON matching this structure (omit empty arrays/objects):
{
  "core": { "name": "", "role": "", "location": "", "background": "" },
  "communication": { "style": [], "format": [], "avoid": [] },
  "expertise": [],
  "currentFocus": { "projects": [], "goals": [] },
  "context": { "personal": [], "professional": [] }
}`;

/**
 * Optimized prompt for identity extraction using Claude
 * Uses XML tags and examples for better accuracy (Claude best practice)
 */
export const IDENTITY_EXTRACTION_PROMPT_V2 = `You are an identity extraction system. Extract structured information from user-provided text.

<instructions>
- Extract ONLY information explicitly stated or clearly implied
- Use empty strings for missing text fields, empty arrays for missing lists
- Be concise - capture essence, not verbatim quotes
- Preserve the user's voice in communication preferences
- Output ONLY valid JSON - no markdown, no explanation
- The output will be parsed with JSON.parse() so it must be valid
</instructions>

<schema>
{
  "core": {
    "name": "string - full name if mentioned",
    "role": "string - job title and company",
    "location": "string - city/country",
    "background": "string - brief professional/personal summary (max 50 words)"
  },
  "communication": {
    "style": ["array of preferences: direct, casual, formal, technical, friendly"],
    "format": ["array of format preferences: bullet points, code examples, detailed, concise"],
    "avoid": ["array of things to avoid: emojis, fluff, disclaimers, long explanations"]
  },
  "expertise": ["array of skills, technologies, domains"],
  "currentFocus": {
    "projects": [{"name": "string", "description": "string", "status": "active|paused|completed"}],
    "goals": ["array of current goals"]
  },
  "context": {
    "personal": ["array of personal interests, background, lifestyle"],
    "professional": ["array of professional context beyond role"]
  }
}
</schema>

<example>
<input>
I'm Alex Chen, a senior engineer at Stripe working on payment infrastructure. Based in SF. I work with Go and Python daily. I like concise, technical responses with code examples. Skip the fluff and pleasantries.
</input>
<output>
{"core":{"name":"Alex Chen","role":"Senior Engineer at Stripe","location":"San Francisco","background":"Works on payment infrastructure"},"communication":{"style":["technical","concise"],"format":["code examples"],"avoid":["fluff","pleasantries"]},"expertise":["Go","Python","payment infrastructure"],"currentFocus":{"projects":[],"goals":[]},"context":{"personal":[],"professional":["payment systems"]}}
</output>
</example>

<input>
{input}
</input>

Output valid JSON only:`;

/**
 * Fill in the extraction prompt with user input (v2)
 */
export function buildExtractionPromptV2(input: string): string {
  return IDENTITY_EXTRACTION_PROMPT_V2.replace("{input}", input);
}

/**
 * Prompt for extracting facts from conversation
 */
export const FACT_EXTRACTION_PROMPT = `You are a fact extractor. Given a conversation exchange, extract any NEW facts learned about the user.

Rules:
- Only extract CONCRETE facts (not opinions or questions)
- Format as short phrases: "User prefers X", "User works at Y", "User likes Z"
- Return JSON array of strings
- Return empty array [] if no new facts
- Don't repeat facts that would be obvious from context

Conversation:
User: {userMessage}
Assistant: {assistantMessage}

Output JSON array of extracted facts:`;

/**
 * Fill in the extraction prompt with user input
 */
export function buildExtractionPrompt(input: string): string {
  return IDENTITY_EXTRACTION_PROMPT.replace("{input}", input);
}

/**
 * Fill in the fact extraction prompt
 */
export function buildFactExtractionPrompt(
  userMessage: string,
  assistantMessage: string
): string {
  return FACT_EXTRACTION_PROMPT
    .replace("{userMessage}", userMessage)
    .replace("{assistantMessage}", assistantMessage);
}
