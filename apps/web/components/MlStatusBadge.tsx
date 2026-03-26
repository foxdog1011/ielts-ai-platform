"use client";

import { useEffect, useState } from "react";

type MlStatus = {
  mlOnline: boolean;
  mode: "hybrid" | "llm-only";
  reason: string | null;
};

export function MlStatusBadge() {
  const [status, setStatus] = useState<MlStatus | null>(null);

  useEffect(() => {
    fetch("/api/ml-health")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus({ mlOnline: false, mode: "llm-only", reason: "unreachable" }));
  }, []);

  if (!status) return null;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]"
      style={
        status.mlOnline
          ? { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", color: "#15803d" }
          : { borderColor: "#e4e4e7", backgroundColor: "#f4f4f5", color: "#71717a" }
      }
      title={status.reason ?? (status.mlOnline ? "Local ML server online" : "Local ML server offline")}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: status.mlOnline ? "#16a34a" : "#a1a1aa" }}
      />
      {status.mlOnline ? "Hybrid ML" : "LLM-only"}
    </div>
  );
}
