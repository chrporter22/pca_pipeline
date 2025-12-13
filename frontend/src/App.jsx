import React, { useEffect, useState, useMemo } from 'react';
import './index.css';

/* Viridis palette (matplotlib anchors) */
const viridis = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];

const lerp = (a, b, t) => a + (b - a) * t;

function viridisColor(t) {
  t = Math.max(0, Math.min(1, t));
  const n = viridis.length - 1;
  const i = Math.floor(t * n);
  const f = t * n - i;
  const [r1, g1, b1] = viridis[i];
  const [r2, g2, b2] = viridis[Math.min(i + 1, n)];
  return `rgb(${lerp(r1, r2, f)}, ${lerp(g1, g2, f)}, ${lerp(b1, b2, f)})`;
}

export default function App() {
  const [data, setData] = useState([]);
  const [compX, setCompX] = useState(1);
  const [compY, setCompY] = useState(2);

  useEffect(() => {
    fetch('/api/pca')
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  const width = 820;
  const height = 440;
  const margin = 64;
  const plotW = width - margin * 2;
  const plotH = height - margin * 2;
  const ticks = 5;

  const stats = useMemo(() => {
    const pts = data
      .map(d => ({
        x: d[`pca_${compX}`],
        y: d[`pca_${compY}`],
        timestamp: d.timestamp,
      }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

    if (!pts.length) return null;

    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const mags = pts.map(p => Math.hypot(p.x, p.y));

    return {
      pts,
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      minM: Math.min(...mags),
      maxM: Math.max(...mags),
      latestTs: Math.max(...pts.map(p => p.timestamp || 0)),
    };
  }, [data, compX, compY]);

  const range = (a, b) => (b - a === 0 ? 1 : b - a);
  const fmt = v => v.toFixed(2);

  return (
    <div
      className="min-h-screen p-8"
      style={{
        background:
          'radial-gradient(circle at top, #0b2d45 0%, #020617 65%)',
        color: '#cbd5e1',
        fontFamily:
          '"JetBrainsMono Nerd Font", "FiraCode Nerd Font", monospace',
      }}
    >
      <h1 className="text-3xl mb-6 text-cyan-300">
        PCA Market Structure (Redis → ML → Web)
      </h1>

      <div className="mb-4 flex gap-6">
        {['X', 'Y'].map((axis, i) => (
          <label key={axis}>
            {axis} Component:
            <input
              type="number"
              min="1"
              max="5"
              value={i === 0 ? compX : compY}
              onChange={e =>
                i === 0
                  ? setCompX(+e.target.value)
                  : setCompY(+e.target.value)
              }
              className="ml-2 p-1 bg-slate-800 text-cyan-300 rounded"
            />
          </label>
        ))}
      </div>

      <svg width={width} height={height} className="rounded bg-[#020617]">
        {/* Grid + ticks */}
        {stats &&
          [...Array(ticks)].map((_, i) => {
            const t = i / (ticks - 1);
            const x = margin + t * plotW;
            const y = margin + t * plotH;

            const xv = stats.minX + t * range(stats.minX, stats.maxX);
            const yv = stats.maxY - t * range(stats.minY, stats.maxY);

            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={margin}
                  x2={x}
                  y2={height - margin}
                  stroke="#94a3b8"
                  strokeOpacity="0.25"
                />
                <line
                  x1={margin}
                  y1={y}
                  x2={width - margin}
                  y2={y}
                  stroke="#94a3b8"
                  strokeOpacity="0.25"
                />
                <text
                  x={x}
                  y={height - margin + 18}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {fmt(xv)}
                </text>
                <text
                  x={margin - 10}
                  y={y + 4}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="end"
                >
                  {fmt(yv)}
                </text>
              </g>
            );
          })}

        {/* Axes */}
        <line x1={margin} y1={height - margin} x2={width - margin} y2={height - margin} stroke="#94a3b8" />
        <line x1={margin} y1={margin} x2={margin} y2={height - margin} stroke="#94a3b8" />

        {/* Axis labels */}
        <text x={width / 2} y={height - 12} fill="#94a3b8" textAnchor="middle">
          PC{compX}
        </text>
        <text
          x={18}
          y={height / 2}
          fill="#94a3b8"
          textAnchor="middle"
          transform={`rotate(-90 18 ${height / 2})`}
        >
          PC{compY}
        </text>

        {/* Points */}
        {stats &&
          stats.pts.map((p, i) => {
            const x =
              margin +
              ((p.x - stats.minX) / range(stats.minX, stats.maxX)) * plotW;
            const y =
              height -
              margin -
              ((p.y - stats.minY) / range(stats.minY, stats.maxY)) * plotH;

            const mag = Math.hypot(p.x, p.y);
            const t = (mag - stats.minM) / range(stats.minM, stats.maxM);

            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3"
                fill={viridisColor(t)}
              />
            );
          })}

        {/* Date stamp */}
        {stats?.latestTs && (
          <g>
            <rect
              x={width - 280}
              y={14}
              width="260"
              height="28"
              rx="6"
              ry="6"
              fill="#020617"
              stroke="#38bdf8"
              strokeOpacity="0.6"
            />
            <text
              x={width - 150}
              y={34}
              fill="#7dd3fc"
              textAnchor="middle"
              fontSize="12"
            >
              Latest: {new Date(stats.latestTs * 1000).toLocaleString()}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
