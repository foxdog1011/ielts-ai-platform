"use client";

export function SparkLine({
  values,
  width = 120,
  height = 36,
  color = "#3b82f6",
  minVal = 4,
  maxVal = 9,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  minVal?: number;
  maxVal?: number;
}) {
  if (values.length < 2) return null;

  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const range = maxVal - minVal || 1;

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * w;
    const y = pad + (1 - (v - minVal) / range) * h;
    return { x, y, v };
  });

  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Area fill path
  const area =
    `M ${pts[0].x.toFixed(1)} ${(height - pad).toFixed(1)} ` +
    pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
    ` L ${pts[pts.length - 1].x.toFixed(1)} ${(height - pad).toFixed(1)} Z`;

  const last = pts[pts.length - 1];
  const lastVal = values[values.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={`Score trend: ${values.join(", ")}`}
    >
      <path d={area} fill={color} fillOpacity="0.08" />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last.x.toFixed(1)}
        cy={last.y.toFixed(1)}
        r="3"
        fill={color}
      />
    </svg>
  );
}

/** Mini band indicator bar */
export function BandBar({
  value,
  max = 9,
  color = "#3b82f6",
  width = 80,
}: {
  value: number;
  max?: number;
  color?: string;
  width?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="relative h-1.5 rounded-full bg-zinc-200 overflow-hidden"
        style={{ width }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
