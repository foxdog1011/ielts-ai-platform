"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tasks, Task } from "@/lib/tasks";

export default function TaskPage({ params }: { params: { id: string } }) {
  const [essay, setEssay] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const router = useRouter();

  const task: Task | undefined = tasks.find((t: Task) => t.id === params.id);

  if (!task) return <div>Task not found.</div>;

  const handleSubmit = async () => {
    const res = await fetch("/api/submit", {
      method: "POST",
      body: JSON.stringify({ id: task.id, essay }),
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    console.log("GPT Feedback JSON:", data.feedback);
    setFeedback(data.feedback);
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">{task.title}</h1>
      <p className="mb-4">{task.description}</p>

      <textarea
        value={essay}
        onChange={(e) => setEssay(e.target.value)}
        className="w-full h-60 border p-2 mb-4"
        placeholder="Type your essay here..."
      />

      <button
        onClick={handleSubmit}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Submit Essay
      </button>

      {feedback && (
        <div className="mt-6 p-6 bg-gray-100 border rounded-lg">
          <h2 className="text-xl font-bold mb-4">AI Feedback</h2>

          {(() => {
            try {
              const parsed = JSON.parse(feedback);

              return (
                <div className="space-y-6 text-gray-800">
                  {parsed.task_response && (
                    <section>
                      <h3 className="font-semibold">Task Response</h3>
                      <p>{parsed.task_response}</p>
                    </section>
                  )}

                  {parsed.band_scores && (
                    <div>
                      <h3 className="font-semibold">Band Scores</h3>
                      <ul className="list-disc list-inside">
                        {(Object.entries(parsed.band_scores) as [string, string | number][]).map(
                          ([key, value]) => (
                            <li key={key}>
                              <span className="font-medium">{key}</span>: {value}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}


                  {Array.isArray(parsed.paragraph_comments) && parsed.paragraph_comments.length > 0 && (
                    <section>
                      <h3 className="font-semibold">Paragraph Comments</h3>
                      <ol className="list-decimal list-inside">
                        {parsed.paragraph_comments.map(
                          (c: { paragraph: number; comment: string }, i: number) => (
                            <li key={i}>
                              <strong>Paragraph {c.paragraph}:</strong> {c.comment}
                            </li>
                          )
                        )}
                      </ol>
                    </section>
                  )}

                  {Array.isArray(parsed.corrections) && parsed.corrections.length > 0 && (
                    <section>
                      <h3 className="font-semibold">Corrections</h3>
                      <ul className="space-y-2">
                        {parsed.corrections.map(
                          (item: { original: string; suggestion: string }, index: number) => (
                            <li key={index}>
                              <div>
                                <strong>Original:</strong> {item.original}
                              </div>
                              <div>
                                <strong>Suggestion:</strong> {item.suggestion}
                              </div>
                            </li>
                          )
                        )}
                      </ul>
                    </section>
                  )}

                  {parsed.improved_version && (
                    <section>
                      <h3 className="font-semibold">Improved Version</h3>
                      <pre className="bg-white p-3 border rounded whitespace-pre-wrap">
                        {parsed.improved_version}
                      </pre>
                    </section>
                  )}
                </div>
              );
            } catch (err) {
              return (
                <div className="text-red-600">
                  回傳內容無法解析為 JSON：
                  <pre className="mt-2 text-sm whitespace-pre-wrap">
                    {feedback}
                  </pre>
                </div>
              );
            }
          })()}
        </div>
      )}
    </div>
  );
}
