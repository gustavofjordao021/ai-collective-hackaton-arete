/**
 * Interview Conductor
 *
 * Orchestrates the onboarding interview flow:
 * 1. Asks 4 core questions
 * 2. Extracts facts from each answer
 * 3. Offers intelligent branching after core questions
 * 4. Allows user to continue or complete
 * 5. Produces final InterviewOutput
 */

import type { IdentityV2, IdentityFact, FactCategory } from "@arete/core";
import { createEmptyIdentityV2, createIdentityFact } from "@arete/core";
import { similarity } from "../tools/fuzzy-match.js";
import {
  type InterviewState,
  type InterviewQuestion,
  type InterviewExchange,
  type InterviewOutput,
  type ConductorResponse,
  type BranchDecision,
  type BranchQuestion,
  type ExtractedFact,
  createInterviewState,
  getNextCoreQuestion,
  getTotalFacts,
  getInterviewDuration,
  CORE_QUESTIONS,
} from "./schema.js";
import {
  extractFacts,
  generateBranchQuestions,
  generateFactsSummary,
} from "./extractor.js";

// ============================================================================
// CONDUCTOR CLASS
// ============================================================================

export class InterviewConductor {
  private state: InterviewState;
  private apiKey: string;
  private maxBranchQuestions: number;

  constructor(apiKey: string, maxBranchQuestions: number = 3) {
    this.state = createInterviewState();
    this.apiKey = apiKey;
    this.maxBranchQuestions = maxBranchQuestions;
  }

  /**
   * Start the interview - returns first question
   */
  start(): ConductorResponse {
    this.state.status = "in_progress";
    const firstQuestion = CORE_QUESTIONS[0];

    return {
      state: this.state,
      next: { type: "ask_question", question: firstQuestion },
      newFacts: [],
    };
  }

  /**
   * Process an answer to the current question
   */
  async answer(answer: string): Promise<ConductorResponse> {
    const startTime = Date.now();

    // Determine which question was just answered
    const currentQuestion = this.getCurrentQuestion();
    if (!currentQuestion) {
      throw new Error("No question pending");
    }

    // Extract facts from the answer
    const extraction = await extractFacts(
      currentQuestion,
      answer,
      this.state.allFacts,
      this.apiKey
    );

    // Create the exchange record
    const exchange: InterviewExchange = {
      question: currentQuestion,
      answer,
      extractedFacts: extraction.facts,
      answeredAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };

    // Add to appropriate exchange list
    if (currentQuestion.phase === "core") {
      this.state.coreExchanges.push(exchange);
    } else {
      this.state.branchExchanges.push(exchange);
    }

    // Accumulate facts
    this.state.allFacts.push(...extraction.facts);

    // Determine next step
    return this.determineNextStep();
  }

  /**
   * Process an answer with pre-extracted facts (fast path - no extraction LLM call)
   * Note: Still async because branching generation at end requires LLM
   */
  async answerWithFacts(answer: string, facts: ExtractedFact[]): Promise<ConductorResponse> {
    const startTime = Date.now();

    const currentQuestion = this.getCurrentQuestion();
    if (!currentQuestion) {
      throw new Error("No question pending");
    }

    // Create the exchange record with provided facts
    const exchange: InterviewExchange = {
      question: currentQuestion,
      answer,
      extractedFacts: facts,
      answeredAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };

    // Add to appropriate exchange list
    if (currentQuestion.phase === "core") {
      this.state.coreExchanges.push(exchange);
    } else {
      this.state.branchExchanges.push(exchange);
    }

    // Accumulate facts
    this.state.allFacts.push(...facts);

    // Determine next step (uses existing async method)
    return this.determineNextStep();
  }

  /**
   * Handle user's decision about branching
   */
  async decideBranching(decision: BranchDecision): Promise<ConductorResponse> {
    if (decision.type === "done") {
      // User chose to complete
      return this.complete();
    }

    // User wants to continue - pick questions
    this.state.status = "branching";

    // If specific questions selected, use those; otherwise use all suggestions
    let questionsToAsk = this.state.suggestedBranches ?? [];
    if (decision.selectedQuestions && decision.selectedQuestions.length > 0) {
      questionsToAsk = questionsToAsk.filter(q =>
        decision.selectedQuestions!.includes(q.id)
      );
    }

    // Limit to max branch questions
    questionsToAsk = questionsToAsk.slice(0, this.maxBranchQuestions);

    if (questionsToAsk.length === 0) {
      return this.complete();
    }

    // Store remaining questions for later
    this.state.suggestedBranches = questionsToAsk;

    // Return first branch question
    return {
      state: this.state,
      next: { type: "ask_question", question: questionsToAsk[0] },
      newFacts: [],
    };
  }

  /**
   * Get current interview state
   */
  getState(): InterviewState {
    return this.state;
  }

  /**
   * Restore from a previous state (for resuming)
   */
  restoreState(state: InterviewState): void {
    this.state = state;
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private getCurrentQuestion(): InterviewQuestion | null {
    if (this.state.status === "in_progress") {
      return getNextCoreQuestion(this.state);
    }

    if (this.state.status === "branching") {
      // Find next unanswered branch question
      const answered = new Set(this.state.branchExchanges.map(e => e.question.id));
      const remaining = this.state.suggestedBranches?.filter(q => !answered.has(q.id));
      return remaining?.[0] ?? null;
    }

    return null;
  }

  private async determineNextStep(): Promise<ConductorResponse> {
    const newFacts = this.state.allFacts.slice(-10); // Last 10 for display

    // Check if more core questions remain
    const nextCore = getNextCoreQuestion(this.state);
    if (nextCore) {
      return {
        state: this.state,
        next: { type: "ask_question", question: nextCore },
        newFacts,
      };
    }

    // All core questions done - check if in branching mode
    if (this.state.status === "branching") {
      // Check for more branch questions
      const answered = new Set(this.state.branchExchanges.map(e => e.question.id));
      const remaining = this.state.suggestedBranches?.filter(q => !answered.has(q.id));

      if (remaining && remaining.length > 0) {
        return {
          state: this.state,
          next: { type: "ask_question", question: remaining[0] },
          newFacts,
        };
      }

      // All branch questions done
      return this.complete();
    }

    // Core complete, offer branching
    return this.offerBranching();
  }

  private async offerBranching(): Promise<ConductorResponse> {
    this.state.status = "awaiting_branch_decision";

    // Generate intelligent follow-up suggestions
    const branching = await generateBranchQuestions(this.state, this.apiKey);

    this.state.suggestedBranches = branching.questions;
    this.state.summary = branching.summary || generateFactsSummary(this.state.allFacts);

    return {
      state: this.state,
      next: {
        type: "offer_branching",
        summary: this.state.summary,
        suggestions: branching.questions,
      },
      newFacts: this.state.allFacts.slice(-5),
    };
  }

  private complete(): ConductorResponse {
    this.state.status = "completed";
    this.state.completedAt = new Date().toISOString();

    const output = this.buildOutput();

    return {
      state: this.state,
      next: { type: "complete", output },
      newFacts: [],
    };
  }

  private buildOutput(): InterviewOutput {
    const facts = this.state.allFacts;

    // Extract structured data from facts
    const core = {
      name: this.extractSingleFact(facts, "core", ["name"]),
      role: this.extractSingleFact(facts, "core", ["role", "title", "position"]),
      company: this.extractSingleFact(facts, "context", ["company", "work at", "employed"]),
      location: this.extractSingleFact(facts, "context", ["location", "based in", "live in"]),
    };

    const expertise = {
      domains: this.extractMultipleFacts(facts, "expertise", ["domain", "field", "industry"]),
      technologies: this.extractMultipleFacts(facts, "expertise", []),
      level: this.inferExpertiseLevel(facts),
    };

    const preferences = {
      communicationStyle: this.extractSingleFact(facts, "preference", ["style", "communication"]),
      responseLength: this.inferResponseLength(facts),
      formatting: this.extractMultipleFacts(facts, "preference", ["format", "formatting"]),
    };

    const context = {
      currentFocus: this.extractMultipleFacts(facts, "focus", []),
      projects: this.extractMultipleFacts(facts, "focus", ["project", "building", "working on"]),
      constraints: this.extractMultipleFacts(facts, "context", ["constraint", "challenge", "limitation"]),
    };

    const rawExchanges = [...this.state.coreExchanges, ...this.state.branchExchanges].map(e => ({
      question: e.question.text,
      answer: e.answer,
      extractedFacts: e.extractedFacts.map(f => f.content),
    }));

    return {
      identity: { core, expertise, preferences, context },
      rawExchanges,
      metadata: {
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        interviewDurationMs: getInterviewDuration(this.state),
        questionsAnswered: rawExchanges.length,
        factsExtracted: getTotalFacts(this.state),
        branchingUsed: this.state.branchExchanges.length > 0,
      },
    };
  }

  private extractSingleFact(
    facts: ExtractedFact[],
    category: FactCategory,
    keywords: string[]
  ): string | undefined {
    const categoryFacts = facts.filter(f => f.category === category);

    if (keywords.length === 0) {
      return categoryFacts[0]?.content;
    }

    for (const keyword of keywords) {
      const match = categoryFacts.find(f =>
        f.content.toLowerCase().includes(keyword.toLowerCase())
      );
      if (match) return match.content;
    }

    return categoryFacts[0]?.content;
  }

  private extractMultipleFacts(
    facts: ExtractedFact[],
    category: FactCategory,
    keywords: string[]
  ): string[] {
    let categoryFacts = facts.filter(f => f.category === category);

    if (keywords.length > 0) {
      const keywordFacts = categoryFacts.filter(f =>
        keywords.some(k => f.content.toLowerCase().includes(k.toLowerCase()))
      );
      if (keywordFacts.length > 0) {
        categoryFacts = keywordFacts;
      }
    }

    return categoryFacts.map(f => f.content);
  }

  private inferExpertiseLevel(facts: ExtractedFact[]): "beginner" | "intermediate" | "expert" {
    const expertise = facts.filter(f => f.category === "expertise");
    const avgConfidence = expertise.reduce((sum, f) => sum + f.confidence, 0) / (expertise.length || 1);

    // Also check for seniority indicators in core/context
    const seniorIndicators = ["senior", "lead", "principal", "staff", "director", "head", "architect"];
    const hasSeniorIndicator = facts.some(f =>
      seniorIndicators.some(i => f.content.toLowerCase().includes(i))
    );

    if (hasSeniorIndicator || avgConfidence > 0.8) return "expert";
    if (avgConfidence > 0.5) return "intermediate";
    return "beginner";
  }

  private inferResponseLength(facts: ExtractedFact[]): "concise" | "detailed" | "adaptive" {
    const prefs = facts.filter(f => f.category === "preference");
    const prefText = prefs.map(f => f.content.toLowerCase()).join(" ");

    if (prefText.includes("concise") || prefText.includes("brief") || prefText.includes("short")) {
      return "concise";
    }
    if (prefText.includes("detailed") || prefText.includes("thorough") || prefText.includes("comprehensive")) {
      return "detailed";
    }
    return "adaptive";
  }
}

// ============================================================================
// CONVERT TO IDENTITY V2
// ============================================================================

/**
 * Convert InterviewOutput to IdentityV2 format for storage
 */
export function interviewOutputToIdentityV2(
  output: InterviewOutput,
  deviceId: string
): IdentityV2 {
  const identity = createEmptyIdentityV2(deviceId);

  // Set core fields
  identity.core = {
    name: output.identity.core.name,
    role: output.identity.core.role,
  };

  // Convert expertise to facts
  for (const tech of output.identity.expertise.technologies) {
    identity.facts.push(createIdentityFact({
      category: "expertise",
      content: tech,
      source: "manual", // Interview = user-provided = manual
      confidence: 0.9,
      visibility: "public",
    }));
  }

  for (const domain of output.identity.expertise.domains) {
    identity.facts.push(createIdentityFact({
      category: "expertise",
      content: domain,
      source: "manual",
      confidence: 0.9,
      visibility: "public",
    }));
  }

  // Convert preferences to facts
  if (output.identity.preferences.communicationStyle) {
    identity.facts.push(createIdentityFact({
      category: "preference",
      content: output.identity.preferences.communicationStyle,
      source: "manual",
      confidence: 1.0,
      visibility: "public",
    }));
  }

  if (output.identity.preferences.responseLength) {
    identity.facts.push(createIdentityFact({
      category: "preference",
      content: `Prefers ${output.identity.preferences.responseLength} responses`,
      source: "manual",
      confidence: 1.0,
      visibility: "public",
    }));
  }

  for (const fmt of output.identity.preferences.formatting ?? []) {
    identity.facts.push(createIdentityFact({
      category: "preference",
      content: fmt,
      source: "manual",
      confidence: 0.9,
      visibility: "public",
    }));
  }

  // Convert context to facts
  for (const focus of output.identity.context.currentFocus) {
    identity.facts.push(createIdentityFact({
      category: "focus",
      content: focus,
      source: "manual",
      confidence: 0.9,
      visibility: "trusted",
    }));
  }

  for (const project of output.identity.context.projects) {
    identity.facts.push(createIdentityFact({
      category: "focus",
      content: project,
      source: "manual",
      confidence: 0.9,
      visibility: "trusted",
    }));
  }

  for (const constraint of output.identity.context.constraints) {
    identity.facts.push(createIdentityFact({
      category: "context",
      content: constraint,
      source: "manual",
      confidence: 0.8,
      visibility: "trusted",
    }));
  }

  // Add company/location as context facts
  // Strip any existing prefixes before adding canonical one
  const KNOWN_PREFIXES = ["works at", "based in", "located in", "lives in"];

  function stripPrefixes(value: string): string {
    let result = value.trim();
    let changed = true;
    // Keep stripping until no more prefixes found (handles nested prefixes)
    while (changed) {
      changed = false;
      for (const prefix of KNOWN_PREFIXES) {
        if (result.toLowerCase().startsWith(prefix + " ")) {
          result = result.slice(prefix.length + 1).trim();
          changed = true;
        }
      }
    }
    return result;
  }

  if (output.identity.core.company) {
    const cleanCompany = stripPrefixes(output.identity.core.company);
    identity.facts.push(createIdentityFact({
      category: "context",
      content: `Works at ${cleanCompany}`,
      source: "manual",
      confidence: 1.0,
      visibility: "trusted",
    }));
  }

  if (output.identity.core.location) {
    const cleanLocation = stripPrefixes(output.identity.core.location);
    identity.facts.push(createIdentityFact({
      category: "context",
      content: `Based in ${cleanLocation}`,
      source: "manual",
      confidence: 1.0,
      visibility: "trusted",
    }));
  }

  // Deduplicate facts by semantic similarity (0.85 threshold)
  // Same-category only to avoid false positives across categories
  const kept: typeof identity.facts = [];
  for (const fact of identity.facts) {
    const isDuplicate = kept.some(existing =>
      existing.category === fact.category &&
      similarity(existing.content, fact.content) > 0.85
    );
    if (!isDuplicate) {
      kept.push(fact);
    }
  }
  identity.facts = kept;

  return identity;
}

// ============================================================================
// HOSTED INTERVIEW API
// ============================================================================

/**
 * Configuration for the hosted interview endpoint
 */
export interface HostedInterviewConfig {
  supabaseUrl: string;
  apiKey?: string; // Optional - uses hosted Anthropic key if not provided
}

/**
 * Run interview via hosted Supabase Edge Function
 * This allows onboarding without requiring user's API key
 */
export async function runHostedInterview(
  config: HostedInterviewConfig
): Promise<{
  conductor: InterviewConductor;
  start: () => ConductorResponse;
}> {
  // For now, we require an API key
  // TODO: Implement hosted endpoint that proxies to Anthropic
  const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "No API key available. Set ANTHROPIC_API_KEY or provide apiKey in config."
    );
  }

  const conductor = new InterviewConductor(apiKey);

  return {
    conductor,
    start: () => conductor.start(),
  };
}
