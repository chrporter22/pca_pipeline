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

const cycle = (v, dir, max = 5) =>
  dir === 'next' ? (v === max ? 1 : v + 1) : (v === 1 ? max : v - 1);

export default function App() {
  const [data, setData] = useState([]);
  const [compX, setCompX] = useState(1);
  const [compY, setCompY] = useState(2);
  const [hover, setHover] = useState(null);

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
        ...d,
        x: d[`pca_${compX}`],
        y: d[`pca_${compY}`],
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
  const fmt = v => Number(v).toFixed(2);

  const tooltipPos = (x, y, w = 260, h = 112) => {
    const pad = 8;
    return {
      left: x + w + pad > width ? x - w - pad : x + pad,
      top: y - h - pad < 0 ? y + pad : y - h - pad,
    };
  };

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
      <h1 className="text-3xl mb-4 text-cyan-300">
        PCA Cohort Drift Detection Dashboard
      </h1>

      {/* Component selectors styled like timestamp */}
      <div className="flex gap-4 mb-4">
        {[
          ['X', compX, setCompX],
          ['Y', compY, setCompY],
        ].map(([axis, value, setter]) => (
          <div
            key={axis}
            className="flex items-center gap-2 px-4 py-2 rounded"
            style={{
              background: '#020617',
              border: '1px solid rgba(148,163,184,0.5)',
            }}
          >
            <span className="text-slate-300">PC{axis}</span>
            <button
              onClick={() => setter(v => cycle(v, 'prev'))}
              className="px-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              ◀
            </button>
            <span className="w-8 text-center text-cyan-300">{value}</span>
            <button
              onClick={() => setter(v => cycle(v, 'next'))}
              className="px-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              ▶
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
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
                    stroke="#cbd5e1"
                    strokeOpacity="0.25"
                  />
                  <line
                    x1={margin}
                    y1={y}
                    x2={width - margin}
                    y2={y}
                    stroke="#cbd5e1"
                    strokeOpacity="0.25"
                  />
                  <text
                    x={x}
                    y={height - margin + 18}
                    fill="#cbd5e1"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {fmt(xv)}
                  </text>
                  <text
                    x={margin - 10}
                    y={y + 4}
                    fill="#cbd5e1"
                    fontSize="10"
                    textAnchor="end"
                  >
                    {fmt(yv)}
                  </text>
                </g>
              );
            })}

          {/* Axes */}
          <line x1={margin} y1={height - margin} x2={width - margin} y2={height - margin} stroke="#cbd5e1" />
          <line x1={margin} y1={margin} x2={margin} y2={height - margin} stroke="#cbd5e1" />

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
                  r={p.zscore_volume > 3 ? 5 : 3}
                  fill={viridisColor(t)}
                  stroke={p.volume_flag ? '#f87171' : 'none'}
                  strokeWidth="1.5"
                  style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                  onMouseEnter={() => setHover({ x, y, p })}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}

          {/* Tooltip */}
          {hover && (() => {
            const { left, top } = tooltipPos(hover.x, hover.y);
            return (
              <g pointerEvents="none">
                <rect
                  x={left}
                  y={top}
                  width="260"
                  height="112"
                  rx="6"
                  fill="#020617"
                  stroke="#38bdf8"
                />
                <text x={left + 10} y={top + 20} fill="#7dd3fc" fontSize="11">
                  PC{compX}: {fmt(hover.p[`pca_${compX}`])}
                </text>
                <text x={left + 10} y={top + 34} fill="#7dd3fc" fontSize="11">
                  PC{compY}: {fmt(hover.p[`pca_${compY}`])}
                </text>
                <text x={left + 10} y={top + 52} fill="#cbd5e1" fontSize="11">
                  O:{hover.p.open} H:{hover.p.high}
                </text>
                <text x={left + 10} y={top + 66} fill="#cbd5e1" fontSize="11">
                  L:{hover.p.low} C:{hover.p.close}
                </text>
                <text
                  x={left + 10}
                  y={top + 84}
                  fill={hover.p.zscore_volume > 3 ? '#f87171' : '#94a3b8'}
                  fontSize="11"
                >
                  Vol: {hover.p.volume} | Z:{hover.p.zscore_volume.toFixed(2)}
                </text>
                <text x={left + 10} y={top + 100} fill="#94a3b8" fontSize="10">
                  {new Date(hover.p.timestamp * 1000).toLocaleString()}
                </text>
              </g>
            );
          })()}

          {/* Timestamp box */}
          {stats?.latestTs && (
            <g>
              <rect
                x={width - 280}
                y={14}
                width="260"
                height="28"
                rx="6"
                fill="#020617"
                stroke="#94a3b8"
              />
              <text
                x={width - 150}
                y={34}
                fill="#cbd5e1"
                textAnchor="middle"
                fontSize="12"
              >
                Latest: {new Date(stats.latestTs * 1000).toLocaleString()}
              </text>
            </g>
          )}
        </svg>

        {/* Summary */}
        <div
          className="w-[340px] p-4 rounded"
          style={{
            background: '#020617',
            border: '1px solid rgba(148,163,184,0.5)',
          }}
        >
          <h2 className="text-cyan-300 text-lg mb-2">Key Plotting Features</h2>
          <ul className="text-sm text-slate-300 space-y-2 leading-relaxed">
            <li><span className="text-cyan-400">PCA:</span> Market Regime Projection</li>
            <li><span className="text-cyan-400">Anomalies:</span> Volume Z-score Alerts</li>
            <li><span className="text-cyan-400">Encoding:</span> Color = Magnitude</li>
            <li><span className="text-cyan-400">Pipeline:</span> API → ML → Redis → React UI Dashboard</li>
            <li><span className="text-cyan-400">Interaction:</span> Tool Tip Hover Inspection</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
