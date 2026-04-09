// features/prompts/prompt-store.ts — re-export from original location
export {
  savePromptsUniq,
  listPrompts,
  pickRandomPrompt,
  getPromptFlags,
  setPromptFlags,
  enrichWithFlags,
  hashPrompt,
  seedFromFiles,
  getPromptUsage,
  markPromptUsed,
} from "@/lib/promptStore";
export type {
  PromptType,
  WritingPart,
  SpeakingPart,
  PromptLevel,
  PromptItem,
  PromptDraft,
  PromptFlags,
  PromptItemWithFlags,
  PromptUsage,
} from "@/lib/promptStore";
