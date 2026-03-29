"use client";

export type RadarDim = { label: string; shortLabel?: string; value: number };

export function RadarChart({
  dims,
  max = 9,
  size = 200,
  color = "#3b82f6",
}: {
  dims: RadarDim[];
  max?: number;
  size?: number;
  color?: string;
}) {
  const n = dims.length;
  if (n < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;
  const labelR = size * 0.47;
  const startAngle = -Math.PI / 2;

  function getAngle(i: number) {
    return startAngle + (2 * Math.PI * i) / n;
  }

  function getPoint(i: number, radius: number) {
    const a = getAngle(i);
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  }

  function polygonPath(radius: number) {
    return (
      dims
        .map((_, i) => {
          const p = getPoint(i, radius);
          return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        })
        .join(" ") + " Z"
    );
  }

  const scorePath =
    dims
      .map((d, i) => {
        const frac = Math.min(1, Math.max(0, d.value / max));
        const p = getPoint(i, frac * r);
        return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="overflow-visible"
      aria-label="Score radar chart"
    >
      {/* Background fill */}
      <path d={polygonPath(r)} fill="#f4f4f5" fillOpacity="0.8" stroke="none" />

      {/* Grid rings */}
      {[0.33, 0.66, 1.0].map((f) => (
        <path
          key={f}
          d={polygonPath(f * r)}
          fill="none"
          stroke={f === 1.0 ? "#d4d4d8" : "#e4e4e7"}
          strokeWidth={f === 1.0 ? "1" : "0.75"}
        />
      ))}

      {/* Axis spokes */}
      {dims.map((_, i) => {
        const p = getPoint(i, r);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x.toFixed(1)}
            y2={p.y.toFixed(1)}
            stroke="#d4d4d8"
            strokeWidth="0.75"
          />
        );
      })}

      {/* Score fill */}
      <path
        d={scorePath}
        fill={color}
        fillOpacity="0.25"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Score dots */}
      {dims.map((d, i) => {
        const frac = Math.min(1, Math.max(0, d.value / max));
        const p = getPoint(i, frac * r);
        return (
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3.5"
            fill="white" stroke={color} strokeWidth="2" />
        );
      })}

      {/* Labels */}
      {dims.map((d, i) => {
        const p = getPoint(i, labelR);
        const anchor =
          p.x < cx - 8 ? "end" : p.x > cx + 8 ? "start" : "middle";
        const lbl = d.shortLabel ?? d.label;
        const val = d.value.toFixed(1).replace(/\.0$/, "");
        return (
          <g key={i}>
            <text
              x={p.x.toFixed(1)}
              y={(p.y - 5).toFixed(1)}
              textAnchor={anchor}
              dominantBaseline="auto"
              fontSize="11"
              fill="#52525b"
              fontFamily="system-ui, sans-serif"
            >
              {lbl}
            </text>
            <text
              x={p.x.toFixed(1)}
              y={(p.y + 7).toFixed(1)}
              textAnchor={anchor}
              dominantBaseline="hanging"
              fontSize="11.5"
              fontWeight="700"
              fill="#18181b"
              fontFamily="system-ui, sans-serif"
            >
              {val}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
