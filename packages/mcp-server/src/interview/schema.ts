/**
 * Interview Schema and Types
 *
 * Defines the structure for the onboarding interview that extracts
 * user identity in 3-5 minutes through cascading questions.
 */

import type { FactCategory, Visibility } from "@arete/core";

// ============================================================================
// EXTRACTED FACT
// ============================================================================

/**
 * A fact extracted from an interview response
 */
export interface ExtractedFact {
  category: FactCategory;
  content: string;
  confidence: number;
  visibility: Visibility;
  /** What in the response led to this extraction */
  evidence: string;
}

// ============================================================================
// QUESTION TYPES
// ============================================================================

export type QuestionPhase = "core" | "branching";

/**
 * A question in the interview flow
 */
export interface InterviewQuestion {
  id: string;
  phase: QuestionPhase;
  /** The question text */
  text: string;
  /** What this question aims to extract */
  intent: string;
  /** Follow-up prompt if answer is too short */
  nudge?: string;
}

/**
 * A dynamically generated follow-up question
 */
export interface BranchQuestion extends InterviewQuestion {
  phase: "branching";
  /** Why this question was generated */
  rationale: string;
  /** What gap or thread this explores */
  explores: "gap" | "depth" | "clarification";
}

// ============================================================================
// INTERVIEW STATE
// ============================================================================

export type InterviewStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_branch_decision"
  | "branching"
  | "completed"
  | "abandoned";

/**
 * A single Q&A exchange
 */
export interface InterviewExchange {
  question: InterviewQuestion;
  answer: string;
  extractedFacts: ExtractedFact[];
  answeredAt: string;
  durationMs: number;
}

/**
 * Complete interview state
 */
export interface InterviewState {
  id: string;
  status: InterviewStatus;
  startedAt: string;
  completedAt?: string;

  /** Core question exchanges (Q1-Q4) */
  coreExchanges: InterviewExchange[];

  /** Optional branching exchanges */
  branchExchanges: InterviewExchange[];

  /** Suggested follow-up questions (shown at branch decision point) */
  suggestedBranches?: BranchQuestion[];

  /** All extracted facts across all exchanges */
  allFacts: ExtractedFact[];

  /** Summary of what was learned (for the pivot moment) */
  summary?: string;
}

// ============================================================================
// INTERVIEW OUTPUT (Final Result)
// ============================================================================

/**
 * The final output of a completed interview
 * Maps to IdentityV2 structure
 */
export interface InterviewOutput {
  identity: {
    core: {
      name?: string;
      role?: string;
      company?: string;
      location?: string;
    };
    expertise: {
      domains: string[];
      technologies: string[];
      level: "beginner" | "intermediate" | "expert";
    };
    preferences: {
      communicationStyle?: string;
      responseLength?: "concise" | "detailed" | "adaptive";
      formatting?: string[];
    };
    context: {
      currentFocus: string[];
      projects: string[];
      constraints: string[];
    };
  };
  rawExchanges: {
    question: string;
    answer: string;
    extractedFacts: string[];
  }[];
  metadata: {
    version: string;
    createdAt: string;
    interviewDurationMs: number;
    questionsAnswered: number;
    factsExtracted: number;
    branchingUsed: boolean;
  };
}

// ============================================================================
// CONDUCTOR TYPES
// ============================================================================

/**
 * What the conductor returns after processing an answer
 */
export interface ConductorResponse {
  /** Updated interview state */
  state: InterviewState;

  /** Next action to take */
  next:
    | { type: "ask_question"; question: InterviewQuestion }
    | { type: "offer_branching"; summary: string; suggestions: BranchQuestion[] }
    | { type: "complete"; output: InterviewOutput };

  /** Facts extracted from the last answer */
  newFacts: ExtractedFact[];
}

/**
 * Branch decision from user
 */
export type BranchDecision =
  | { type: "continue"; selectedQuestions?: string[] }
  | { type: "done" };

// ============================================================================
// CORE QUESTIONS
// ============================================================================

export const CORE_QUESTIONS: InterviewQuestion[] = [
  {
    id: "q1_role",
    phase: "core",
    text: "What do you do?",
    intent: "Extract role, domain, company, seniority",
    nudge: "Feel free to share as much context as you'd like — your role, what kind of work, where you work.",
  },
  {
    id: "q2_focus",
    phase: "core",
    text: "What are you working on right now?",
    intent: "Extract current focus, tech stack, constraints, project context",
    nudge: "What's the main thing you're building or tackling these days?",
  },
  {
    id: "q3_style",
    phase: "core",
    text: "How do you like to work with AI?",
    intent: "Extract communication preferences, feedback style, response format",
    nudge: "For example: do you prefer concise answers or detailed explanations? Code-first or discussion-first?",
  },
  {
    id: "q4_other",
    phase: "core",
    text: "Anything else I should know about you?",
    intent: "Catch-all for high-signal personal/professional context",
    nudge: "This could be hobbies, side projects, things that shape how you think — whatever feels relevant.",
  },
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create a new interview state
 */
export function createInterviewState(): InterviewState {
  return {
    id: crypto.randomUUID(),
    status: "not_started",
    startedAt: new Date().toISOString(),
    coreExchanges: [],
    branchExchanges: [],
    allFacts: [],
  };
}

/**
 * Get the next core question (if any remain)
 */
export function getNextCoreQuestion(state: InterviewState): InterviewQuestion | null {
  const answeredCount = state.coreExchanges.length;
  if (answeredCount >= CORE_QUESTIONS.length) {
    return null;
  }
  return CORE_QUESTIONS[answeredCount];
}

/**
 * Calculate total facts extracted
 */
export function getTotalFacts(state: InterviewState): number {
  return state.allFacts.length;
}

/**
 * Calculate interview duration in ms
 */
export function getInterviewDuration(state: InterviewState): number {
  const start = new Date(state.startedAt).getTime();
  const end = state.completedAt
    ? new Date(state.completedAt).getTime()
    : Date.now();
  return end - start;
}
