import React, { useEffect, useState, useMemo } from 'react';
import './index.css';

/* Viridis palette */
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

function symbolColor(symbol = '') {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return viridisColor(Math.abs(hash % 1000) / 1000);
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

    const symbolCounts = {};
    pts.forEach(p => {
      symbolCounts[p.symbol_str] =
        (symbolCounts[p.symbol_str] || 0) + 1;
    });

    const timestamps = pts.map(p => p.timestamp || 0);
    const latestTs = Math.max(...timestamps);
    const latestSymbol = pts.find(p => p.timestamp === latestTs)?.symbol_str;

    return {
      pts,
      symbolCounts,
      total: pts.length,
      latestTs,
      latestSymbol,
      minX: Math.min(...pts.map(p => p.x)),
      maxX: Math.max(...pts.map(p => p.x)),
      minY: Math.min(...pts.map(p => p.y)),
      maxY: Math.max(...pts.map(p => p.y)),
      minM: Math.min(...pts.map(p => Math.hypot(p.x, p.y))),
      maxM: Math.max(...pts.map(p => Math.hypot(p.x, p.y))),
    };
  }, [data, compX, compY]);

  const range = (a, b) => (b - a === 0 ? 1 : b - a);
  const fmt = v => Number(v).toFixed(2);

  const tooltipPos = (x, y, w = 260, h = 156) => {
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

      <div className="flex gap-6">
        {/* Plot */}
        <svg width={width} height={height} className="rounded bg-[#020617]">
          {/* Grid */}
          {stats &&
            [...Array(ticks)].map((_, i) => {
              const t = i / (ticks - 1);
              const x = margin + t * plotW;
              const y = margin + t * plotH;
              const xv = stats.minX + t * range(stats.minX, stats.maxX);
              const yv = stats.maxY - t * range(stats.minY, stats.maxY);

              return (
                <g key={i}>
                  <line x1={x} y1={margin} x2={x} y2={height - margin} stroke="#cbd5e1" strokeOpacity="0.25" />
                  <line x1={margin} y1={y} x2={width - margin} y2={y} stroke="#cbd5e1" strokeOpacity="0.25" />
                  <text x={x} y={height - margin + 18} fill="#cbd5e1" fontSize="10" textAnchor="middle">
                    {fmt(xv)}
                  </text>
                  <text x={margin - 10} y={y + 4} fill="#cbd5e1" fontSize="10" textAnchor="end">
                    {fmt(yv)}
                  </text>
                </g>
              );
            })}

          <line x1={margin} y1={height - margin} x2={width - margin} y2={height - margin} stroke="#cbd5e1" />
          <line x1={margin} y1={margin} x2={margin} y2={height - margin} stroke="#cbd5e1" />

          {stats &&
            stats.pts.map((p, i) => {
              const x = margin + ((p.x - stats.minX) / range(stats.minX, stats.maxX)) * plotW;
              const y = height - margin - ((p.y - stats.minY) / range(stats.minY, stats.maxY)) * plotH;
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
                  style={{ cursor: 'crosshair' }}
                  onMouseEnter={() => setHover({ x, y, p })}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}

          {/* Tooltip with gauge */}
          {hover && stats && (() => {
            const { left, top } = tooltipPos(hover.x, hover.y);
            const symbol = hover.p.symbol_str ?? 'UNKNOWN';
            const count = stats.symbolCounts[symbol] || 0;
            const pct = count / stats.total;
            const color = symbolColor(symbol);

            return (
              <g pointerEvents="none">
                <rect x={left} y={top} width="260" height="156" rx="6" fill="#020617" stroke={color} />

                <text x={left + 10} y={top + 16} fill={color} fontSize="12" fontWeight="bold">
                  {symbol}
                </text>

                {/* Tooltip Gauge */}
                <rect x={left + 10} y={top + 22} width="200" height="6" rx="3" fill="#0f172a" />
                <rect
                  x={left + 10}
                  y={top + 22}
                  width={200 * pct}
                  height="6"
                  rx="3"
                  fill={color}
                />
                <text x={left + 220} y={top + 28} fill="#94a3b8" fontSize="9">
                  {(pct * 100).toFixed(1)}%
                </text>

                <text x={left + 10} y={top + 44} fill="#7dd3fc" fontSize="11">
                  PC{compX}: {fmt(hover.p[`pca_${compX}`])}
                </text>
                <text x={left + 10} y={top + 58} fill="#7dd3fc" fontSize="11">
                  PC{compY}: {fmt(hover.p[`pca_${compY}`])}
                </text>
                <text x={left + 10} y={top + 76} fill="#cbd5e1" fontSize="11">
                  O:{hover.p.open} H:{hover.p.high}
                </text>
                <text x={left + 10} y={top + 90} fill="#cbd5e1" fontSize="11">
                  L:{hover.p.low} C:{hover.p.close}
                </text>
                <text x={left + 10} y={top + 110} fill="#94a3b8" fontSize="10">
                  {new Date(hover.p.timestamp * 1000).toLocaleString()}
                </text>
              </g>
            );
          })()}
        </svg>

        {/* Control Panel */}
        <div className="w-[300px] space-y-4">
          <div className="p-4 rounded bg-[#020617] border border-slate-600">
            <div className="text-sm text-slate-400">Latest</div>
            <div className="text-sm">
              {stats && new Date(stats.latestTs * 1000).toLocaleString()}
            </div>
            <div className="mt-2 text-sm text-slate-400">
              Samples: <span className="text-cyan-300">{stats?.total}</span>
            </div>
            <div className="text-sm text-slate-400">
              Recent Symbol:{' '}
              <span style={{ color: symbolColor(stats?.latestSymbol) }}>
                {stats?.latestSymbol}
              </span>
            </div>
          </div>

          {/* PCA controls (unchanged) */}
          <div className="p-4 rounded bg-[#020617] border border-slate-600 space-y-3">
            {[
              ['X', compX, setCompX],
              ['Y', compY, setCompY],
            ].map(([axis, value, setter]) => (
              <div key={axis} className="flex items-center justify-between">
                <span>PC{axis}</span>
                <div className="flex gap-1">
                  <button onClick={() => setter(v => cycle(v, 'prev'))} className="px-3 py-1 bg-slate-800 rounded">−</button>
                  <div className="px-3 py-1 bg-slate-900 rounded text-cyan-300">{value}</div>
                  <button onClick={() => setter(v => cycle(v, 'next'))} className="px-3 py-1 bg-slate-800 rounded">+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Symbol distribution gauge (panel) */}
          {stats && (
            <div className="p-4 rounded bg-[#020617] border border-slate-600">
              <div className="text-sm text-slate-400 mb-2">
                Symbol Distribution
              </div>
              <div className="flex h-3 rounded overflow-hidden min-h-[12px]">
                {Object.entries(stats.symbolCounts).map(([sym, count]) => (
                  <div
                    key={sym}
                    style={{
                      width: `${(count / stats.total) * 100}%`,
                      background: symbolColor(sym),
                    }}
                    title={`${sym}: ${((count / stats.total) * 100).toFixed(1)}%`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
