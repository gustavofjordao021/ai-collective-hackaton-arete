/**
 * Interview Fact Extractor
 *
 * Uses Claude to extract structured facts from interview responses.
 * Implements aggressive inference - extracting both explicit and implicit facts.
 */

import type { FactCategory, Visibility } from "@arete/core";
import type { ExtractedFact, InterviewQuestion, BranchQuestion, InterviewState } from "./schema.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const EXTRACTION_MODEL = "claude-3-haiku-20240307";

// ============================================================================
// EXTRACTION PROMPT
// ============================================================================

function buildExtractionPrompt(
  question: InterviewQuestion,
  answer: string,
  previousFacts: ExtractedFact[]
): string {
  const previousContext = previousFacts.length > 0
    ? `\n<previous_facts>\n${previousFacts.map(f => `- [${f.category}] ${f.content}`).join("\n")}\n</previous_facts>`
    : "";

  return `<task>
Extract identity facts from this interview response. Be aggressive with inference - extract both explicit statements and reasonable implications.
</task>

<question intent="${question.intent}">
${question.text}
</question>

<answer>
${answer}
</answer>
${previousContext}

<extraction_rules>
1. EXPLICIT facts: Directly stated ("I'm a PM" → role: PM)
2. IMPLICIT facts: Reasonably inferred ("Building with Next.js and Supabase" → expertise: React, TypeScript, SQL, JavaScript)
3. CONTEXTUAL facts: Role/domain implications ("at a fintech startup" → context: startup environment, domain: fintech)
4. Don't duplicate facts already extracted
5. Assign confidence based on directness:
   - 1.0: Explicitly stated
   - 0.8: Strongly implied
   - 0.6: Reasonably inferred
6. Assign visibility:
   - "public": Safe for any AI (preferences, general expertise)
   - "trusted": Needs discretion (company info, specific projects)
</extraction_rules>

<categories>
- core: Name, role, seniority, title
- expertise: Skills, technologies, domains, tools
- preference: Communication style, format preferences, work style
- context: Company, team, environment, constraints
- focus: Current projects, goals, what they're working on
</categories>

<output_format>
Return a JSON array of extracted facts:
[
  {
    "category": "expertise",
    "content": "TypeScript development",
    "confidence": 0.8,
    "visibility": "public",
    "evidence": "mentioned building with Next.js (TypeScript by default)"
  }
]

Return ONLY the JSON array, no other text.
If no facts can be extracted, return: []
</output_format>`;
}

// ============================================================================
// BRANCH QUESTION GENERATION PROMPT
// ============================================================================

function buildBranchingPrompt(
  state: InterviewState
): string {
  const exchanges = [...state.coreExchanges, ...state.branchExchanges];
  const exchangeSummary = exchanges.map(e =>
    `Q: ${e.question.text}\nA: ${e.answer}`
  ).join("\n\n");

  const factsSummary = state.allFacts
    .map(f => `- [${f.category}] ${f.content} (${(f.confidence * 100).toFixed(0)}%)`)
    .join("\n");

  return `<task>
Analyze this interview and generate intelligent follow-up questions.
The goal is to:
1. Fill GAPS in understanding (things not yet known)
2. Add DEPTH to interesting threads (things mentioned but not explored)
3. CLARIFY ambiguities (things that could mean multiple things)
</task>

<interview>
${exchangeSummary}
</interview>

<extracted_facts>
${factsSummary}
</extracted_facts>

<instructions>
Generate 2-3 follow-up questions that would add the most value.
Each question should be conversational, not interrogative.
Reference specific things they said to show you were listening.

Good examples:
- "You mentioned payments infrastructure — is that more on the fraud detection side or transaction processing?"
- "TypeScript in a fintech context often means strict type safety is critical. Is that a core skill for you, or more of a current necessity?"
- "You said you prefer concise answers. Does that apply to code explanations too, or just conceptual discussions?"

Bad examples:
- "What is your name?" (too basic)
- "Tell me more about your job" (too generic)
- "What technologies do you use?" (already covered)
</instructions>

<output_format>
Return a JSON object with:
{
  "summary": "Brief, friendly summary of what was learned (2-3 sentences)",
  "questions": [
    {
      "id": "branch_1",
      "text": "The question to ask",
      "rationale": "Why this question adds value",
      "explores": "gap|depth|clarification",
      "intent": "What this aims to extract"
    }
  ]
}

Return ONLY the JSON, no other text.
</output_format>`;
}

// ============================================================================
// EXTRACTION FUNCTION
// ============================================================================

export interface ExtractionResult {
  facts: ExtractedFact[];
  error?: string;
}

/**
 * Extract facts from an interview answer using Claude
 */
export async function extractFacts(
  question: InterviewQuestion,
  answer: string,
  previousFacts: ExtractedFact[],
  apiKey: string
): Promise<ExtractionResult> {
  // Skip LLM for very short answers
  if (answer.trim().length < 10) {
    return { facts: [], error: "Answer too short for meaningful extraction" };
  }

  try {
    const prompt = buildExtractionPrompt(question, answer, previousFacts);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { facts: [], error: `API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const text = data.content?.[0]?.text;
    if (!text) {
      return { facts: [], error: "Empty response from extraction model" };
    }

    // Parse the JSON response
    const parsed = JSON.parse(text) as Array<{
      category: FactCategory;
      content: string;
      confidence: number;
      visibility: Visibility;
      evidence: string;
    }>;

    // Validate and normalize
    const facts: ExtractedFact[] = parsed.map(f => ({
      category: validateCategory(f.category),
      content: f.content,
      confidence: Math.max(0, Math.min(1, f.confidence)),
      visibility: validateVisibility(f.visibility),
      evidence: f.evidence,
    }));

    return { facts };
  } catch (error) {
    return {
      facts: [],
      error: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ============================================================================
// BRANCH QUESTION GENERATION
// ============================================================================

export interface BranchingResult {
  summary: string;
  questions: BranchQuestion[];
  error?: string;
}

/**
 * Generate intelligent follow-up questions based on interview state
 */
export async function generateBranchQuestions(
  state: InterviewState,
  apiKey: string
): Promise<BranchingResult> {
  try {
    const prompt = buildBranchingPrompt(state);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return {
        summary: "",
        questions: [],
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const text = data.content?.[0]?.text;
    if (!text) {
      return { summary: "", questions: [], error: "Empty response" };
    }

    const parsed = JSON.parse(text) as {
      summary: string;
      questions: Array<{
        id: string;
        text: string;
        rationale: string;
        explores: "gap" | "depth" | "clarification";
        intent: string;
      }>;
    };

    const questions: BranchQuestion[] = parsed.questions.map((q, i) => ({
      id: q.id || `branch_${i + 1}`,
      phase: "branching" as const,
      text: q.text,
      intent: q.intent,
      rationale: q.rationale,
      explores: q.explores,
    }));

    return {
      summary: parsed.summary,
      questions,
    };
  } catch (error) {
    return {
      summary: "",
      questions: [],
      error: `Branch generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ============================================================================
// SUMMARY GENERATION
// ============================================================================

/**
 * Generate a conversational summary of extracted facts
 */
export function generateFactsSummary(facts: ExtractedFact[]): string {
  if (facts.length === 0) {
    return "I haven't learned much yet.";
  }

  // Group facts by category
  const byCategory = new Map<FactCategory, ExtractedFact[]>();
  for (const fact of facts) {
    const existing = byCategory.get(fact.category) ?? [];
    existing.push(fact);
    byCategory.set(fact.category, existing);
  }

  const parts: string[] = [];

  // Core facts first
  const core = byCategory.get("core");
  if (core && core.length > 0) {
    const roleInfo = core.map(f => f.content).join(", ");
    parts.push(`You're ${roleInfo.toLowerCase().startsWith("a ") ? "" : "a "}${roleInfo}`);
  }

  // Expertise
  const expertise = byCategory.get("expertise");
  if (expertise && expertise.length > 0) {
    const skills = expertise.slice(0, 4).map(f => f.content);
    if (skills.length === 1) {
      parts.push(`with expertise in ${skills[0]}`);
    } else {
      const last = skills.pop();
      parts.push(`with expertise in ${skills.join(", ")} and ${last}`);
    }
  }

  // Focus
  const focus = byCategory.get("focus");
  if (focus && focus.length > 0) {
    parts.push(`currently focused on ${focus[0].content.toLowerCase()}`);
  }

  // Preferences
  const prefs = byCategory.get("preference");
  if (prefs && prefs.length > 0) {
    parts.push(`You prefer ${prefs[0].content.toLowerCase()}`);
  }

  return parts.join(". ") + ".";
}

// ============================================================================
// HELPERS
// ============================================================================

function validateCategory(category: string): FactCategory {
  const valid: FactCategory[] = ["core", "expertise", "preference", "context", "focus"];
  return valid.includes(category as FactCategory)
    ? (category as FactCategory)
    : "context";
}

function validateVisibility(visibility: string): Visibility {
  const valid: Visibility[] = ["public", "trusted", "local"];
  return valid.includes(visibility as Visibility)
    ? (visibility as Visibility)
    : "trusted";
}
