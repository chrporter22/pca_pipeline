import React, { useEffect, useState, useMemo } from 'react';
// import { useEffect, useState, useMemo } from 'react';
import './index.css';

function App() {
  const [data, setData] = useState([]);
  const [compX, setCompX] = useState(1);
  const [compY, setCompY] = useState(2);

  // useEffect(() => {
  //   fetch("http://localhost:3001/api/pca")
  //     .then(res => res.json())
  //     .then(setData)
  //     .catch(console.error);
  // }, []);
   
  useEffect(() => {
    // Fetch via Nginx proxy, relative path
    fetch("/api/pca")
        .then(res => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.json();
        })
        .then(setData)
        .catch(console.error);
    }, []);

  const width = 800, height = 400;

  // Safely compute axis ranges
  const { xValues, yValues, minX, maxX, minY, maxY } = useMemo(() => {
    const xv = data.map(d => d[`pca_${compX}`]).filter(v => v != null);
    const yv = data.map(d => d[`pca_${compY}`]).filter(v => v != null);

    return {
      xValues: xv,
      yValues: yv,
      minX: Math.min(...xv),
      maxX: Math.max(...xv),
      minY: Math.min(...yv),
      maxY: Math.max(...yv)
    };
  }, [data, compX, compY]);

  const safeRange = (min, max) => (max - min === 0 ? 1 : max - min);

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
            onChange={(e) => setCompX(+e.target.value)}
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
            onChange={(e) => setCompY(+e.target.value)}
            className="ml-2 p-1 bg-gray-800 text-green-300"
          />
        </label>
      </div>

      <svg width={width} height={height} className="bg-gray-900 rounded">
        {data.length > 0 && minX !== Infinity && minY !== Infinity && (
          data.map((d, i) => {
            const x = ((d[`pca_${compX}`] - minX) / safeRange(minX, maxX)) * width;
            const y = height - ((d[`pca_${compY}`] - minY) / safeRange(minY, maxY)) * height;

            return <circle key={i} cx={x} cy={y} r="3" fill="lime" />;
          })
        )}
      </svg>
    </div>
  );
}

export default App;

