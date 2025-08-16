"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function normalize(raw: any): Array<{ x: number; y: number }> {
  if (Array.isArray(raw?.points)) {
    const pts = raw.points
      .map((p: any) => ({ x: Number(p.x), y: Number(p.y) }))
      .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a: any, b: any) => a.x - b.x);
    if (pts.length >= 2) return pts;
  }
  const ps = raw?.percentiles;
  const vs = raw?.values || raw?.overall01 || raw?.thresholds;
  const bmin = Number(raw?.band_min ?? 4.0);
  const bmax = Number(raw?.band_max ?? 9.0);
  if (Array.isArray(ps) && Array.isArray(vs) && ps.length === vs.length && ps.length >= 2) {
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < ps.length; i++) {
      const p = Number(ps[i]);
      const v = Number(vs[i]);
      if (!Number.isFinite(p) || !Number.isFinite(v)) continue;
      const y = bmin + (bmax - bmin) * p;
      pts.push({ x: Math.max(0, Math.min(1, v)), y });
    }
    pts.sort((a, b) => a.x - b.x);
    if (pts.length >= 2) return pts;
  }
  return [
    { x: 0, y: 4 },
    { x: 1, y: 9 },
  ];
}

export default function CalibrationChart({
  src = "/calibration/quantile_map.json",
  width = 560,
  height = 320,
  className,
}: {
  src?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(src, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        if (!alive) return;
        setData(j);
      })
      .catch((e) => alive && setErr(e?.message || String(e)));
    return () => {
      alive = false;
    };
  }, [src]);

  const pts = useMemo(() => normalize(data), [data]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, cv.width, cv.height);

    const padL = 44;
    const padR = 12;
    const padT = 12;
    const padB = 28;
    const X0 = padL;
    const Y0 = cv.height - padB;
    const W = cv.width - padL - padR;
    const H = cv.height - padT - padB;

    // y 網格 4..9
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let band = 4; band <= 9; band += 1) {
      const t = (band - 4) / 5;
      const y = Y0 - t * H;
      ctx.beginPath();
      ctx.moveTo(X0, y);
      ctx.lineTo(X0 + W, y);
      ctx.stroke();

      ctx.fillStyle = "#52525b";
      ctx.font = "11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(band), X0 - 6, y);
    }

    // x 軸 0..1
    for (let i = 0; i <= 10; i++) {
      const x = X0 + (i / 10) * W;
      ctx.beginPath();
      ctx.moveTo(x, Y0);
      ctx.lineTo(x, Y0 + 4);
      ctx.stroke();

      ctx.fillStyle = "#71717a";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText((i / 10).toFixed(1), x, Y0 + 6);
    }

    // 曲線
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, idx) => {
      const x = X0 + p.x * W;
      const y = Y0 - ((p.y - 4) / 5) * H;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = "#d4d4d8";
    ctx.strokeRect(X0, Y0 - H, W, H);
  }, [pts]);

  return (
    <div className={["rounded-xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur", className || ""].join(" ")}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-medium text-zinc-900">Quantile Calibration (overall_01 → IELTS band)</div>
          <div className="text-[12px] text-zinc-500">橫軸：overall_01（0..1）　縱軸：Band（4..9）</div>
        </div>
        <div className="text-[11px] text-zinc-400 truncate max-w-[40%]">{src}</div>
      </div>
      <div className="mt-3">
        <canvas ref={canvasRef} width={width} height={height} className="w-full h-auto" />
      </div>
      {err && <div className="mt-2 text-[12px] text-red-600">讀取錯誤：{err}</div>}
    </div>
  );
}
