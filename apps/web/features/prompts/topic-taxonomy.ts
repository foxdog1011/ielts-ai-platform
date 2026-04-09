// features/prompts/topic-taxonomy.ts
//
// Standardised topic taxonomy for IELTS prompt classification.
// Each top-level key is a broad category; the value array lists
// specific sub-topics within that category.

export const TOPIC_TAXONOMY = {
  education: ["school", "university", "online learning", "teachers"],
  technology: ["internet", "AI", "social media", "smartphones"],
  environment: ["climate change", "pollution", "wildlife", "recycling"],
  health: ["exercise", "diet", "mental health", "healthcare"],
  society: ["crime", "poverty", "equality", "urbanization"],
  culture: ["traditions", "arts", "language", "tourism"],
  work: ["career", "remote work", "unemployment", "skills"],
  media: ["news", "advertising", "entertainment", "censorship"],
  government: ["law", "policy", "democracy", "spending"],
} as const;

/** Top-level topic category. */
export type TopicCategory = keyof typeof TOPIC_TAXONOMY;

/** Any sub-topic string that appears in the taxonomy. */
export type SubTopic =
  (typeof TOPIC_TAXONOMY)[TopicCategory][number];

/** All valid top-level category names. */
export const TOPIC_CATEGORIES = Object.keys(
  TOPIC_TAXONOMY,
) as readonly TopicCategory[];

/** Flat list of every sub-topic across all categories. */
export const ALL_SUB_TOPICS: readonly SubTopic[] = Object.values(
  TOPIC_TAXONOMY,
).flat() as SubTopic[];

/**
 * Look up which top-level category a sub-topic belongs to.
 * Returns undefined when the sub-topic is not in the taxonomy.
 */
export function categoryForSubTopic(
  sub: string,
): TopicCategory | undefined {
  const lower = sub.toLowerCase();
  for (const [cat, subs] of Object.entries(TOPIC_TAXONOMY)) {
    if ((subs as readonly string[]).includes(lower)) {
      return cat as TopicCategory;
    }
  }
  return undefined;
}
