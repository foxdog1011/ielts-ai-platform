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
  const r = size * 0.34;
  const labelR = size * 0.46;
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
      {/* Grid rings at 33%, 66%, 100% */}
      {[0.33, 0.66, 1.0].map((f) => (
        <path
          key={f}
          d={polygonPath(f * r)}
          fill="none"
          stroke="#e4e4e7"
          strokeWidth={f === 1.0 ? "1.2" : "0.8"}
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
            stroke="#e4e4e7"
            strokeWidth="0.8"
          />
        );
      })}

      {/* Score fill */}
      <path
        d={scorePath}
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Score dots */}
      {dims.map((d, i) => {
        const frac = Math.min(1, Math.max(0, d.value / max));
        const p = getPoint(i, frac * r);
        return (
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3.5" fill={color} />
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
              y={(p.y - 6).toFixed(1)}
              textAnchor={anchor}
              dominantBaseline="auto"
              fontSize="9.5"
              fill="#71717a"
              fontFamily="system-ui, sans-serif"
            >
              {lbl}
            </text>
            <text
              x={p.x.toFixed(1)}
              y={(p.y + 6).toFixed(1)}
              textAnchor={anchor}
              dominantBaseline="hanging"
              fontSize="10"
              fontWeight="600"
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
