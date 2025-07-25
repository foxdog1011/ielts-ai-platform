import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function getAIResponse(essay: string, taskId: string) {
  const systemPrompt = `
你是 IELTS Writing Task 2 的考官，請你針對考生的作文進行評分與建議，並「僅回傳以下格式的 JSON」：

{
  "band_scores": {
    "Task Response": number,
    "Coherence and Cohesion": number,
    "Lexical Resource": number,
    "Grammatical Range and Accuracy": number
  },
  "task_response": string,
  "paragraph_comments": [
    { "paragraph": 1, "comment": "..." }
  ],
  "corrections": [
    { "original": "...", "suggestion": "..." }
  ],
  "improved_version": "..."
}

⚠️ 鍵名與格式請完全遵守。不要有多餘文字、解釋或 Markdown，只輸出純 JSON。
`;

  const prompt = `題目編號: ${taskId}\n\n以下是考生的作文：\n${essay}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
    });

    const content = response.choices[0].message.content ?? "";

    console.log("🔁 GPT raw response:", content); // ✅ DEBUG 用

    return content;
  } catch (error: any) {
    console.error("❌ GPT error:", error.message || error);
    return "無法取得 AI 回饋，請稍後再試。";
  }
}
