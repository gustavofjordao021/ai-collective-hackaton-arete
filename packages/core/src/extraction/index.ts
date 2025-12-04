export {
  buildExtractionPrompt,
  buildExtractionPromptV2,
  buildFactExtractionPrompt,
  IDENTITY_EXTRACTION_PROMPT,
  IDENTITY_EXTRACTION_PROMPT_V2,
  FACT_EXTRACTION_PROMPT
} from "./prompts.js";
export { extractIdentityFromText, mergeIdentity, type LLMProvider, type ExtractionResult } from "./extractor.js";
