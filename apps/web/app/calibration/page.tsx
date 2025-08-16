'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type QPair = [number, number]; // [overall_01(0..1), band(4..9)]

/**
 * 校準曲線頁：讀取 /public/calibration/quantile_map.json，
 * 畫出 overall_01 → band(4..9) 的映射折線。
 * - 兼容多種常見 JSON 形狀（array of pairs / {q:[], band:[]} / { [q]: band }）。
 * - 若檔案缺失或格式不符，會 fallback 成直線：band = 4 + 5 * x。
 */
export default function CalibrationPage() {
  const [pairs, setPairs] = useState<QPair[] | null>(null);
  const [err, setErr] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 讀 JSON
  useEffect(() => {
    (async () => {
      try {
        setErr('');
        const res = await fetch('/calibration/quantile_map.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const parsed = parseQuantileMap(data);
        setPairs(parsed);
      } catch (e: any) {
        // fallback：直線
        setErr(`讀取 quantile_map.json 失敗，使用 fallback：${e?.message || 'unknown error'}`);
        setPairs(fallbackPairs());
      }
    })();
  }, []);

  // 描繪
  useEffect(() => {
    if (!pairs || !canvasRef.current) return;
    drawChart(canvasRef.current, pairs);
  }, [pairs]);

  return (
    <main className="relative min-h-dvh bg-white text-zinc-900 font-brand">
      <header className="mx-auto max-w-5xl px-6 sm:px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[18px] font-medium tracking-tight">校準曲線</h1>
          <a
            href="/"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[12px] hover:bg-zinc-50"
          >
            回首頁
          </a>
        </div>
        <p className="mt-2 text-[13px] text-zinc-600">
          映射 <code className="px-1 rounded bg-zinc-100">overall_01</code>（0–1） →{" "}
          <code className="px-1 rounded bg-zinc-100">Band</code>（4.0–9.0）。這條曲線由「量化校準」計算而來。
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-6 sm:px-8 pb-12">
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur">
          {err && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              {err}
            </div>
          )}
          <canvas ref={canvasRef} width={860} height={420} className="w-full h-auto" />
          {!!pairs?.length && (
            <div className="mt-3 text-[12px] text-zinc-600">
              節點 {pairs.length} 個；最左端約 {fmtX(pairs[0][0])} → {fmtBand(pairs[0][1])}，最右端約{' '}
              {fmtX(pairs[pairs.length - 1][0])} → {fmtBand(pairs[pairs.length - 1][1])}
            </div>
          )}
          <details className="mt-4">
            <summary className="cursor-pointer list-none text-[12px] font-medium text-zinc-700">
              原始資料（前 20 筆）
            </summary>
            <pre className="mt-2 max-h-[240px] overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px] leading-relaxed">
              {JSON.stringify((pairs || []).slice(0, 20), null, 2)}
            </pre>
          </details>
        </div>
      </section>
    </main>
  );
}

/* ---------------- utils ---------------- */

function parseQuantileMap(data: any): QPair[] {
  // 1) array of pairs: [[q, band], ...]
  if (Array.isArray(data) && data.every((e) => Array.isArray(e) && e.length >= 2)) {
    const pairs = data.map((e) => [Number(e[0]), Number(e[1])] as QPair);
    return sanitizePairs(pairs);
  }

  // 2) { q: number[], band: number[] }
  if (
    data &&
    Array.isArray(data.q) &&
    Array.isArray(data.band) &&
    data.q.length === data.band.length &&
    data.q.length > 0
  ) {
    const pairs = data.q.map((q: any, i: number) => [Number(q), Number(data.band[i])] as QPair);
    return sanitizePairs(pairs);
  }

  // 3) map object: { "0.00": 4.0, "0.05": 4.2, ... }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const pairs = Object.keys(data)
      .map((k) => [Number(k), Number((data as any)[k])] as QPair)
      .sort((a, b) => a[0] - b[0]);
    if (pairs.length > 0) return sanitizePairs(pairs);
  }

  // 4) 無法識別 → fallback
  return fallbackPairs();
}

function sanitizePairs(pairs: QPair[]): QPair[] {
  const clamped = pairs
    .map(([x, y]) => [clamp(x, 0, 1), clamp(y, 4, 9)] as QPair)
    .sort((a, b) => a[0] - b[0]);
  // 去重 x
  const dedup: QPair[] = [];
  for (const p of clamped) {
    if (!dedup.length || Math.abs(p[0] - dedup[dedup.length - 1][0]) > 1e-6) dedup.push(p);
  }
  return dedup;
}

function fallbackPairs(): QPair[] {
  // 直線 4 + 5x
  const N = 21;
  const out: QPair[] = [];
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);
    out.push([x, 4 + 5 * x]);
  }
  return out;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmtX(n: number) {
  return (n ?? 0).toFixed(2);
}
function fmtBand(n: number) {
  return (n ?? 0).toFixed(1).replace(/\.0$/, '');
}

function drawChart(canvas: HTMLCanvasElement, pairs: QPair[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // base
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const pad = { l: 60, r: 16, t: 16, b: 42 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  // scales
  const x2px = (x: number) => pad.l + x * plotW;
  const y2px = (y: number) => pad.t + (1 - (y - 4) / 5) * plotH; // 4..9 → 0..1（上小下大）

  // axes
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 1;
  // x axis
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t + plotH);
  ctx.lineTo(pad.l + plotW, pad.t + plotH);
  ctx.stroke();
  // y axis
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, pad.t + plotH);
  ctx.stroke();

  ctx.fillStyle = '#52525b';
  ctx.font = '12px ui-sans-serif, system-ui, -apple-system';

  // ticks x: 0, .2, .4, .6, .8, 1.0
  for (let i = 0; i <= 5; i++) {
    const xv = i / 5;
    const xx = x2px(xv);
    ctx.strokeStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(xx, pad.t);
    ctx.lineTo(xx, pad.t + plotH);
    ctx.stroke();
    ctx.fillStyle = '#52525b';
    const label = xv.toFixed(1);
    ctx.fillText(label, xx - ctx.measureText(label).width / 2, pad.t + plotH + 16);
  }
  // ticks y: 4..9 step 1
  for (let b = 4; b <= 9; b++) {
    const yy = y2px(b);
    ctx.strokeStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(pad.l, yy);
    ctx.lineTo(pad.l + plotW, yy);
    ctx.stroke();
    ctx.fillStyle = '#52525b';
    const label = String(b);
    ctx.fillText(label, pad.l - 20, yy + 4);
  }

  // path
  ctx.strokeStyle = '#2563eb'; // 藍
  ctx.lineWidth = 2;
  ctx.beginPath();
  pairs.forEach(([x, y], i) => {
    const px = x2px(x);
    const py = y2px(y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // points
  ctx.fillStyle = '#1d4ed8';
  pairs.forEach(([x, y]) => {
    const px = x2px(x);
    const py = y2px(y);
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // labels
  ctx.fillStyle = '#3f3f46';
  ctx.font = '13px ui-sans-serif, system-ui, -apple-system';
  ctx.fillText('overall_01 (0–1)', pad.l + plotW / 2 - 40, H - 12);
  ctx.save();
  ctx.translate(18, pad.t + plotH / 2 + 30);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Band (4.0–9.0)', 0, 0);
  ctx.restore();
}
