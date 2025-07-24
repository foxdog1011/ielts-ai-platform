import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function getAIResponse(essay: string, taskId: string) {
  const prompt = `請你作為IELTS writing task 2 評分官，根據以下作文提供band score、評語、修正建議與改寫版本。\n題目編號: ${taskId}\n\n${essay}`;

  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4",
  });

  return completion.choices[0].message.content ?? "";
}
