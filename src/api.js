import { callClaude } from './providers/claude.js';
import { callOpenAI } from './providers/openai.js';

export async function callModel(model, systemPrompt, messages) {
  if (model === 'claude') {
    return callClaude(systemPrompt, messages);
  } else {
    return callOpenAI(systemPrompt, messages);
  }
}
