import { OpenAI } from "openai";

// 只在 server 端使用；請在 .env.local 設 OPENAI_API_KEY
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function getAIResponse(essay: string, taskId: string) {
  const systemPrompt = [
    "You are an IELTS Writing Task 2 examiner.",
    "Return JSON only with keys: band, paragraphFeedback, improvements, rewritten, tokensUsed.",
    'band: { overall, taskResponse, coherence, lexical, grammar } as numbers (0-9 by 0.5).',
    "paragraphFeedback: array of { index, comment }.",
    "improvements: string array.",
    "rewritten: improved essay text.",
    "tokensUsed: integer."
  ].join("\n");

  const userPrompt = `Task: ${taskId}\nEssay:\n${essay}`;

  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    // 要求模型產生有效 JSON
    response_format: { type: "json_object" },
    temperature: Number(process.env.TEMPERATURE ?? 0.2),
    max_tokens: Number(process.env.MAX_TOKENS ?? 1200)
  });

  const text = res.choices?.[0]?.message?.content || "{}";

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }

  // 容錯：不同提示下模型可能回傳不同 key，這裡做映射
  const band =
    data.band ||
    data.band_scores || null;

  return {
    band,
    paragraphFeedback:
      data.paragraphFeedback ||
      data.paragraph_comments ||
      [],
    improvements:
      data.improvements ||
      data.suggestions ||
      [],
    rewritten:
      data.rewritten ||
      data.rewrite ||
      "",
    tokensUsed:
      data.tokensUsed ||
      (res as any).usage?.total_tokens
  };
}
