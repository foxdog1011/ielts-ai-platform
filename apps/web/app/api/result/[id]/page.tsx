"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ResultPage() {
  const { id } = useParams();
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const fetchResult = async () => {
      const res = await fetch(`/api/result?id=${id}`);
      const data = await res.json();
      setFeedback(data.feedback || "無結果");
    };
    fetchResult();
  }, [id]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">AI 評分結果</h1>
      <pre className="bg-gray-100 p-4 whitespace-pre-wrap">{feedback}</pre>
    </div>
  );
}
