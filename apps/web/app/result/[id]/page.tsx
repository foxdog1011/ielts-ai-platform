"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ResultPage() {
  const { id } = useParams();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResult() {
      try {
        const res = await fetch(`/api/result?id=${id}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Fetch failed");
        }

        setFeedback(data.feedback);
      } catch (err: any) {
        setError(err.message || "Unexpected error");
      }
    }

    if (id) fetchResult();
  }, [id]);

  const renderFeedback = () => {
    if (!feedback) return null;

    try {
      const parsed = JSON.parse(feedback);

      return (
        <div className="space-y-6 text-gray-800">
          {parsed.task_response && (
            <div>
              <h2 className="text-lg font-semibold">Task Response</h2>
              <p>{parsed.task_response}</p>
            </div>
          )}
          {parsed.band_scores && (
            <div>
              <h2 className="text-lg font-semibold">Band Scores</h2>
              <ul className="list-disc list-inside">
                {Object.entries(parsed.band_scores as Record<string, string | number>).map(([key, value]) => (
                  <li key={key}>
                    <strong>{key}:</strong> {value}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parsed.paragraph_comments?.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold">Paragraph Comments</h2>
              <ul className="list-decimal list-inside">
                {parsed.paragraph_comments.map((c: any, i: number) => (
                  <li key={i}>
                    <strong>Paragraph {c.paragraph}:</strong> {c.comment}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parsed.corrections?.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold">Corrections</h2>
              <ul className="space-y-2">
                {parsed.corrections.map((item: any, i: number) => (
                  <li key={i}>
                    <div><strong>Original:</strong> {item.original}</div>
                    <div><strong>Suggestion:</strong> {item.suggestion}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parsed.improved_version && (
            <div>
              <h2 className="text-lg font-semibold">Improved Version</h2>
              <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap">{parsed.improved_version}</pre>
            </div>
          )}
        </div>
      );
    } catch (e) {
      return (
        <div className="text-red-600">
          無法解析 AI 回傳內容：
          <pre className="mt-2 text-sm whitespace-pre-wrap">{feedback}</pre>
        </div>
      );
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">AI Feedback Result</h1>
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        renderFeedback()
      )}
    </div>
  );
}
