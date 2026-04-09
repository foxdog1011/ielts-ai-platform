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
  getPromptUsage,
  markPromptUsed,
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
  PromptUsage,
} from "./prompt-store";
export { getPromptText } from "./prompt-utils";
export {
  TOPIC_TAXONOMY,
  TOPIC_CATEGORIES,
  ALL_SUB_TOPICS,
  categoryForSubTopic,
} from "./topic-taxonomy";
export type { TopicCategory, SubTopic } from "./topic-taxonomy";
export { getRecommendedPrompts } from "./recommend";
