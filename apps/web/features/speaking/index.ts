// features/speaking/index.ts — public API for the speaking feature
export { runSpeakingPipeline } from "./pipeline";
export type { SpeakingPipelineInput } from "./pipeline";
export { fuseSpeakingScores } from "./fusion";
export { scoreSpeakingWithLlm } from "./llm-rubric";
export { transcribeAudio } from "./asr";
export type { AsrSegment, AsrResult } from "./asr";
