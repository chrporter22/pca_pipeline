import React, { useEffect, useState, useMemo } from 'react';
import './index.css';

/**
 * Viridis color scale (anchor points)
 * Source: matplotlib
 */
const viridis = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function viridisColor(t) {
  t = Math.max(0, Math.min(1, t));
  const n = viridis.length - 1;
  const i = Math.floor(t * n);
  const f = t * n - i;
  const [r1, g1, b1] = viridis[i];
  const [r2, g2, b2] = viridis[Math.min(i + 1, n)];
  return `rgb(${lerp(r1, r2, f)}, ${lerp(g1, g2, f)}, ${lerp(b1, b2, f)})`;
}

function App() {
  const [data, setData] = useState([]);
  const [compX, setCompX] = useState(1);
  const [compY, setCompY] = useState(2);

  useEffect(() => {
    fetch('/api/pca')
      .then(res => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then(setData)
      .catch(console.error);
  }, []);

  const width = 800;
  const height = 400;
  const margin = 50;
  const plotW = width - margin * 2;
  const plotH = height - margin * 2;
  const gridLines = 6;

  const stats = useMemo(() => {
    const pts = data
      .map(d => ({
        x: d[`pca_${compX}`],
        y: d[`pca_${compY}`],
      }))
      .filter(p => p.x != null && p.y != null);

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
    };
  }, [data, compX, compY]);

  const range = (min, max) => (max - min === 0 ? 1 : max - min);

  return (
    <div className="bg-black text-green-400 font-mono min-h-screen p-8">
      <h1 className="text-3xl mb-4">PCA Component Viewer</h1>

      <div className="mb-4 flex gap-4">
        <label>
          X Component:
          <input
            type="number"
            min="1"
            max="5"
            value={compX}
            onChange={e => setCompX(+e.target.value)}
            className="ml-2 p-1 bg-gray-800 text-green-300"
          />
        </label>

        <label>
          Y Component:
          <input
            type="number"
            min="1"
            max="5"
            value={compY}
            onChange={e => setCompY(+e.target.value)}
            className="ml-2 p-1 bg-gray-800 text-green-300"
          />
        </label>
      </div>

      <svg width={width} height={height} className="bg-gray-900 rounded">
        {/* Grid */}
        {[...Array(gridLines)].map((_, i) => {
          const x = margin + (i / (gridLines - 1)) * plotW;
          const y = margin + (i / (gridLines - 1)) * plotH;
          return (
            <g key={i}>
              <line x1={x} y1={margin} x2={x} y2={height - margin} stroke="#222" />
              <line x1={margin} y1={y} x2={width - margin} y2={y} stroke="#222" />
            </g>
          );
        })}

        {/* Axes */}
        <line
          x1={margin}
          y1={height - margin}
          x2={width - margin}
          y2={height - margin}
          stroke="#888"
        />
        <line
          x1={margin}
          y1={margin}
          x2={margin}
          y2={height - margin}
          stroke="#888"
        />

        {/* Axis titles */}
        <text
          x={width / 2}
          y={height - 10}
          fill="#aaa"
          textAnchor="middle"
        >
          PC{compX}
        </text>

        <text
          x={15}
          y={height / 2}
          fill="#aaa"
          textAnchor="middle"
          transform={`rotate(-90 15 ${height / 2})`}
        >
          PC{compY}
        </text>

        {/* Points */}
        {stats.pts.map((p, i) => {
          const x =
            margin +
            ((p.x - stats.minX) / range(stats.minX, stats.maxX)) * plotW;
          const y =
            height -
            margin -
            ((p.y - stats.minY) / range(stats.minY, stats.maxY)) * plotH;

          const mag = Math.hypot(p.x, p.y);
          const t = (mag - stats.minM) / range(stats.minM, stats.maxM);
          const color = viridisColor(t);

          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}
      </svg>
    </div>
  );
}

export default App;

