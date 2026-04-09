// features/prompts/index.ts — public API for prompt management
export {
  savePromptsUniq,
  listPrompts,
  pickRandomPrompt,
  getPromptFlags,
  setPromptFlags,
  enrichWithFlags,
  hashPrompt,
  seedFromFiles,
} from "./prompt-store";
export type {
  PromptType,
  WritingPart,
  SpeakingPart,
  PromptLevel,
  PromptItem,
  PromptDraft,
  PromptFlags,
  PromptItemWithFlags,
} from "./prompt-store";
export { getPromptText } from "./prompt-utils";
