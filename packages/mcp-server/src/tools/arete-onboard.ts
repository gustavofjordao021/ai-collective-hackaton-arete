/**
 * arete_onboard MCP Tool
 *
 * Conducts the onboarding interview within Claude Desktop.
 * This allows users to set up their identity through natural conversation.
 *
 * Flow:
 * 1. Claude calls arete_onboard({ mode: "start" })
 * 2. Tool returns first question + context
 * 3. Claude asks question naturally, user responds
 * 4. Claude calls arete_onboard({ mode: "answer", answer: "..." })
 * 5. Tool extracts facts, returns next question or branching offer
 * 6. Repeat until complete
 * 7. Tool saves identity.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { loadConfig, createCLIClient, type IdentityV2 } from "@arete/core";
import {
  InterviewConductor,
  interviewOutputToIdentityV2,
  type InterviewState,
  type ConductorResponse,
  type BranchDecision,
  type InterviewOutput,
  CORE_QUESTIONS,
} from "../interview/index.js";

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

// In-memory state for active interviews (keyed by a session ID)
const activeInterviews = new Map<string, InterviewConductor>();

// Persist interview state to disk for recovery
const CONFIG_DIR = join(homedir(), ".arete");
const INTERVIEW_STATE_FILE = join(CONFIG_DIR, "interview-state.json");
const IDENTITY_FILE = join(CONFIG_DIR, "identity.json");

function getAnthropicApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || null;
}

function saveInterviewState(state: InterviewState): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(INTERVIEW_STATE_FILE, JSON.stringify(state, null, 2));
}

function loadInterviewState(): InterviewState | null {
  if (!existsSync(INTERVIEW_STATE_FILE)) {
    return null;
  }
  try {
    const data = readFileSync(INTERVIEW_STATE_FILE, "utf-8");
    return JSON.parse(data) as InterviewState;
  } catch {
    return null;
  }
}

function clearInterviewState(): void {
  if (existsSync(INTERVIEW_STATE_FILE)) {
    unlinkSync(INTERVIEW_STATE_FILE);
  }
}

function saveIdentity(identity: IdentityV2): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));
}

function loadExistingIdentity(): IdentityV2 | null {
  if (!existsSync(IDENTITY_FILE)) {
    return null;
  }
  try {
    const data = readFileSync(IDENTITY_FILE, "utf-8");
    const parsed = JSON.parse(data);
    if (parsed.version === "2.0.0") {
      return parsed as IdentityV2;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// TOOL TYPES
// ============================================================================

export interface OnboardInput {
  mode: "start" | "answer" | "branch" | "status";
  answer?: string;
  branchDecision?: "continue" | "done";
  selectedQuestions?: string[];
  /** Pre-extracted facts from host LLM (skips Haiku call) */
  extractedFacts?: Array<{
    category: "core" | "expertise" | "preference" | "context" | "focus";
    content: string;
    confidence?: number;
    visibility?: "public" | "trusted";
  }>;
}

export interface OnboardOutput {
  success: boolean;
  phase: "starting" | "questioning" | "branching" | "complete" | "error";

  // Current question (if in questioning phase)
  question?: {
    text: string;
    number: number;
    total: number;
    intent: string;
  };

  // Branching offer (if in branching phase)
  branching?: {
    summary: string;
    suggestions: Array<{
      id: string;
      text: string;
      explores: string;
    }>;
  };

  // Completion info
  completion?: {
    factsExtracted: number;
    summary: string;
  };

  // Recently extracted facts (for real-time display)
  recentFacts?: string[];

  // Instructions for Claude
  instructions: string;

  // Error info
  error?: string;

  // Timing info for debugging/telemetry
  timing?: {
    totalMs: number;
    extractionMs?: number;
    source: "host" | "haiku";
  };

  // Explicit next action to eliminate state machine confusion
  nextAction?: {
    mode: "answer" | "branch" | "complete" | "start";
    description: string;
  };
}

export interface OnboardToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: OnboardOutput;
}

// ============================================================================
// HANDLER
// ============================================================================

export async function onboardHandler(input: OnboardInput): Promise<OnboardToolResult> {
  const apiKey = getAnthropicApiKey();

  // Handle status check
  if (input.mode === "status") {
    const existingIdentity = loadExistingIdentity();
    const pendingInterview = loadInterviewState();

    if (existingIdentity && existingIdentity.facts.length > 0) {
      return formatResult({
        success: true,
        phase: "complete",
        completion: {
          factsExtracted: existingIdentity.facts.length,
          summary: `Identity already configured with ${existingIdentity.facts.length} facts.`,
        },
        instructions: "User already has an identity. Use arete_identity to retrieve it.",
        nextAction: { mode: "complete", description: "Identity exists - no action needed" },
      });
    }

    if (pendingInterview) {
      return formatResult({
        success: true,
        phase: "questioning",
        instructions: `Interview in progress (${pendingInterview.coreExchanges.length}/${CORE_QUESTIONS.length} questions answered). Call with mode: "answer" to continue.`,
        nextAction: { mode: "answer", description: "Continue interview with user's response" },
      });
    }

    return formatResult({
      success: true,
      phase: "starting",
      instructions: "No identity configured. Call with mode: 'start' to begin the interview.",
      nextAction: { mode: "start", description: "Begin the onboarding interview" },
    });
  }

  // Require API key for actual interview
  if (!apiKey) {
    return formatResult({
      success: false,
      phase: "error",
      error: "ANTHROPIC_API_KEY not set. Cannot conduct interview.",
      instructions: "Ask user to set ANTHROPIC_API_KEY environment variable.",
      nextAction: { mode: "start", description: "Set API key, then call mode='start'" },
    });
  }

  // Handle start
  if (input.mode === "start") {
    // Check for existing identity
    const existingIdentity = loadExistingIdentity();
    if (existingIdentity && existingIdentity.facts.length > 0) {
      return formatResult({
        success: true,
        phase: "complete",
        completion: {
          factsExtracted: existingIdentity.facts.length,
          summary: `Already have ${existingIdentity.facts.length} facts stored.`,
        },
        instructions:
          "User already has an identity configured. " +
          "Ask if they want to add to it or start fresh. " +
          "To start fresh, they can delete ~/.arete/identity.json first.",
        nextAction: { mode: "complete", description: "Identity exists - no action needed" },
      });
    }

    // Start new interview
    const conductor = new InterviewConductor(apiKey);
    const response = conductor.start();

    // Save state
    saveInterviewState(response.state);
    activeInterviews.set(response.state.id, conductor);

    if (response.next.type === "ask_question") {
      return formatResult({
        success: true,
        phase: "questioning",
        question: {
          text: response.next.question.text,
          number: 1,
          total: CORE_QUESTIONS.length,
          intent: response.next.question.intent,
        },
        instructions:
          "Ask this question naturally and conversationally. " +
          "Wait for the user's response, then call arete_onboard with mode: 'answer' and their response. " +
          "Don't explain that you're conducting an interview - just have a natural conversation.",
        nextAction: { mode: "answer", description: "Wait for user response, then call with mode='answer'" },
      });
    }

    return formatResult({
      success: false,
      phase: "error",
      error: "Unexpected state after start",
      instructions: "Something went wrong. Try starting again.",
      nextAction: { mode: "start", description: "Try starting again" },
    });
  }

  // Handle answer
  if (input.mode === "answer") {
    if (!input.answer) {
      return formatResult({
        success: false,
        phase: "error",
        error: "No answer provided",
        instructions: "Call with mode: 'answer' and include the user's response in 'answer' field.",
        nextAction: { mode: "answer", description: "Provide user's answer in 'answer' field" },
      });
    }

    // Get or restore conductor
    let conductor: InterviewConductor;
    const savedState = loadInterviewState();

    if (savedState) {
      // Check if we have an active conductor
      const existing = activeInterviews.get(savedState.id);
      if (existing) {
        conductor = existing;
      } else {
        // Restore from saved state
        conductor = new InterviewConductor(apiKey);
        conductor.restoreState(savedState);
        activeInterviews.set(savedState.id, conductor);
      }
    } else {
      return formatResult({
        success: false,
        phase: "error",
        error: "No active interview. Start one first.",
        instructions: "Call with mode: 'start' to begin a new interview.",
        nextAction: { mode: "start", description: "Begin a new interview" },
      });
    }

    // Process the answer - use fast path if extractedFacts provided
    const startTime = Date.now();
    let response;
    let extractionSource: "host" | "haiku";
    let extractionMs: number | undefined;

    if (input.extractedFacts && input.extractedFacts.length > 0) {
      // Fast path: use pre-extracted facts from host LLM
      const facts = input.extractedFacts.map(f => ({
        category: f.category,
        content: f.content,
        confidence: f.confidence ?? 0.8,
        visibility: f.visibility ?? "trusted" as const,
        evidence: "Extracted by host LLM",
      }));
      response = await conductor.answerWithFacts(input.answer, facts);
      extractionSource = "host";
      extractionMs = 0;
    } else {
      // Slow path: extract via Haiku (fallback for non-Claude hosts)
      const extractionStart = Date.now();
      response = await conductor.answer(input.answer);
      extractionMs = Date.now() - extractionStart;
      extractionSource = "haiku";
    }

    const totalMs = Date.now() - startTime;
    saveInterviewState(response.state);

    // Format recent facts for display
    const recentFacts = response.newFacts.slice(-5).map(f => f.content);

    // Build timing info
    const timing = { totalMs, extractionMs, source: extractionSource };

    if (response.next.type === "ask_question") {
      const questionNumber = response.state.coreExchanges.length + 1;
      const isCore = response.next.question.phase === "core";

      return formatResult({
        success: true,
        phase: "questioning",
        question: {
          text: response.next.question.text,
          number: isCore ? questionNumber : response.state.coreExchanges.length + response.state.branchExchanges.length + 1,
          total: isCore ? CORE_QUESTIONS.length : CORE_QUESTIONS.length + (response.state.suggestedBranches?.length ?? 0),
          intent: response.next.question.intent,
        },
        recentFacts,
        timing,
        instructions:
          "Ask this question naturally. " +
          "The 'recentFacts' shows what was learned from the last answer - " +
          "you can acknowledge these naturally if relevant. " +
          "Wait for response, then call with mode: 'answer' and include extractedFacts.",
        nextAction: { mode: "answer", description: "Wait for user response, then call with mode='answer'" },
      });
    }

    if (response.next.type === "offer_branching") {
      return formatResult({
        success: true,
        phase: "branching",
        branching: {
          summary: response.next.summary,
          suggestions: response.next.suggestions.map(s => ({
            id: s.id,
            text: s.text,
            explores: s.explores,
          })),
        },
        recentFacts,
        timing,
        instructions:
          "Present the summary of what you've learned, then offer to explore the suggested follow-up questions. " +
          "Make it feel natural: 'I've learned X about you. I'm curious about [suggestions]. Want to explore these, or is that enough for now?' " +
          "If they want to continue, call with mode: 'branch', branchDecision: 'continue'. " +
          "If they're done, call with mode: 'branch', branchDecision: 'done'.",
        nextAction: { mode: "branch", description: "Wait for user decision, then call with mode='branch' and branchDecision" },
      });
    }

    if (response.next.type === "complete") {
      return handleCompletion(response.next.output, response.state);
    }

    return formatResult({
      success: false,
      phase: "error",
      error: "Unexpected response type",
      instructions: "Something went wrong. Try starting a new interview.",
      nextAction: { mode: "start", description: "Start a new interview" },
    });
  }

  // Handle branching decision
  if (input.mode === "branch") {
    const savedState = loadInterviewState();
    if (!savedState) {
      return formatResult({
        success: false,
        phase: "error",
        error: "No active interview",
        instructions: "Call with mode: 'start' to begin.",
        nextAction: { mode: "start", description: "Begin a new interview" },
      });
    }

    const conductor = activeInterviews.get(savedState.id);
    if (!conductor) {
      // Restore conductor
      const newConductor = new InterviewConductor(apiKey);
      newConductor.restoreState(savedState);
      activeInterviews.set(savedState.id, newConductor);
    }

    const activeConductor = activeInterviews.get(savedState.id)!;
    const decision: BranchDecision = input.branchDecision === "continue"
      ? { type: "continue", selectedQuestions: input.selectedQuestions }
      : { type: "done" };

    const response = await activeConductor.decideBranching(decision);
    saveInterviewState(response.state);

    if (response.next.type === "ask_question") {
      return formatResult({
        success: true,
        phase: "questioning",
        question: {
          text: response.next.question.text,
          number: response.state.coreExchanges.length + response.state.branchExchanges.length + 1,
          total: CORE_QUESTIONS.length + (response.state.suggestedBranches?.length ?? 0),
          intent: response.next.question.intent,
        },
        instructions:
          "Ask this follow-up question naturally. " +
          "Reference what they said earlier if relevant. " +
          "Wait for response, then call with mode: 'answer'.",
        nextAction: { mode: "answer", description: "Wait for user response, then call with mode='answer'" },
      });
    }

    if (response.next.type === "complete") {
      return handleCompletion(response.next.output, response.state);
    }

    return formatResult({
      success: false,
      phase: "error",
      error: "Unexpected response after branch decision",
      instructions: "Something went wrong.",
      nextAction: { mode: "start", description: "Start a new interview" },
    });
  }

  return formatResult({
    success: false,
    phase: "error",
    error: `Unknown mode: ${input.mode}`,
    instructions: "Use mode: 'start', 'answer', 'branch', or 'status'.",
    nextAction: { mode: "start", description: "Start with mode='start'" },
  });
}

// ============================================================================
// HELPERS
// ============================================================================

async function handleCompletion(
  output: InterviewOutput,
  state: InterviewState
): Promise<OnboardToolResult> {
  // Convert to IdentityV2
  const deviceId = crypto.randomUUID();
  const identity = interviewOutputToIdentityV2(output, deviceId);

  // Save locally
  saveIdentity(identity);

  // Clear interview state
  clearInterviewState();

  // Try to sync to cloud
  const config = loadConfig();
  if (config?.apiKey && config?.supabaseUrl) {
    try {
      const client = createCLIClient({
        supabaseUrl: config.supabaseUrl,
        apiKey: config.apiKey,
      });
      await client.saveIdentity(identity as any);
    } catch (err) {
      console.error("Cloud sync failed:", err);
      // Continue anyway - local save succeeded
    }
  }

  // Generate summary
  const factCount = identity.facts.length;
  const summary = generateCompletionSummary(output);

  return formatResult({
    success: true,
    phase: "complete",
    completion: {
      factsExtracted: factCount,
      summary,
    },
    instructions:
      "Interview complete! Summarize what you learned about them in a friendly way. " +
      "Mention that their identity is now saved and will personalize future conversations. " +
      "Invite them to start chatting about anything - you now know who they are.",
    nextAction: { mode: "complete", description: "Interview done - no further action needed" },
  });
}

function generateCompletionSummary(output: InterviewOutput): string {
  const parts: string[] = [];

  if (output.identity.core.role) {
    parts.push(`Role: ${output.identity.core.role}`);
  }

  if (output.identity.expertise.technologies.length > 0) {
    const techs = output.identity.expertise.technologies.slice(0, 3);
    parts.push(`Expertise: ${techs.join(", ")}`);
  }

  if (output.identity.context.currentFocus.length > 0) {
    parts.push(`Focus: ${output.identity.context.currentFocus[0]}`);
  }

  if (output.identity.preferences.responseLength) {
    parts.push(`Prefers ${output.identity.preferences.responseLength} responses`);
  }

  return parts.join(" | ");
}

function formatResult(output: OnboardOutput): OnboardToolResult {
  // Build human-readable text
  let text: string;

  switch (output.phase) {
    case "questioning":
      text = output.question
        ? `Question ${output.question.number}/${output.question.total}: ${output.question.text}`
        : "Ready to continue interview.";
      if (output.recentFacts && output.recentFacts.length > 0) {
        text += `\n\nLearned: ${output.recentFacts.join(", ")}`;
      }
      break;

    case "branching":
      text = output.branching
        ? `${output.branching.summary}\n\nSuggested follow-ups:\n${output.branching.suggestions.map(s => `- ${s.text}`).join("\n")}`
        : "Ready for branching decision.";
      break;

    case "complete":
      text = output.completion
        ? `Interview complete! Extracted ${output.completion.factsExtracted} facts.\n${output.completion.summary}`
        : "Interview complete.";
      break;

    case "error":
      text = `Error: ${output.error}`;
      break;

    default:
      text = "Interview ready.";
  }

  return {
    content: [{ type: "text", text }],
    structuredContent: output,
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const onboardTool = {
  name: "arete_onboard",
  description: `Conduct onboarding interview to build user identity.

**Use when:** User wants to set up their Arete identity or you detect no identity exists.

**Modes:**
- start: Begin new interview (returns first question)
- answer: Process user's response (returns next question or branching offer)
- branch: Handle branching decision (continue exploring or complete)
- status: Check if identity exists or interview is in progress

**Flow:**
1. Call with mode: "start"
2. Ask the returned question naturally
3. When user responds, call with mode: "answer", answer: "their response"
4. Repeat until branching offer appears
5. Present summary and ask if they want to explore more
6. Call with mode: "branch", branchDecision: "continue" or "done"
7. If continuing, repeat answer flow for follow-up questions
8. On completion, identity is saved automatically

**Important:** Make the conversation feel natural, not like a form. Reference what they said, acknowledge insights.`,
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["start", "answer", "branch", "status"],
        description: "Interview action to take",
      },
      answer: {
        type: "string",
        description: "User's response to the last question (for mode: 'answer')",
      },
      branchDecision: {
        type: "string",
        enum: ["continue", "done"],
        description: "Whether to continue with follow-up questions or complete (for mode: 'branch')",
      },
      selectedQuestions: {
        type: "array",
        items: { type: "string" },
        description: "Specific follow-up question IDs to explore (optional, for mode: 'branch')",
      },
    },
    required: ["mode"],
  },
};
